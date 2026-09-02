"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember } from "@/lib/tenant";
import { hasPermission, ASSIGNABLE_ROLES, type Role } from "@/lib/rbac";

// Yetki kapısı (fail-closed): staff.manage izni olmayan reddedilir.
async function requireStaffManager() {
  const member = await getCurrentMember();
  if (!member) redirect("/login");
  if (!hasPermission(member.role, "staff.manage")) redirect("/staff?error=forbidden");
  return { member };
}

export async function addMember(formData: FormData) {
  const { member } = await requireStaffManager();

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const role = String(formData.get("role") || "stylist").trim() as Role;
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) redirect("/staff?error=email");
  if (!ASSIGNABLE_ROLES.includes(role)) redirect("/staff?error=role");

  // Kullanıcı zaten kayıtlıysa doğrudan üye yap; değilse davet akışı gerekiyor
  // (e-posta gönderimi henüz bağlı değil — UI bilgilendirme gösteriyor).
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (user) {
    await prisma.tenantMember.upsert({
      where: { tenant_id_user_id: { tenant_id: member.tenantId, user_id: user.id } },
      update: { role },
      create: { tenant_id: member.tenantId, user_id: user.id, role },
    });
    revalidatePath("/staff");
    redirect("/staff?success=added");
  }

  revalidatePath("/staff");
  redirect("/staff?success=invited");
}

export async function updateRole(formData: FormData) {
  const { member } = await requireStaffManager();

  const id = String(formData.get("id") || "").trim();
  const role = String(formData.get("role") || "").trim() as Role;
  if (!id || !ASSIGNABLE_ROLES.includes(role)) redirect("/staff?error=role");

  // Tenant kapsamı: yalnızca aynı tenant'taki ve owner OLMAYAN üyeler güncellenebilir.
  await prisma.tenantMember.updateMany({
    where: { id, tenant_id: member.tenantId, role: { not: "owner" } },
    data: { role },
  });

  revalidatePath("/staff");
  redirect("/staff?success=role_updated");
}

export async function removeMember(formData: FormData) {
  const { member } = await requireStaffManager();

  const id = String(formData.get("id") || "").trim();
  if (!id) return;

  // Kendini ve owner'ı silmeyi engelle; yalnızca kendi tenant'ı içinde.
  await prisma.tenantMember.deleteMany({
    where: {
      id,
      tenant_id: member.tenantId,
      role: { not: "owner" },
      user_id: { not: member.userId },
    },
  });

  revalidatePath("/staff");
  redirect("/staff?success=removed");
}

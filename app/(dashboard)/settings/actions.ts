"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant, getCurrentMember } from "@/lib/tenant";
import { hasPermission } from "@/lib/rbac";

const HEX = /^#[0-9a-fA-F]{6}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Ayar yazma kapısı — sadece settings.manage yetkisi olan roller geçer. */
async function requireSettingsAccess() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");
  const member = await getCurrentMember();
  if (!hasPermission(member?.role, "settings.manage")) redirect("/settings?error=forbidden");
  return tenant;
}

export async function updateShopProfile(formData: FormData) {
  const tenant = await requireSettingsAccess();

  const name = String(formData.get("name") || "").trim();
  const slug = String(formData.get("slug") || "").trim().toLowerCase();
  const logo_url = String(formData.get("logo_url") || "").trim() || null;
  const primary_color = String(formData.get("primary_color") || "").trim();
  const accent_color = String(formData.get("accent_color") || "").trim();

  if (!name) redirect("/settings?error=name_required");
  if (!SLUG.test(slug)) redirect("/settings?error=slug_invalid");
  if (logo_url && !/^https?:\/\//i.test(logo_url)) redirect("/settings?error=logo_invalid");
  if (primary_color && !HEX.test(primary_color)) redirect("/settings?error=color_invalid");
  if (accent_color && !HEX.test(accent_color)) redirect("/settings?error=color_invalid");

  // Slug herkese açık randevu adresinin parçası; başka kiracıda kullanılıyorsa reddet.
  if (slug !== tenant.slug) {
    const taken = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
    if (taken && taken.id !== tenant.id) redirect("/settings?error=slug_taken");
  }

  try {
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        name,
        slug,
        logo_url,
        primary_color: primary_color || null,
        accent_color: accent_color || null,
      },
    });
  } catch {
    redirect("/settings?error=update_failed");
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  redirect("/settings?success=saved");
}

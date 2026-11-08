"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ACTIVE_TENANT_COOKIE, getCurrentUserId } from "@/lib/tenant";
import { FREE_PACK_IDS, SELLABLE_PACK_IDS } from "@/config/modules";
import { startTrial } from "@/lib/trial";
import { slugBase, pickUniqueSlug } from "@/lib/register";
import { DEMO_EMAIL } from "@/lib/demo-identity";

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
} as const;

export async function switchTenant(formData: FormData) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const tenantId = String(formData.get("tenantId") || "");
  const membership = await prisma.tenantMember.findFirst({
    where: { user_id: userId, tenant_id: tenantId },
    select: { id: true },
  });
  if (!membership) redirect("/locations?error=forbidden");

  const store = await cookies();
  store.set(ACTIVE_TENANT_COOKIE, tenantId, COOKIE_OPTIONS);
  redirect("/dashboard");
}

/**
 * Yeni bir şube (kiracı) açar.
 *
 * Her şube ayrı bir çalışma alanıdır: müşteri, stok ve sipariş kayıtları
 * birbirine karışmaz (kiracı izolasyonu zaten bunu garanti ediyor). Yeni şube
 * ücretsiz paketle ve 30 günlük denemeyle başlar; abonelik şube bazındadır.
 */
export async function createLocation(formData: FormData) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  // Paylaşılan tanıtım hesabı üretimde kiracı açamaz; ayrıca hesap başına
  // makul bir şube tavanı var (kötüye kullanım / kaza koruması).
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (user?.email === DEMO_EMAIL) redirect("/locations?error=demo");
  const ownedCount = await prisma.tenant.count({ where: { owner_id: userId } });
  if (ownedCount >= 10) redirect("/locations?error=limit");

  const raw = String(formData.get("name") || "").trim();
  const name = raw.length >= 2 && raw.length <= 80 ? raw : "New location";
  const base = slugBase(name);
  const taken = new Set(
    (await prisma.tenant.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } })).map(
      (t) => t.slug,
    ),
  );
  const slug = pickUniqueSlug(name, (s) => taken.has(s));
  const trial = startTrial([...SELLABLE_PACK_IDS], new Date());

  const tenant = await prisma.$transaction(async (tx) => {
    const created = await tx.tenant.create({
      data: {
        name,
        slug,
        owner_id: userId,
        packs: FREE_PACK_IDS,
        settings: trial ? { trial_packs: trial.trialPacks } : {},
        trial_started_at: trial?.trialStartedAt ?? null,
        trial_ends_at: trial?.trialEndsAt ?? null,
      },
    });
    await tx.tenantMember.create({
      data: { tenant_id: created.id, user_id: userId, role: "owner", display_name: name },
    });
    return created;
  });

  const store = await cookies();
  store.set(ACTIVE_TENANT_COOKIE, tenant.id, COOKIE_OPTIONS);
  redirect("/settings");
}

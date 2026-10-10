"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant, getCurrentMember } from "@/lib/tenant";
import { hasPermission } from "@/lib/rbac";
import { canStartTrial, startTrial, TRIAL_DAYS } from "@/lib/trial";
import type { PackId } from "@/config/modules";
import { clearDemoRecords, insertDemoRecords } from "@/lib/demo-seed";
import { isValidTimeZone } from "@/lib/timezone";

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
  const time_zone = String(formData.get("time_zone") || "UTC").trim();
  const briefing_emails = formData.get("briefing_emails") === "on";

  if (!name) redirect("/settings?error=name_required");
  if (!SLUG.test(slug)) redirect("/settings?error=slug_invalid");
  if (logo_url && !/^https?:\/\//i.test(logo_url)) redirect("/settings?error=logo_invalid");
  if (primary_color && !HEX.test(primary_color)) redirect("/settings?error=color_invalid");
  if (accent_color && !HEX.test(accent_color)) redirect("/settings?error=color_invalid");
  if (!isValidTimeZone(time_zone)) redirect("/settings?error=timezone_invalid");

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
        briefing_emails,
        settings: { ...tenant.settings, time_zone },
      },
    });
  } catch {
    redirect("/settings?error=update_failed");
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  redirect("/settings?success=saved");
}

/**
 * Ücretli bir paketi süreli denemeye açar.
 *
 * Kiracı başına bir kez; ödeyen veya daha önce denemiş kiracı için sessizce
 * reddedilir. Paket kiracının `packs` alanına yazılmaz — süre dolduğunda
 * modüllerin kendiliğinden kapanması için yalnızca `settings.trial_packs`
 * içinde durur.
 */
export async function startPackTrial(formData: FormData) {
  const tenant = await requireSettingsAccess();

  const packId = String(formData.get("pack") || "") as PackId;
  if (!canStartTrial(tenant)) redirect("/settings?error=trial_unavailable");

  const trial = startTrial([packId], new Date());
  if (!trial) redirect("/settings?error=trial_unavailable");

  await prisma.$transaction(async (tx) => {
    // Yarış koşulu kapısı: deneme yalnızca hiç başlamamışken başlar.
    const updated = await tx.tenant.updateMany({
      where: { id: tenant.id, trial_started_at: null },
      data: {
        settings: { ...tenant.settings, trial_packs: trial.trialPacks },
        trial_started_at: trial.trialStartedAt,
        trial_ends_at: trial.trialEndsAt,
      },
    });
    if (updated.count === 0) return;

    await tx.funnelEvent.create({
      data: {
        tenant_id: tenant.id,
        event: "trial_started",
        metadata: { packs: trial.trialPacks, days: TRIAL_DAYS },
      },
    });
  });

  revalidatePath("/settings");
  redirect("/settings?success=trial_started");
}

/**
 * Örnek veriyi yükler.
 *
 * Yazma ve silme yolu `lib/demo-seed.ts`'te — aynı yol herkese açık /demo
 * kiracısını kuran betik tarafından da kullanılıyor, iki kopya olmasın.
 */
export async function seedDemoData() {
  const tenant = await requireSettingsAccess();

  await prisma.$transaction(async (tx) => {
    // İkinci kez basılırsa kopya yığılmasın: önce eskisi temizlenir.
    await clearDemoRecords(tx, tenant.id);
    await insertDemoRecords(tx, tenant.id, new Date());
    await tx.tenant.update({
      where: { id: tenant.id },
      data: { settings: { ...tenant.settings, demo_data: true } },
    });
  }, {
    // Kayıtlar uzak veritabanına sıralı yazılıyor; Prisma'nın 5 sn'lik
    // varsayılanı yetmiyor (P2028 "Transaction already closed").
    maxWait: 10_000,
    timeout: 60_000,
  });

  revalidatePath("/dashboard");
  revalidatePath("/settings");
  redirect("/settings?success=demo_loaded");
}

/** Örnek veriyi siler. Kullanıcının kendi kayıtlarına dokunmaz. */
export async function clearDemoData() {
  const tenant = await requireSettingsAccess();

  await prisma.$transaction(async (tx) => {
    await clearDemoRecords(tx, tenant.id);
    await tx.tenant.update({
      where: { id: tenant.id },
      data: { settings: { ...tenant.settings, demo_data: false } },
    });
  }, {
    // Kayıtlar uzak veritabanına sıralı yazılıyor; Prisma'nın 5 sn'lik
    // varsayılanı yetmiyor (P2028 "Transaction already closed").
    maxWait: 10_000,
    timeout: 60_000,
  });

  revalidatePath("/dashboard");
  revalidatePath("/settings");
  redirect("/settings?success=demo_cleared");
}

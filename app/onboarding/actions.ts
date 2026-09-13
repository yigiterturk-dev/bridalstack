"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/tenant";
import { PACKS, type PackId } from "@/config/modules";
import { splitOnboardingPacks } from "@/lib/billing";
import { startTrial } from "@/lib/trial";

export type OnboardingDraft = {
  shopName?: string;
  packs?: PackId[];
  services?: { name: string; duration?: number; price?: number }[];
  staff?: { email: string; role: string }[];
  step?: number;
};

// Taslağı yükle (giriş yapan kullanıcı için)
export async function loadDraft(): Promise<OnboardingDraft | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const draft = await prisma.onboardingDraft.findUnique({
    where: { user_id: userId },
    select: { data: true, step: true },
  });

  if (!draft) return null;
  return { ...(draft.data as OnboardingDraft), step: draft.step };
}

// Taslağı kaydet (her adımda otomatik)
export async function saveDraft(draft: OnboardingDraft): Promise<{ ok: boolean }> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false };

  const step = Math.max(1, Math.min(4, Number(draft.step) || 1));
  try {
    await prisma.onboardingDraft.upsert({
      where: { user_id: userId },
      update: { data: draft as object, step },
      create: { user_id: userId, data: draft as object, step },
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

type FinishInput = {
  shopName: string;
  packs: PackId[];
  services: { name: string; duration?: number; price?: number }[];
  signupSource?: string;
};

// Onboarding'i tamamla: tenant + üyelik + servisler oluştur, taslağı sil
export async function finishOnboarding(
  input: FinishInput
): Promise<{ ok: boolean; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not signed in" };

  // Sınır doğrulaması
  const shopName = String(input.shopName || "").trim();
  if (!shopName) return { ok: false, error: "Shop name is required" };
  if (shopName.length > 120) return { ok: false, error: "That shop name is too long" };

  const validPacks = (Array.isArray(input.packs) ? input.packs : [])
    .filter((p): p is PackId => typeof p === "string" && p in PACKS);
  // Kurulumdaki seçim ödeme yerine geçmez: ücretli paketler açılmaz, yalnızca
  // istek olarak saklanır. Aksi hâlde hazır paket seçen herkes aylık ücretli
  // modülleri bedava açardı.
  const { granted: packs, requestedPaid } = splitOnboardingPacks(validPacks);

  // Seçilen ücretli paketler ödeme yerine geçmez ama boş da bırakılmaz: süreli
  // bir deneme açılır. Deneme paketleri `packs`'e YAZILMAZ — süresi dolduğunda
  // kendiliğinden kapanmaları için yalnızca ayarlarda durur (bkz. lib/trial.ts).
  const trial = startTrial(requestedPaid, new Date());

  // Zaten bir workspace'i varsa tekrar oluşturma
  const existing = await prisma.tenantMember.findFirst({
    where: { user_id: userId },
    select: { tenant_id: true },
  });
  if (existing) return { ok: true };

  const baseSlug = shopName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const slug = baseSlug ? `${baseSlug}-${Date.now().toString(36)}` : `shop-${Date.now()}`;

  const services = (Array.isArray(input.services) ? input.services : [])
    .map((s) => ({
      name: String(s?.name || "").trim().slice(0, 120),
      duration: Number.isFinite(Number(s?.duration)) ? Math.max(5, Math.min(600, Number(s.duration))) : 30,
      price: Number.isFinite(Number(s?.price)) ? Math.max(0, Number(s.price)) : 0,
    }))
    .filter((s) => s.name.length > 0)
    .slice(0, 50);

  try {
    // Hepsi tek işlemde: yarım kalan kurulum kullanıcıyı tenant'sız bırakmasın.
    await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: shopName,
          slug,
          owner_id: userId,
          packs,
          plan: "free",
          signup_source: String(input.signupSource || "direct").slice(0, 60),
          settings: trial
            ? { requested_packs: requestedPaid, trial_packs: trial.trialPacks }
            : requestedPaid.length > 0
              ? { requested_packs: requestedPaid }
              : {},
          trial_started_at: trial?.trialStartedAt ?? null,
          trial_ends_at: trial?.trialEndsAt ?? null,
          onboarding_completed_at: new Date(),
        },
      });

      await tx.tenantMember.create({
        data: { tenant_id: tenant.id, user_id: userId, role: "owner" },
      });

      if (services.length > 0) {
        await tx.service.createMany({
          data: services.map((s, i) => ({
            tenant_id: tenant.id,
            name: s.name,
            duration: s.duration,
            price: s.price,
            sort_order: i,
          })),
        });
      }

      await tx.funnelEvent.create({
        data: {
          tenant_id: tenant.id,
          user_id: userId,
          event: "onboarding_completed",
          metadata: {
            packs,
            requested_packs: requestedPaid,
            trial_packs: trial?.trialPacks ?? [],
            service_count: services.length,
          },
        },
      });

      await tx.onboardingDraft.deleteMany({ where: { user_id: userId } });
    });
  } catch {
    return { ok: false, error: "Could not create the shop" };
  }

  return { ok: true };
}

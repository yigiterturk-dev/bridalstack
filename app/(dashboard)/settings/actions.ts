"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant, getCurrentMember } from "@/lib/tenant";
import { hasPermission } from "@/lib/rbac";
import { canStartTrial, startTrial, TRIAL_DAYS } from "@/lib/trial";
import type { PackId } from "@/config/modules";
import { buildDemoData } from "@/lib/demo-data";

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
  const briefing_emails = formData.get("briefing_emails") === "on";

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
        briefing_emails,
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

/** Tanıtım kayıtlarının işareti — silme yolu yalnız buna bakar. */
const DEMO_FILTER = { path: ["demo"], equals: true } as const;

/**
 * Örnek veriyi yükler.
 *
 * Gerçek tablolara yazar (ayrı bir "demo modu" yok: kullanıcı ürünü olduğu
 * gibi görsün) ama her kayıt `metadata.demo` ile işaretlenir. Aynı işaret
 * silme yolunun tek ölçütüdür; işaretsiz hiçbir kayıt silinmez.
 */
export async function seedDemoData() {
  const tenant = await requireSettingsAccess();
  const data = buildDemoData(new Date());

  await prisma.$transaction(async (tx) => {
    // İkinci kez basılırsa kopya yığılmasın: önce eskisi temizlenir.
    await clearDemoRecords(tx, tenant.id);

    const customerIds = new Map<string, string>();
    for (const c of data.customers) {
      const row = await tx.customer.create({
        data: { tenant_id: tenant.id, ...c, metadata: { ...c.metadata } },
        select: { id: true },
      });
      customerIds.set(c.name, row.id);
    }

    const productIds = new Map<string, string>();
    for (const p of data.products) {
      const { sku, ...rest } = p;
      const row = await tx.product.create({
        data: { tenant_id: tenant.id, sku, ...rest, metadata: { ...p.metadata } },
        select: { id: true },
      });
      productIds.set(sku, row.id);
    }

    for (const o of data.orders) {
      const customer_id = customerIds.get(o.customerName);
      if (!customer_id) continue;
      const lines = data.orderLines.filter((l) => l.orderRef === o.ref_no);
      const { customerName: _customerName, ...orderFields } = o;
      await tx.order.create({
        data: {
          tenant_id: tenant.id,
          customer_id,
          ...orderFields,
          metadata: { ...o.metadata },
          lines: {
            create: lines.map((l, i) => ({
              product_id: productIds.get(l.productSku) ?? null,
              description: l.name,
              kind: l.kind,
              quantity: l.quantity,
              unit_price: l.unit_price,
              position: i,
            })),
          },
        },
      });
    }

    for (const a of data.appointments) {
      const customer_id = customerIds.get(a.customerName);
      if (!customer_id) continue;
      const { customerName: _customerName, ...fields } = a;
      await tx.appointment.create({ data: { tenant_id: tenant.id, customer_id, ...fields } });
    }

    await tx.tenant.update({
      where: { id: tenant.id },
      data: { settings: { ...tenant.settings, demo_data: true } },
    });
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
  });

  revalidatePath("/dashboard");
  revalidatePath("/settings");
  redirect("/settings?success=demo_cleared");
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * İşaretli kayıtları siler. Her sorgu hem `tenant_id` hem de demo işaretiyle
 * daraltılır — iki kapı birden, çünkü buradaki hata başkasının verisini siler.
 */
async function clearDemoRecords(tx: Tx, tenantId: string) {
  const demoCustomers = await tx.customer.findMany({
    where: { tenant_id: tenantId, metadata: { ...DEMO_FILTER } },
    select: { id: true },
  });
  const customerIds = demoCustomers.map((c) => c.id);

  // Siparişler ve randevular müşteriye bağlı; müşteri silinince zaten
  // düşerler ama işaretli olanları önce açıkça siliyoruz ki işaretsiz bir
  // sipariş demo müşteriye bağlıysa kaybolmasın diye önce kontrol edelim.
  const strayOrders = customerIds.length
    ? await tx.order.count({
        where: { tenant_id: tenantId, customer_id: { in: customerIds }, NOT: { metadata: { ...DEMO_FILTER } } },
      })
    : 0;

  await tx.order.deleteMany({ where: { tenant_id: tenantId, metadata: { ...DEMO_FILTER } } });

  // Randevunun kendi işareti yok (tabloda metadata alanı yok), o yüzden yalnız
  // silinecek müşterilerle birlikte giderler. Demo müşterisine gerçek bir
  // sipariş bağlanmışsa müşteri de randevuları da bırakılır — silmek
  // kullanıcının kendi kaydını götürürdü.
  if (customerIds.length > 0 && strayOrders === 0) {
    await tx.appointment.deleteMany({ where: { tenant_id: tenantId, customer_id: { in: customerIds } } });
    await tx.customer.deleteMany({ where: { tenant_id: tenantId, metadata: { ...DEMO_FILTER } } });
  }

  await tx.product.deleteMany({ where: { tenant_id: tenantId, metadata: { ...DEMO_FILTER } } });
}

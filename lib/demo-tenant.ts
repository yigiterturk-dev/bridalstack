/**
 * Herkese açık tanıtım kiracısı — `/demo`.
 *
 * NEDEN: Instagram'dan gelen butikçi "ücretsiz plan var" deyip kayıt duvarına
 * çarpınca gidiyordu. Gelinlik yazılımı ekranda satılır; elbisenin raf →
 * gelin → temizleme yolculuğunu 20 saniyede gören kişi cevap yazar.
 *
 * DEĞİŞMEZ: bu kiracıya giren hesap `viewer` rolündedir, yani salt okunur.
 * Paylaşılan tek hesap olduğu için ilk ziyaretçinin bozduğu veriyi sonraki
 * yirmi kişi görürdü. Yazma kapısı rol sisteminin kendisi — ayrıca
 * `isDemoTenant` ile ikinci bir kapı daha var (bkz. lib/demo-guard.ts).
 */

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { clearDemoRecords, insertDemoRecords } from "@/lib/demo-seed";
import { DEMO_EMAIL, DEMO_PASSWORD, DEMO_TENANT_SLUG, DEMO_OWNER_EMAIL } from "@/lib/demo-identity";

export {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  DEMO_TENANT_SLUG,
  DEMO_OWNER_EMAIL,
  isDemoTenant,
} from "@/lib/demo-identity";

/** Veri bundan eskiyse tazelenir — randevular hep "yarın" görünsün. */
const FRESH_FOR_MS = 12 * 60 * 60 * 1000;

async function upsertUser(email: string, name: string, password: string) {
  const row = await prisma.user.upsert({
    where: { email },
    update: { name },
    create: { email, name, password_hash: await bcrypt.hash(password, 10) },
    select: { id: true },
  });
  return row.id;
}

/**
 * Kiracıyı, hesabı ve veriyi hazır hâle getirir. Defalarca çağrılabilir:
 * eksik olanı kurar, verisi bayatlamışsa tazeler, taze ise hiçbir şey yapmaz.
 */
export async function ensureDemoTenant(now = new Date()) {
  const ownerId = await upsertUser(DEMO_OWNER_EMAIL, "Demo Owner", crypto.randomUUID());
  const viewerId = await upsertUser(DEMO_EMAIL, "Demo Visitor", DEMO_PASSWORD);

  let tenant = await prisma.tenant.findUnique({ where: { slug: DEMO_TENANT_SLUG } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: "Marchesa Bridal Atelier",
        slug: DEMO_TENANT_SLUG,
        owner_id: ownerId,
        // Demo tüm modülleri göstersin — satılan şey zaten kiralama ve tadilat.
        packs: ["base", "salon", "sales", "inventory", "pro", "finance"],
        signup_source: "demo",
        briefing_emails: false,
        settings: {},
      },
    });
  }

  const ownerMember = await prisma.tenantMember.upsert({
    where: { tenant_id_user_id: { tenant_id: tenant.id, user_id: ownerId } },
    update: { display_name: "Owner", title: "Lead Bridal Stylist", is_bookable: true },
    create: { tenant_id: tenant.id, user_id: ownerId, role: "owner", display_name: "Owner", title: "Lead Bridal Stylist", is_bookable: true },
    select: { id: true },
  });

  // The public demo should also prove the booking journey, not just the back office.
  // Seed the catalog once; real demo bookings and any future edits are preserved.
  const existingServices = await prisma.service.findMany({
    where: { tenant_id: tenant.id, is_active: true },
    select: { id: true },
  });
  const serviceIds = existingServices.length
    ? existingServices.map((service) => service.id)
    : (
        await Promise.all([
          { name: "Bridal Consultation", category: "Appointments", duration: 60, price: 0, description: "A relaxed first appointment to explore your vision." },
          { name: "First Fitting", category: "Fittings", duration: 90, price: 150, description: "Try on gowns and build your shortlist with a stylist." },
          { name: "Alterations Fitting", category: "Fittings", duration: 45, price: 85, description: "A focused fitting for final adjustments and measurements." },
        ].map((service, sort_order) =>
          prisma.service.create({
            data: { tenant_id: tenant.id, ...service, sort_order },
            select: { id: true },
          }),
        )
      )
    ).map((service) => service.id);

  await Promise.all(
    serviceIds.map((service_id) =>
      prisma.staffService.upsert({
        where: { member_id_service_id: { member_id: ownerMember.id, service_id } },
        update: {},
        create: { member_id: ownerMember.id, service_id },
      }),
    ),
  );

  await Promise.all(
    Array.from({ length: 7 }, (_, day_of_week) =>
      prisma.staffSchedule.upsert({
        where: { member_id_day_of_week: { member_id: ownerMember.id, day_of_week } },
        update: { start_time: "09:00", end_time: "17:00", break_start: "12:00", break_end: "13:00", is_off: day_of_week === 0 },
        create: { tenant_id: tenant.id, member_id: ownerMember.id, day_of_week, start_time: "09:00", end_time: "17:00", break_start: "12:00", break_end: "13:00", is_off: day_of_week === 0 },
      }),
    ),
  );

  // Ziyaretçi VIEWER. Burayı "admin" yapmak demoyu ilk gelenin insafına bırakır.
  await prisma.tenantMember.upsert({
    where: { tenant_id_user_id: { tenant_id: tenant.id, user_id: viewerId } },
    update: { role: "viewer" },
    create: { tenant_id: tenant.id, user_id: viewerId, role: "viewer", display_name: "Visitor", is_bookable: false },
  });

  const settings = (tenant.settings ?? {}) as Record<string, unknown>;
  const seededAt = typeof settings.demo_seeded_at === "string" ? Date.parse(settings.demo_seeded_at) : 0;
  const fresh = Number.isFinite(seededAt) && now.getTime() - seededAt < FRESH_FOR_MS;

  if (!fresh) {
    await prisma.$transaction(async (tx) => {
      await clearDemoRecords(tx, tenant!.id);
      await insertDemoRecords(tx, tenant!.id, now);
      await tx.tenant.update({
        where: { id: tenant!.id },
        data: { settings: { ...settings, demo_data: true, demo_seeded_at: now.toISOString() } },
      });
    },
      {
        // Kayıtlar uzak veritabanına sıralı yazılıyor; Prisma'nın 5 sn'lik
        // varsayılanı yetmiyordu (P2028 "Transaction already closed").
        maxWait: 10_000,
        timeout: 60_000,
      },
    );
  }

  return { tenantId: tenant.id, reseeded: !fresh };
}

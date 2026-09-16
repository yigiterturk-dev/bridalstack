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
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return existing.id;
  const row = await prisma.user.create({
    data: { email, name, password_hash: await bcrypt.hash(password, 10) },
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

  await prisma.tenantMember.upsert({
    where: { tenant_id_user_id: { tenant_id: tenant.id, user_id: ownerId } },
    update: {},
    create: { tenant_id: tenant.id, user_id: ownerId, role: "owner", display_name: "Owner" },
  });

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

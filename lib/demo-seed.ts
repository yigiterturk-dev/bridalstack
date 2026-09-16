/**
 * Tanıtım verisinin veritabanına yazılması ve silinmesi.
 *
 * İki yerden çağrılır ve ikisi de AYNI yoldan geçsin diye buraya alındı:
 *   1. Ayarlar → "örnek veriyi yükle" (kullanıcı kendi kiracısına basar)
 *   2. `npm run demo:provision` (herkese açık /demo kiracısını kurar)
 *
 * Kayıtlar gerçek tablolara yazılır — ayrı bir "demo modu" yok, ziyaretçi
 * ürünü olduğu gibi görür — ama `metadata.demo` ile işaretlenir. Silme yolu
 * YALNIZCA bu işarete bakar; işaretsiz hiçbir kayıt silinmez.
 */

import { prisma } from "@/lib/prisma";
import { buildDemoData, buildDemoOperations } from "@/lib/demo-data";

export const DEMO_FILTER = { path: ["demo"], equals: true } as const;

export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * İşaretli kayıtları siler. Her sorgu hem `tenant_id` hem de demo işaretiyle
 * daraltılır — iki kapı birden, çünkü buradaki hata başkasının verisini siler.
 */
export async function clearDemoRecords(tx: Tx, tenantId: string) {
  const demoCustomers = await tx.customer.findMany({
    where: { tenant_id: tenantId, metadata: { ...DEMO_FILTER } },
    select: { id: true },
  });
  const customerIds = demoCustomers.map((c) => c.id);

  const demoProducts = await tx.product.findMany({
    where: { tenant_id: tenantId, metadata: { ...DEMO_FILTER } },
    select: { id: true },
  });
  const productIds = demoProducts.map((p) => p.id);

  // Temizleme işinin ürüne/kiralamaya bağı SetNull — yani müşteri ya da ürün
  // silinince iş ORTADA KALIR. Cascade'e güvenilemeyeceği için önce o siliniyor.
  if (productIds.length > 0) {
    await tx.cleaningJob.deleteMany({
      where: { tenant_id: tenantId, product_id: { in: productIds } },
    });
  }

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
    // Kiralama ve tadilat müşteriye Cascade bağlı; yine de açıkça siliyoruz ki
    // silme sırası şemadaki bir değişiklikle sessizce bozulmasın.
    await tx.rental.deleteMany({ where: { tenant_id: tenantId, customer_id: { in: customerIds } } });
    await tx.alteration.deleteMany({ where: { tenant_id: tenantId, customer_id: { in: customerIds } } });
    await tx.appointment.deleteMany({ where: { tenant_id: tenantId, customer_id: { in: customerIds } } });
    await tx.customer.deleteMany({ where: { tenant_id: tenantId, metadata: { ...DEMO_FILTER } } });
  }

  await tx.product.deleteMany({ where: { tenant_id: tenantId, metadata: { ...DEMO_FILTER } } });
}

/**
 * İşaretli kayıtları yazar. Çağırmadan önce `clearDemoRecords` çalıştırılır —
 * ikinci kez basıldığında kopya yığılmasın.
 */
export async function insertDemoRecords(tx: Tx, tenantId: string, now = new Date()) {
  const data = buildDemoData(now);
  const ops = buildDemoOperations(now);

  const customerIds = new Map<string, string>();
  for (const c of data.customers) {
    const row = await tx.customer.create({
      data: { tenant_id: tenantId, ...c, metadata: { ...c.metadata } },
      select: { id: true },
    });
    customerIds.set(c.name, row.id);
  }

  const productIds = new Map<string, string>();
  for (const p of data.products) {
    const { sku, ...rest } = p;
    const row = await tx.product.create({
      data: { tenant_id: tenantId, sku, ...rest, metadata: { ...p.metadata } },
      select: { id: true },
    });
    productIds.set(sku, row.id);
  }

  const orderIds = new Map<string, string>();
  for (const o of data.orders) {
    const customer_id = customerIds.get(o.customerName);
    if (!customer_id) continue;
    const lines = data.orderLines.filter((l) => l.orderRef === o.ref_no);
    const { customerName: _customerName, ...orderFields } = o;
    const row = await tx.order.create({
      data: {
        tenant_id: tenantId,
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
      select: { id: true },
    });
    orderIds.set(o.ref_no, row.id);
  }

  for (const a of data.appointments) {
    const customer_id = customerIds.get(a.customerName);
    if (!customer_id) continue;
    const { customerName: _customerName, ...fields } = a;
    await tx.appointment.create({ data: { tenant_id: tenantId, customer_id, ...fields } });
  }

  const rentalIds = new Map<string, string>();
  for (const r of ops.rentals) {
    const customer_id = customerIds.get(r.customerName);
    const product_id = productIds.get(r.productSku);
    if (!customer_id || !product_id) continue;
    const { key: _key, customerName: _c, productSku: _s, ...fields } = r;
    const row = await tx.rental.create({
      data: { tenant_id: tenantId, customer_id, product_id, ...fields },
      select: { id: true },
    });
    rentalIds.set(r.key, row.id);
  }

  for (const a of ops.alterations) {
    const customer_id = customerIds.get(a.customerName);
    if (!customer_id) continue;
    const { customerName: _c, productSku, orderRef, ...fields } = a;
    await tx.alteration.create({
      data: {
        tenant_id: tenantId,
        customer_id,
        product_id: productIds.get(productSku) ?? null,
        order_id: orderRef ? orderIds.get(orderRef) ?? null : null,
        ...fields,
      },
    });
  }

  for (const j of ops.cleaning) {
    const product_id = productIds.get(j.productSku);
    if (!product_id) continue;
    const { productSku: _s, customerName, fromRentalKey, ...fields } = j;
    await tx.cleaningJob.create({
      data: {
        tenant_id: tenantId,
        product_id,
        customer_id: customerName ? customerIds.get(customerName) ?? null : null,
        rental_id: fromRentalKey ? rentalIds.get(fromRentalKey) ?? null : null,
        ...fields,
      },
    });
  }
}

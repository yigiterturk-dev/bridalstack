"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant, getCurrentMember, getCurrentUserId } from "@/lib/tenant";
import { hasPermission, type Permission } from "@/lib/rbac";
import { derivedOrderTotals, parseDraftLines } from "@/lib/order-lines";
import { boundedInt, nonNegativeFloat } from "@/lib/numbers";
import { dateInTimeZone, dateTimeInTimeZone, normalizeTimeZone } from "@/lib/timezone";
import { normalizeEventDate } from "@/lib/journey";

// Auth + tenant + (opsiyonel) izin kapısı. Fail-closed: yetkisiz reddedilir.
async function requireAuth(permission?: Permission, denyRedirect = "/dashboard?error=forbidden") {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");
  if (permission) {
    const member = await getCurrentMember();
    if (!hasPermission(member?.role, permission)) redirect(denyRedirect);
  }
  return { userId, tenant };
}

// ─── Customers ───

export async function createCustomer(formData: FormData) {
  const { userId, tenant } = await requireAuth("customers.manage", "/customers?error=forbidden");

  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim() || null;
  const email = String(formData.get("email") || "").trim() || null;
  const notes = String(formData.get("notes") || "").trim() || null;
  const event_date = normalizeEventDate(formData.get("event_date"));

  if (!name) redirect("/customers/new?error=required");

  try {
    await prisma.customer.create({
      data: { tenant_id: tenant.id, name, phone, email, notes, event_date, created_by: userId },
    });
  } catch {
    redirect("/customers/new?error=insert");
  }

  revalidatePath("/customers");
  redirect("/customers?success=created");
}

// ─── Appointments ───

export async function createAppointment(formData: FormData) {
  const { userId, tenant } = await requireAuth("appointments.manage", "/appointments?error=forbidden");

  const customer_id = String(formData.get("customer_id") || "").trim();
  const title = String(formData.get("title") || "").trim() || "Appointment";
  const description = String(formData.get("description") || "").trim() || null;
  const date = String(formData.get("date") || "").trim();
  const time = String(formData.get("time") || "10:00").trim();

  if (!customer_id || !date) redirect("/appointments?error=required");

  try {
    await prisma.appointment.create({
      data: {
        tenant_id: tenant.id,
        customer_id,
        title,
        description,
        appointment_date: dateTimeInTimeZone(date, time, normalizeTimeZone(tenant.settings.time_zone)),
        created_by: userId,
      },
    });
  } catch {
    redirect("/appointments?error=insert");
  }

  revalidatePath("/appointments");
  redirect("/appointments?success=created");
}

export async function updateAppointmentStatus(formData: FormData) {
  const { tenant } = await requireAuth("appointments.manage", "/appointments?error=forbidden");

  const id = String(formData.get("id") || "").trim();
  const status = String(formData.get("status") || "").trim();
  if (!id || !status) return;

  // tenant_id filtresi izolasyonun garantisi — id tek başına yeterli değil.
  await prisma.appointment.updateMany({
    where: { id, tenant_id: tenant.id },
    data: { status },
  });
  revalidatePath("/appointments");
}

// ─── Products ───

/** Ürün formundaki alanları okur (ekle ve düzenle aynı kuralla). */
async function readProductForm(formData: FormData, tenantId: string) {
  const name = String(formData.get("name") || "").trim();
  const sku = String(formData.get("sku") || "").trim() || null;
  const category = String(formData.get("category") || "").trim() || null;
  const price = nonNegativeFloat(formData.get("price"));
  const cost = nonNegativeFloat(formData.get("cost"));
  const stock_quantity = boundedInt(formData.get("stock_quantity"), 0, 1_000_000, 1);
  const description = String(formData.get("description") || "").trim() || null;
  const barcode = String(formData.get("barcode") || "").trim();
  const imageInput = String(formData.get("image_url") || "").trim();
  // Sadece kendi Blob alanımızdan gelen adresleri kabul et; keyfi URL yazılmasın.
  const image_url = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i.test(imageInput) ? imageInput : null;
  // Tedarikçi başka kiracıya aitse sessizce boş bırak — çapraz bağ kurulmasın.
  const supplierInput = String(formData.get("supplier_id") || "").trim();
  const supplier = supplierInput
    ? await prisma.supplier.findFirst({ where: { id: supplierInput, tenant_id: tenantId }, select: { id: true } })
    : null;
  return { name, sku, category, price, cost, stock_quantity, description, barcode, image_url, supplier_id: supplier?.id ?? null };
}

export async function updateProduct(formData: FormData) {
  const { tenant } = await requireAuth("products.manage", "/products?error=forbidden");
  const id = String(formData.get("id") || "");
  const existing = await prisma.product.findFirst({ where: { id, tenant_id: tenant.id }, select: { id: true, barcode: true } });
  if (!existing) redirect("/products");

  const f = await readProductForm(formData, tenant.id);
  if (!f.name) redirect(`/products/${id}?error=required`);

  try {
    await prisma.product.update({
      where: { id: existing.id },
      data: { ...f, barcode: f.barcode || existing.barcode },
    });
  } catch {
    redirect(`/products/${id}?error=update`);
  }
  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  redirect(`/products/${id}?success=saved`);
}

/** Tek dokunuşla stok ±1 (satıldı / geldi). Sıfırın altına inmez. */
export async function adjustStock(formData: FormData) {
  const { tenant } = await requireAuth("products.manage", "/products?error=forbidden");
  const id = String(formData.get("id") || "");
  const delta = Number(formData.get("delta")) === -1 ? -1 : 1;
  const product = await prisma.product.findFirst({ where: { id, tenant_id: tenant.id }, select: { id: true, stock_quantity: true } });
  if (!product) redirect("/products");
  const next = Math.max(0, product.stock_quantity + delta);
  if (next !== product.stock_quantity) {
    await prisma.product.update({ where: { id: product.id }, data: { stock_quantity: next } });
  }
  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
}

export async function createProduct(formData: FormData) {
  const { userId, tenant } = await requireAuth("products.manage", "/products?error=forbidden");

  const name = String(formData.get("name") || "").trim();
  const sku = String(formData.get("sku") || "").trim() || null;
  const category = String(formData.get("category") || "").trim() || null;
  const price = nonNegativeFloat(formData.get("price"));
  const cost = nonNegativeFloat(formData.get("cost"));
  const stock_quantity = boundedInt(formData.get("stock_quantity"), 0, 1_000_000, 1);
  const description = String(formData.get("description") || "").trim() || null;
  const barcodeInput = String(formData.get("barcode") || "").trim();
  const imageInput = String(formData.get("image_url") || "").trim();
  // Sadece kendi Blob alanımızdan gelen adresleri kabul et; keyfi URL yazılmasın.
  const image_url = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i.test(imageInput)
    ? imageInput
    : null;

  if (!name) redirect("/products/new?error=required");

  // Tedarikçi başka kiracıya aitse sessizce boş bırak — çapraz bağ kurulmasın.
  const supplierInput = String(formData.get("supplier_id") || "").trim();
  const supplier = supplierInput
    ? await prisma.supplier.findFirst({
        where: { id: supplierInput, tenant_id: tenant.id },
        select: { id: true },
      })
    : null;

  let barcode = barcodeInput;
  if (!barcode) {
    const prefix = (category ?? "XX").substring(0, 2).toUpperCase();
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
    barcode = `${prefix}-${ts}-${rand}`;
  }

  try {
    await prisma.product.create({
      data: {
        tenant_id: tenant.id, name, barcode, sku, category, price, cost,
        supplier_id: supplier?.id ?? null,
        stock_quantity, description, image_url, created_by: userId,
      },
    });
  } catch {
    redirect("/products/new?error=insert");
  }

  revalidatePath("/products");
  redirect("/products?success=created");
}

// ─── Orders ───

export async function createOrder(formData: FormData) {
  const { userId, tenant } = await requireAuth("orders.manage", "/orders?error=forbidden");

  const customer_id = String(formData.get("customer_id") || "").trim();
  const order_type = String(formData.get("order_type") || "sale").trim();
  const shopToday = dateInTimeZone(new Date(), normalizeTimeZone(tenant.settings.time_zone));
  const order_date = String(formData.get("order_date") || shopToday).trim();
  const delivery_date = String(formData.get("delivery_date") || "").trim() || null;
  const sales_person = String(formData.get("sales_person") || "").trim() || null;
  const deposit_amount = nonNegativeFloat(formData.get("deposit_amount"));
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!customer_id) redirect("/orders/new?error=required");

  // Kalemler siparişle birlikte girilebilir. Girildiyse toplam ONLARDAN okunur;
  // girilmediyse eski davranış aynen sürer (elle yazılan tek toplam).
  const rows = formData.getAll("line_description").map((_, i) => ({
    description: String(formData.getAll("line_description")[i] ?? ""),
    product_id: String(formData.getAll("line_product_id")[i] ?? ""),
    kind: String(formData.getAll("line_kind")[i] ?? ""),
    quantity: String(formData.getAll("line_quantity")[i] ?? ""),
    unit_price: String(formData.getAll("line_unit_price")[i] ?? ""),
    discount: String(formData.getAll("line_discount")[i] ?? ""),
  }));
  const lines = parseDraftLines(rows);

  // Ürün kimlikleri kiracıya ait mi? Başka kiracının ürünü siparişe geçemez.
  const productIds = [...new Set(lines.map((l) => l.product_id).filter(Boolean) as string[])];
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds }, tenant_id: tenant.id },
        select: { id: true, name: true, price: true },
      })
    : [];
  const byId = new Map(products.map((p) => [p.id, p]));
  if (productIds.some((id) => !byId.has(id))) redirect("/orders/new?error=line_invalid");

  // Adı boş kalan satırın adı ürün kaydından gelir; fiyatı boşsa ürün fiyatı.
  for (const line of lines) {
    const product = line.product_id ? byId.get(line.product_id) : null;
    if (!line.description) line.description = product?.name ?? "";
    if (line.unit_price === 0 && product) line.unit_price = product.price ?? 0;
  }
  if (lines.some((l) => !l.description)) redirect("/orders/new?error=line_required");

  const derived = derivedOrderTotals(lines);
  const discounted_total = derived
    ? derived.discounted_total
    : nonNegativeFloat(formData.get("discounted_total"));
  const list_total = derived ? derived.list_total : discounted_total;
  // Kapora toplamı aşamaz: aşarsa sipariş "ödendi" görünür, fazla para kaybolur.
  if (deposit_amount > discounted_total) redirect("/orders/new?error=deposit_exceeds");

  const [yFull, m, d] = shopToday.split("-");
  const y = yFull.slice(2);
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  const ref_no = `S${y}${m}${d}-${rand}`;

  try {
    await prisma.order.create({
      data: {
        tenant_id: tenant.id, ref_no, customer_id, order_type, order_date,
        delivery_date: delivery_date && /^\d{4}-\d{2}-\d{2}$/.test(delivery_date) ? delivery_date : null,
        sales_person, discounted_total, deposit_amount,
        remaining_balance: Math.max(0, discounted_total - deposit_amount),
        list_total, notes, created_by: userId,
        // Sipariş ve kalemleri tek işlemde yazılır: yarım sipariş kalmaz.
        lines: lines.length
          ? {
              create: lines.map((line, index) => ({
                product_id: line.product_id,
                description: line.description,
                kind: line.kind,
                quantity: line.quantity,
                unit_price: line.unit_price,
                discount: line.discount,
                position: index + 1,
              })),
            }
          : undefined,
      },
    });
  } catch {
    redirect("/orders/new?error=insert");
  }

  revalidatePath("/orders");
  redirect("/orders?success=created");
}

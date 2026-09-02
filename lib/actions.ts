"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant, getCurrentMember, getCurrentUserId } from "@/lib/tenant";
import { hasPermission, type Permission } from "@/lib/rbac";

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

  if (!name) redirect("/customers/new?error=required");

  try {
    await prisma.customer.create({
      data: { tenant_id: tenant.id, name, phone, email, notes, created_by: userId },
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
        appointment_date: new Date(`${date}T${time}`),
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

export async function createProduct(formData: FormData) {
  const { userId, tenant } = await requireAuth("products.manage", "/products?error=forbidden");

  const name = String(formData.get("name") || "").trim();
  const sku = String(formData.get("sku") || "").trim() || null;
  const category = String(formData.get("category") || "").trim() || null;
  const price = parseFloat(String(formData.get("price") || "0")) || 0;
  const cost = parseFloat(String(formData.get("cost") || "0")) || 0;
  const stock_quantity = parseInt(String(formData.get("stock_quantity") || "1")) || 1;
  const description = String(formData.get("description") || "").trim() || null;
  const barcodeInput = String(formData.get("barcode") || "").trim();
  const imageInput = String(formData.get("image_url") || "").trim();
  // Sadece kendi Blob alanımızdan gelen adresleri kabul et; keyfi URL yazılmasın.
  const image_url = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i.test(imageInput)
    ? imageInput
    : null;

  if (!name) redirect("/products/new?error=required");

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
  const order_date = String(formData.get("order_date") || new Date().toISOString().split("T")[0]).trim();
  const delivery_date = String(formData.get("delivery_date") || "").trim() || null;
  const sales_person = String(formData.get("sales_person") || "").trim() || null;
  const discounted_total = parseFloat(String(formData.get("discounted_total") || "0")) || 0;
  const deposit_amount = parseFloat(String(formData.get("deposit_amount") || "0")) || 0;
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!customer_id) redirect("/orders/new?error=required");

  const y = String(new Date().getFullYear()).slice(2);
  const m = String(new Date().getMonth() + 1).padStart(2, "0");
  const d = String(new Date().getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  const ref_no = `S${y}${m}${d}-${rand}`;

  try {
    await prisma.order.create({
      data: {
        tenant_id: tenant.id, ref_no, customer_id, order_type, order_date,
        delivery_date: delivery_date && /^\d{4}-\d{2}-\d{2}$/.test(delivery_date) ? delivery_date : null,
        sales_person, discounted_total, deposit_amount,
        remaining_balance: Math.max(0, discounted_total - deposit_amount),
        list_total: discounted_total, notes, created_by: userId,
      },
    });
  } catch {
    redirect("/orders/new?error=insert");
  }

  revalidatePath("/orders");
  redirect("/orders?success=created");
}

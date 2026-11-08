"use server";

import { assertModule } from "@/lib/module-access";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember, getCurrentTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/rbac";
import { closingQuantity } from "@/lib/inventory";
import { dateInTimeZone, normalizeTimeZone } from "@/lib/timezone";

async function requireInventoryManager() {
  const member = await getCurrentMember();
  if (!member) redirect("/login");
  if (!hasPermission(member.role, "products.manage")) redirect("/inventory-count?error=forbidden");
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");
  return { ...member, timeZone: normalizeTimeZone(tenant.settings.time_zone) };
}

/** Sayım gerçekten bu kiracının mı ve hâlâ açık mı? */
async function requireOpenCount(tenantId: string, countId: string) {
  const count = await prisma.stockCount.findFirst({
    where: { id: countId, tenant_id: tenantId },
    select: { id: true, status: true },
  });
  if (!count) redirect("/inventory-count?error=notfound");
  if (count.status !== "open") redirect(`/inventory-count/${countId}?error=closed`);
  return count;
}

export async function startCount(formData: FormData) {
  await assertModule("inventory");
  const member = await requireInventoryManager();

  const reference =
    String(formData.get("reference") || "").trim() ||
    `Count ${dateInTimeZone(new Date(), member.timeZone)}`;

  // Aynı anda iki açık sayım, iki farklı "doğru" demektir. Tek açık sayım kuralı.
  const count = await prisma.$transaction(async (tx) => {
    // PostgreSQL advisory lock makes the open-check + create one critical
    // section; two browser tabs cannot open competing counts for one tenant.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`stock-count:${member.tenantId}`}, 0))`;
    const open = await tx.stockCount.findFirst({
      where: { tenant_id: member.tenantId, status: "open" },
      select: { id: true },
    });
    if (open) throw new Error(`OPEN_COUNT:${open.id}`);

    const products = await tx.product.findMany({
      where: { tenant_id: member.tenantId },
      select: { id: true, stock_quantity: true },
    });
    if (products.length === 0) throw new Error("NO_PRODUCTS");

    // Beklenen adet sayım açılırken dondurulur; sonra stok değişse de fark bozulmaz.
    return tx.stockCount.create({
      data: {
        tenant_id: member.tenantId,
        reference,
        notes: String(formData.get("notes") || "").trim() || null,
        started_by: member.userId,
        items: {
          create: products.map((p) => ({ product_id: p.id, expected_qty: p.stock_quantity })),
        },
      },
      select: { id: true },
    });
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith("OPEN_COUNT:")) redirect(`/inventory-count/${message.slice("OPEN_COUNT:".length)}?error=already_open`);
    if (message === "NO_PRODUCTS") redirect("/inventory-count?error=noproducts");
    throw error;
  });

  revalidatePath("/inventory-count");
  redirect(`/inventory-count/${count.id}`);
}

export async function saveCounts(formData: FormData) {
  await assertModule("inventory");
  const member = await requireInventoryManager();
  const countId = String(formData.get("count_id") || "").trim();
  await requireOpenCount(member.tenantId, countId);

  const updates: { id: string; counted_qty: number | null }[] = [];
  for (const [key, raw] of formData.entries()) {
    if (!key.startsWith("qty_")) continue;
    const itemId = key.slice(4);
    const value = String(raw).trim();
    if (value === "") {
      updates.push({ id: itemId, counted_qty: null });
      continue;
    }
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed < 0) continue;
    updates.push({ id: itemId, counted_qty: parsed });
  }

  const now = new Date();
  await prisma.$transaction(
    updates.map((u) =>
      prisma.stockCountItem.updateMany({
        // count_id filtresi, başka kiracının kalemine yazmayı imkânsız kılar.
        where: { id: u.id, count_id: countId },
        data: { counted_qty: u.counted_qty, counted_at: u.counted_qty === null ? null : now },
      })
    )
  );

  revalidatePath(`/inventory-count/${countId}`);
  redirect(`/inventory-count/${countId}?success=saved`);
}

/** Sayımı kapatır ve sayılan kalemlerin stoğunu gerçek adede çeker. */
export async function closeCount(formData: FormData) {
  await assertModule("inventory");
  const member = await requireInventoryManager();
  const countId = String(formData.get("count_id") || "").trim();
  await requireOpenCount(member.tenantId, countId);

  const items = await prisma.stockCountItem.findMany({
    where: { count_id: countId, counted_qty: { not: null } },
    select: { product_id: true, counted_qty: true, expected_qty: true },
  });

  await prisma.$transaction([
    ...items.flatMap((item) => {
      const qty = closingQuantity(item);
      if (qty === null || qty === item.expected_qty) return [];
      return [
        prisma.product.updateMany({
          where: { id: item.product_id, tenant_id: member.tenantId },
          data: { stock_quantity: qty },
        }),
      ];
    }),
    prisma.stockCount.updateMany({
      where: { id: countId, tenant_id: member.tenantId, status: "open" },
      data: { status: "closed", closed_at: new Date() },
    }),
  ]);

  revalidatePath("/inventory-count");
  revalidatePath("/products");
  redirect(`/inventory-count/${countId}?success=closed`);
}

export async function cancelCount(formData: FormData) {
  await assertModule("inventory");
  const member = await requireInventoryManager();
  const countId = String(formData.get("count_id") || "").trim();
  await requireOpenCount(member.tenantId, countId);

  await prisma.stockCount.updateMany({
    where: { id: countId, tenant_id: member.tenantId, status: "open" },
    data: { status: "cancelled", closed_at: new Date() },
  });

  revalidatePath("/inventory-count");
  redirect("/inventory-count?success=cancelled");
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMember, getCurrentTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/rbac";
import { todayISO } from "@/lib/finance";
import {
  BLOCKING_STATUSES,
  canTransition,
  findConflict,
  isValidRange,
  outstandingLateFee,
  returnRestockUnits,
  stockDelta,
} from "@/lib/rentals";
import { nonNegativeFloat } from "@/lib/numbers";
import { normalizeTimeZone } from "@/lib/timezone";

async function requireRentalsManager() {
  const member = await getCurrentMember();
  if (!member) redirect("/login");
  if (!hasPermission(member.role, "orders.manage")) redirect("/rentals?error=forbidden");
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");
  return { ...member, timeZone: normalizeTimeZone(tenant.settings.time_zone) };
}

function money(value: FormDataEntryValue | null): number {
  return nonNegativeFloat(value);
}

export async function createRental(formData: FormData) {
  const member = await requireRentalsManager();

  const customer_id = String(formData.get("customer_id") || "").trim();
  const product_id = String(formData.get("product_id") || "").trim();
  if (!customer_id || !product_id) redirect("/rentals?error=required");

  const start_date = String(formData.get("start_date") || "").trim();
  const due_date = String(formData.get("due_date") || "").trim();
  if (!isValidRange({ start_date, due_date })) redirect("/rentals?error=range");

  const order_id = String(formData.get("order_id") || "").trim() || null;

  // Referans verilen kayıtlar gerçekten bu kiracıya mı ait? RLS yok.
  const [customer, product, order] = await Promise.all([
    prisma.customer.findFirst({ where: { id: customer_id, tenant_id: member.tenantId }, select: { id: true } }),
    prisma.product.findFirst({ where: { id: product_id, tenant_id: member.tenantId }, select: { id: true } }),
    order_id
      ? prisma.order.findFirst({ where: { id: order_id, tenant_id: member.tenantId }, select: { id: true } })
      : null,
  ]);
  if (!customer || !product) redirect("/rentals?error=invalid");
  if (order_id && !order) redirect("/rentals?error=invalid");

  // Aynı elbise aynı günlerde ikinci geline söz verilemez.
  const booked = await prisma.rental.findMany({
    where: {
      tenant_id: member.tenantId,
      product_id: product.id,
      status: { in: BLOCKING_STATUSES },
      start_date: { lte: due_date },
      due_date: { gte: start_date },
    },
    select: { id: true, product_id: true, status: true, start_date: true, due_date: true },
  });
  const clash = findConflict(booked, { product_id: product.id, status: "reserved", start_date, due_date });
  if (clash) redirect("/rentals?error=conflict");

  await prisma.rental.create({
    data: {
      tenant_id: member.tenantId,
      customer_id: customer.id,
      product_id: product.id,
      order_id: order?.id ?? null,
      start_date,
      due_date,
      rental_fee: money(formData.get("rental_fee")),
      deposit: money(formData.get("deposit")),
      late_fee_per_day: money(formData.get("late_fee_per_day")),
      notes: String(formData.get("notes") || "").trim() || null,
      created_by: member.userId,
    },
  });

  revalidatePath("/rentals");
  redirect("/rentals?success=created");
}

/**
 * Kiralamayı bir sonraki duruma taşır.
 *
 * Stok: elbise raftan yalnız gelinin eline geçince (out) düşer; rezervasyon
 * takvimi kapatır, malı değil. Dönüşte kirliyse rafa GİRMEZ — temizleme işi
 * açılır, elbise oradan rafa döner.
 *
 * Para: kira bedeli çıkışta bir kez kasaya yazılır (`rental_id` tekil).
 * Gecikme bedeli otomatik yazılmaz; ekranda tahsil edilmek üzere gösterilir.
 */
export async function updateRentalStatus(formData: FormData) {
  const member = await requireRentalsManager();

  const id = String(formData.get("id") || "").trim();
  const next = String(formData.get("status") || "").trim();
  if (!id || !next) return;

  const row = await prisma.rental.findFirst({
    where: { id, tenant_id: member.tenantId },
    include: { product: { select: { name: true } }, customer: { select: { name: true } } },
  });
  if (!row) redirect("/rentals?error=notfound");
  if (!canTransition(row.status, next)) redirect("/rentals?error=transition");

  const today = todayISO(new Date(), member.timeZone);
  const needsCleaning = next === "returned" && String(formData.get("needs_cleaning")) === "on";
  const delta = stockDelta(row.status, next);
  const restock = next === "returned" ? returnRestockUnits(needsCleaning) : 0;
  const stockChange = delta + restock;

  await prisma.$transaction(async (tx) => {
    // Durum yalnız beklenen durumdan geçerse yazılır: iki sekme aynı anda
    // "teslim et" derse ikincisi hiçbir şey değiştirmez.
    const moved = await tx.rental.updateMany({
      where: { id: row.id, tenant_id: member.tenantId, status: row.status },
      data: {
        status: next,
        picked_up_on: next === "out" ? today : undefined,
        returned_on: next === "returned" ? today : undefined,
      },
    });
    if (moved.count === 0) return;

    if (stockChange !== 0) {
      // Raftan düşerken adet şartı konur: elde olmayan elbise teslim edilemez,
      // stok eksiye kaymaz. Rafa geri koyarken böyle bir şart gerekmez.
      await tx.product.updateMany({
        where: {
          id: row.product_id,
          tenant_id: member.tenantId,
          ...(stockChange < 0 ? { stock_quantity: { gte: -stockChange } } : {}),
        },
        data: { stock_quantity: { increment: stockChange } },
      });
    }

    // Kira bedeli çıkışta kasaya. Tekil anahtar mükerrer kaydı engeller.
    if (next === "out" && row.rental_fee > 0) {
      await tx.cashMovement.create({
        data: {
          tenant_id: member.tenantId,
          direction: "in",
          amount: row.rental_fee,
          method: "cash",
          category: "rental",
          occurred_on: today,
          description: `Rental — ${row.product?.name ?? "gown"} · ${row.customer?.name ?? ""}`.trim(),
          customer_id: row.customer_id,
          order_id: row.order_id,
          rental_id: row.id,
          created_by: member.userId,
        },
      });
    }

    if (needsCleaning) {
      await tx.cleaningJob.create({
        data: {
          tenant_id: member.tenantId,
          product_id: row.product_id,
          customer_id: row.customer_id,
          source: "rental",
          rental_id: row.id,
          quantity: 1,
          notes: `Back from ${row.customer?.name ?? "rental"}`,
          created_by: member.userId,
        },
      });
    }
  });

  revalidatePath("/rentals");
  if (stockChange !== 0) revalidatePath("/products");
  if (next === "out") revalidatePath("/cash");
  if (needsCleaning) revalidatePath("/cleaning");
  redirect(`/rentals?success=${next}`);
}

/** Gecikme bedelini kasaya elle yazar — ekrandaki tutar değil, yeniden hesaplanan. */
export async function collectLateFee(formData: FormData) {
  const member = await requireRentalsManager();
  const id = String(formData.get("id") || "").trim();
  if (!id) return;

  const row = await prisma.rental.findFirst({
    where: { id, tenant_id: member.tenantId },
    include: { product: { select: { name: true } }, customer: { select: { name: true } } },
  });
  if (!row) redirect("/rentals?error=notfound");

  // Tarayıcıdan gelen rakama güvenilmez; tutar o anki veriden hesaplanır ve
  // daha önce tahsil edilen düşülür.
  const amount = outstandingLateFee(row, todayISO(new Date(), member.timeZone));
  if (amount <= 0) redirect("/rentals?error=nolatefee");

  await prisma.$transaction(async (tx) => {
    // Koşul, o an okuduğumuz tahsilat toplamıdır: iki sekme aynı anda
    // basarsa ikincisi hiçbir şey yazmaz.
    const moved = await tx.rental.updateMany({
      where: { id: row.id, tenant_id: member.tenantId, late_fee_collected: row.late_fee_collected },
      data: { late_fee_collected: { increment: amount } },
    });
    if (moved.count === 0) return;

    await tx.cashMovement.create({
      data: {
        tenant_id: member.tenantId,
        direction: "in",
        amount,
        method: "cash",
        category: "rental",
        occurred_on: todayISO(new Date(), member.timeZone),
        description: `Late fee — ${row.product?.name ?? "gown"} · ${row.customer?.name ?? ""}`.trim(),
        customer_id: row.customer_id,
        created_by: member.userId,
      },
    });
  });

  revalidatePath("/rentals");
  revalidatePath("/cash");
  redirect("/rentals?success=latefee");
}

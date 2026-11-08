import { prisma } from "@/lib/prisma";

export type ReportRange = { days: number; start: Date; end: Date };

export function resolveRange(rangeParam?: string): ReportRange {
  const days = Math.min(365, Math.max(7, parseInt(rangeParam ?? "30", 10) || 30));
  const end = new Date();
  const start = new Date(end.getTime() - days * 86_400_000);
  return { days, start, end };
}

export type OrderRow = {
  id: string;
  ref_no: string;
  customerName: string;
  order_type: string;
  status: string;
  date: Date;
  total: number;
  collected: number;
  outstanding: number;
  salesPerson: string | null;
};

export type StaffRow = { name: string; orders: number; revenue: number };
export type CategoryRow = { category: string; tryOns: number; units: number; revenue: number };

/**
 * Rapor verisi. Analitik grafikler için özet üretirken burada satır satır
 * dökümü çıkarıyoruz; amaç dışa aktarılabilir ve denetlenebilir olması.
 */
export async function loadReports(tenantId: string, range: ReportRange) {
  const [orders, installments, products, tryOns] = await Promise.all([
    prisma.order.findMany({
      where: { tenant_id: tenantId, created_at: { gte: range.start, lte: range.end } },
      orderBy: { created_at: "desc" },
      select: {
        id: true, ref_no: true, order_type: true, status: true, created_at: true,
        order_date: true, discounted_total: true, deposit_amount: true, sales_person: true,
        customer: { select: { name: true } },
      },
    }),
    prisma.installment.findMany({
      where: { tenant_id: tenantId, status: "paid" },
      select: { order_id: true, amount: true },
    }),
    prisma.product.findMany({
      where: { tenant_id: tenantId },
      select: { id: true, name: true, category: true, price: true, stock_quantity: true },
    }),
    prisma.tryOn.findMany({
      where: { tenant_id: tenantId, created_at: { gte: range.start, lte: range.end } },
      select: { product_id: true, reaction: true },
    }),
  ]);

  const paidByOrder = new Map<string, number>();
  for (const i of installments) {
    if (!i.order_id) continue;
    paidByOrder.set(i.order_id, (paidByOrder.get(i.order_id) ?? 0) + i.amount);
  }

  const orderRows: OrderRow[] = orders.map((o) => {
    const collected = o.deposit_amount + (paidByOrder.get(o.id) ?? 0);
    return {
      id: o.id,
      ref_no: o.ref_no,
      customerName: o.customer?.name ?? "—",
      order_type: o.order_type,
      status: o.status,
      date: o.order_date ? new Date(`${o.order_date}T00:00:00`) : o.created_at,
      total: o.discounted_total,
      collected,
      outstanding: Math.max(0, Number((o.discounted_total - collected).toFixed(2))),
      salesPerson: o.sales_person,
    };
  });

  const live = orderRows.filter((o) => o.status !== "cancelled");
  const revenue = live.reduce((s, o) => s + o.total, 0);
  const collected = live.reduce((s, o) => s + o.collected, 0);

  const staffMap = new Map<string, StaffRow>();
  for (const o of live) {
    const name = o.salesPerson?.trim() || "Unassigned";
    const row = staffMap.get(name) ?? { name, orders: 0, revenue: 0 };
    row.orders += 1;
    row.revenue += o.total;
    staffMap.set(name, row);
  }
  const staff = [...staffMap.values()].sort((a, b) => b.revenue - a.revenue);

  const productById = new Map(products.map((p) => [p.id, p]));
  const catMap = new Map<string, CategoryRow>();
  for (const p of products) {
    const cat = p.category?.trim() || "Uncategorized";
    const row = catMap.get(cat) ?? { category: cat, tryOns: 0, units: 0, revenue: 0 };
    row.units += p.stock_quantity;
    row.revenue += p.price * p.stock_quantity;
    catMap.set(cat, row);
  }
  for (const t of tryOns) {
    const cat = productById.get(t.product_id)?.category?.trim() || "Uncategorized";
    const row = catMap.get(cat);
    if (row) row.tryOns += 1;
  }
  const categories = [...catMap.values()].sort((a, b) => b.revenue - a.revenue);

  const statusMap = new Map<string, { count: number; amount: number }>();
  for (const o of orderRows) {
    const row = statusMap.get(o.status) ?? { count: 0, amount: 0 };
    row.count += 1;
    row.amount += o.total;
    statusMap.set(o.status, row);
  }
  const statuses = [...statusMap.entries()]
    .map(([status, v]) => ({ status, ...v }))
    .sort((a, b) => b.count - a.count);

  return {
    orderRows,
    staff,
    categories,
    statuses,
    totals: {
      orders: live.length,
      cancelled: orderRows.length - live.length,
      revenue,
      collected,
      outstanding: Math.max(0, Number((revenue - collected).toFixed(2))),
      averageOrder: live.length ? revenue / live.length : 0,
    },
  };
}

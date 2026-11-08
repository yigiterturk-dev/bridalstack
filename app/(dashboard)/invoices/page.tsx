import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import { formatPrice } from "@/config/modules";
import ModuleGuard from "@/components/module-guard";
import PageHead from "@/components/page-head";
import ListRow, { ListBox } from "@/components/list-row";
import EmptyState from "@/components/empty-state";
import {
  buildReceivables,
  totalOutstanding,
  type AgingBucket,
} from "@/lib/receivables";

export const dynamic = "force-dynamic";

type Props = { searchParams?: Promise<{ bucket?: string }> };

const BUCKET_ORDER: AgingBucket[] = ["current", "d1_30", "d31_60", "d61_plus"];

export default async function InvoicesPage({ searchParams }: Props) {
  const params = await searchParams;
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  return (
    <ModuleGuard moduleId="invoices" enabledModules={tenant.enabled_modules}>
      <InvoicesContent tenantId={tenant.id} bucket={params?.bucket} />
    </ModuleGuard>
  );
}

async function InvoicesContent({ tenantId, bucket }: { tenantId: string; bucket?: string }) {
  const [orders, installments] = await Promise.all([
    prisma.order.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: "desc" },
      take: 500,
      select: {
        id: true, ref_no: true, customer_id: true, status: true,
        discounted_total: true, deposit_amount: true, order_date: true, created_at: true,
      },
    }),
    prisma.installment.findMany({
      where: { tenant_id: tenantId },
      select: { order_id: true, amount: true, due_date: true, paid_at: true, status: true },
    }),
  ]);

  const all = buildReceivables(orders, installments);
  const outstanding = totalOutstanding(all);

  const active = bucket === "late" ? "late" : BUCKET_ORDER.includes(bucket as AgingBucket) ? (bucket as AgingBucket) : null;
  const rows = active === "late" ? all.filter((r) => r.daysOverdue > 0) : active ? all.filter((r) => r.bucket === active) : all;

  const customerIds = [...new Set(rows.map((r) => r.customer_id))];
  const customers = customerIds.length
    ? await prisma.customer.findMany({
        where: { id: { in: customerIds }, tenant_id: tenantId },
        select: { id: true, name: true, phone: true },
      })
    : [];
  const customerById = new Map(customers.map((c) => [c.id, c]));

  const lateRows = all.filter((r) => r.daysOverdue > 0);
  const lateAmount = lateRows.reduce((n, r) => n + r.outstanding, 0);
  const shortDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  // Geciken üstte (en çok geciken ilk), sonra en çok borcu olan.
  const sorted = [...rows].sort((x, y) => y.daysOverdue - x.daysOverdue || y.outstanding - x.outstanding);

  return (
    <div className="animate-fade-in-up">
      <PageHead
        title="Balances due"
        sub={all.length === 0 ? "Everything is paid" : `${formatPrice(outstanding)} still owed on ${all.length} ${all.length === 1 ? "order" : "orders"}`}
      />

      {lateRows.length > 0 && (
        <Link
          href={active ? "/invoices" : "/invoices?bucket=late"}
          className="mb-6 flex items-center gap-3 rounded-2xl border border-late/20 bg-late-soft px-4 py-3 text-sm text-late"
        >
          <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-late" />
          <span className="flex-1"><strong className="font-semibold">{formatPrice(lateAmount)} is late</strong> from {lateRows.length} {lateRows.length === 1 ? "bride" : "brides"}.</span>
        </Link>
      )}

      {sorted.length > 0 ? (
        <ListBox>
          {sorted.map((r) => {
            const c = customerById.get(r.customer_id);
            const when = r.daysOverdue > 0
              ? `${r.daysOverdue} ${r.daysOverdue === 1 ? "day" : "days"} late`
              : r.nextDueDate ? `next payment ${shortDate(r.nextDueDate)}` : "no payment plan";
            return (
              <ListRow
                key={r.orderId}
                href={`/orders/${r.orderId}`}
                title={c?.name ?? "No bride"}
                sub={`${when} · paid ${formatPrice(r.collected)} of ${formatPrice(r.total)} · ${r.ref_no}`}
                tone={r.daysOverdue > 0 ? "late" : "ok"}
                value={formatPrice(r.outstanding)}
                valueTone={r.daysOverdue > 0 ? "late" : "ink"}
                valueSub="left to pay"
              />
            );
          })}
        </ListBox>
      ) : (
        <EmptyState icon="task_alt" title={active ? "Nothing late" : "Everything is paid"} action={active ? { href: "/invoices", label: "Show everything owed" } : undefined}>
          {active ? "No bride is behind on a payment." : "No order has money still owed on it."}
        </EmptyState>
      )}
    </div>
  );
}

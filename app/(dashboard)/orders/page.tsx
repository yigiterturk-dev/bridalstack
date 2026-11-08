import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import ModuleGuard from "@/components/module-guard";
import SearchBar from "@/components/search-bar";
import { formatPrice } from "@/config/modules";
import PageHead, { BTN_PRIMARY } from "@/components/page-head";
import ListRow, { ListBox } from "@/components/list-row";
import EmptyState from "@/components/empty-state";

type PageProps = { searchParams?: Promise<{ q?: string }> };

const STATUS: Record<string, string> = {
  draft: "Draft",
  confirmed: "Confirmed",
  in_progress: "Being made",
  delivered: "Picked up",
  completed: "Done",
  cancelled: "Cancelled",
};
const TYPE: Record<string, string> = { rental: "Rental", custom: "Custom" };

export default async function OrdersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  return (
    <ModuleGuard moduleId="sales" enabledModules={tenant.enabled_modules}>
      <OrdersContent tenantId={tenant.id} query={params?.q?.trim() ?? ""} />
    </ModuleGuard>
  );
}

async function OrdersContent({ tenantId, query }: { tenantId: string; query: string }) {
  const where = {
    tenant_id: tenantId,
    ...(query
      ? {
          OR: [
            { ref_no: { contains: query, mode: "insensitive" as const } },
            { customer: { name: { contains: query, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [list, agg] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: 200,
      select: {
        id: true, ref_no: true, order_type: true, order_date: true, status: true,
        discounted_total: true, remaining_balance: true, created_at: true,
        customer: { select: { name: true } },
      },
    }),
    prisma.order.aggregate({
      where: { tenant_id: tenantId, status: { not: "cancelled" } },
      _sum: { discounted_total: true },
      _count: true,
    }),
  ]);

  const totalRevenue = agg._sum.discounted_total ?? 0;
  const orderCount = agg._count;

  const open = list.filter((o) => o.status !== "cancelled" && o.remaining_balance > 0).reduce((n, o) => n + o.remaining_balance, 0);

  return (
    <div className="animate-fade-in-up">
      <PageHead
        title="Orders"
        sub={orderCount === 0 ? "No orders yet" : `${orderCount} ${orderCount === 1 ? "order" : "orders"} · ${formatPrice(totalRevenue)} sold · ${formatPrice(open)} still to collect`}
      >
        <Link href="/orders/new" className={BTN_PRIMARY}>
          <span aria-hidden="true" className="material-symbols-outlined text-[20px]">add</span>
          New order
        </Link>
      </PageHead>

      <div className="mb-6 max-w-md">
        <SearchBar placeholder="Search by bride or order number" basePath="/orders" />
      </div>

      {list.length > 0 ? (
        <ListBox>
          {list.map((o) => {
            const shownDate = o.order_date ? new Date(`${o.order_date}T00:00:00`) : o.created_at;
            const cancelled = o.status === "cancelled";
            const owes = !cancelled && o.remaining_balance > 0;
            const sub = [
              TYPE[o.order_type],
              STATUS[o.status] ?? o.status.replace(/_/g, " "),
              shownDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
              o.ref_no,
            ].filter(Boolean).join(" · ");
            return (
              <ListRow
                key={o.id}
                href={`/orders/${o.id}`}
                title={o.customer?.name ?? "No bride"}
                sub={sub}
                tone={cancelled ? "done" : owes ? "ok" : "done"}
                value={cancelled ? "Cancelled" : owes ? `${formatPrice(o.remaining_balance)} left` : "Paid"}
                valueTone={cancelled || !owes ? "muted" : "ink"}
                valueSub={`of ${formatPrice(o.discounted_total)}`}
              />
            );
          })}
        </ListBox>
      ) : (
        <EmptyState
          icon="receipt_long"
          title={query ? "Nothing matches that search" : "No orders yet"}
          action={query ? undefined : { href: "/orders/new", label: "Write the first order" }}
        >
          {query ? "Try a bride's name or an order number." : "When a bride says yes to a dress, write it here."}
        </EmptyState>
      )}
    </div>
  );
}

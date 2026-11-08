import Link from "next/link";
import PageHead, { BTN_PRIMARY, BTN_SECONDARY } from "@/components/page-head";
import ListRow from "@/components/list-row";
import { redirect } from "next/navigation";
import { getCurrentTenant } from "@/lib/tenant";
import { formatPrice } from "@/config/modules";
import ModuleGuard from "@/components/module-guard";
import { loadReports, resolveRange } from "./data";

export const dynamic = "force-dynamic";

type Props = { searchParams?: Promise<{ range?: string }> };

const RANGES = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "365", label: "12 months" },
];

const money = (n: number) => formatPrice(Math.round(n));

export default async function ReportsPage({ searchParams }: Props) {
  const params = await searchParams;
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  return (
    <ModuleGuard moduleId="reports" enabledModules={tenant.enabled_modules}>
      <ReportsContent tenantId={tenant.id} rangeParam={params?.range} />
    </ModuleGuard>
  );
}

async function ReportsContent({ tenantId, rangeParam }: { tenantId: string; rangeParam?: string }) {
  const range = resolveRange(rangeParam);
  const data = await loadReports(tenantId, range);
  const q = `range=${range.days}`;

  return (
    <div className="animate-fade-in-up space-y-8">
      <PageHead title="Reports" sub={`Line-by-line detail for the last ${range.days} days, ready to export`}>
        {RANGES.map((r) => (
          <Link
            key={r.value}
            href={`/reports?range=${r.value}`}
            className={String(range.days) === r.value ? BTN_PRIMARY : BTN_SECONDARY}
          >
            {r.label}
          </Link>
        ))}
      </PageHead>

      <div className="grid grid-cols-2 md:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-4">
        {[
          { label: "How many orders did I write?", value: String(data.totals.orders), sub: data.totals.cancelled ? `${data.totals.cancelled} of them cancelled` : "None cancelled" },
          { label: "How much did I sell?", value: money(data.totals.revenue), sub: "Order totals, cancelled left out" },
          { label: "How much came in?", value: money(data.totals.collected), sub: "Deposits and installments paid" },
          { label: "How much is still owed?", value: money(data.totals.outstanding), sub: "On orders from this range" },
          { label: "What is a typical order?", value: money(data.totals.averageOrder), sub: "Average, cancelled left out" },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-2xl p-5 border border-[var(--line)]">
            <div className="mb-1 text-sm text-[var(--muted)]">{k.label}</div>
            <div className="font-serif text-2xl tabular-nums text-[var(--ink)]">{k.value}</div>
            <div className="mt-1 text-xs text-[var(--muted)]">{k.sub}</div>
          </div>
        ))}
      </div>

      <Section
        title="Which orders did I write?"
        subtitle={`${data.orderRows.length} in this range, newest first`}
        exportHref={`/reports/export?report=orders&${q}`}
        empty={data.orderRows.length === 0}
        emptyText="No orders were created in this range."
      >
        <Rows>
          {data.orderRows.slice(0, 100).map((o) => (
            <ListRow
              key={o.id}
              href={`/orders/${o.id}`}
              title={o.customerName}
              sub={`${o.ref_no} · ${o.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · ${o.status.replace(/_/g, " ")}`}
              value={money(o.total)}
              valueSub={o.outstanding > 0 ? `${money(o.outstanding)} still owed` : "paid in full"}
              valueTone={o.status === "cancelled" ? "muted" : "ink"}
            />
          ))}
        </Rows>
        {data.orderRows.length > 100 && (
          <p className="border-t border-[var(--line)] px-4 py-3 text-xs text-[var(--muted)]">Showing the first 100. Export for the full list.</p>
        )}
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Section
          title="Who sold the most?"
          subtitle="Orders written in this range, by stylist"
          exportHref={`/reports/export?report=staff&${q}`}
          empty={data.staff.length === 0}
          emptyText="No orders to attribute yet."
        >
          <Rows>
            {data.staff.map((s) => (
              <ListRow key={s.name} title={s.name} sub={`${s.orders} ${s.orders === 1 ? "order" : "orders"}`} value={money(s.revenue)} />
            ))}
          </Rows>
        </Section>

        <Section
          title="Which categories get tried on?"
          subtitle="Try-ons in this range, with what is in stock today"
          exportHref={`/reports/export?report=categories&${q}`}
          empty={data.categories.length === 0}
          emptyText="Add products to see category breakdowns."
        >
          <Rows>
            {data.categories.map((c) => (
              <ListRow
                key={c.category}
                title={c.category}
                sub={`${c.tryOns} ${c.tryOns === 1 ? "try-on" : "try-ons"} · ${c.units} in stock`}
                value={money(c.revenue)}
                valueSub="stock value"
              />
            ))}
          </Rows>
        </Section>
      </div>

      {data.statuses.length > 0 && (
        <Section title="Where do my orders stand?" subtitle="Orders from this range, by status" empty={false} emptyText="">
          <Rows>
            {data.statuses.map((s) => {
              const label = s.status.replace(/_/g, " ");
              return (
                <ListRow
                  key={s.status}
                  title={label.charAt(0).toUpperCase() + label.slice(1)}
                  sub={`${s.count} ${s.count === 1 ? "order" : "orders"}`}
                  value={money(s.amount)}
                />
              );
            })}
          </Rows>
        </Section>
      )}
    </div>
  );
}

function Section({
  title, subtitle, exportHref, empty, emptyText, children,
}: {
  title: string; subtitle: string; exportHref?: string;
  empty: boolean; emptyText: string; children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
      <div className="flex items-center justify-between gap-4 border-b border-[var(--line)] px-4 py-4">
        <div>
          <h2 className="font-serif text-lg text-[var(--ink)]">{title}</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">{subtitle}</p>
        </div>
        {exportHref && !empty && (
          <a
            href={exportHref}
            className={BTN_SECONDARY}
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            CSV
          </a>
        )}
      </div>
      {empty ? <p className="px-4 py-10 text-center text-sm text-[var(--muted)]">{emptyText}</p> : children}
    </div>
  );
}

function Rows({ children }: { children: React.ReactNode }) {
  return <div className="divide-y divide-[var(--line)]">{children}</div>;
}

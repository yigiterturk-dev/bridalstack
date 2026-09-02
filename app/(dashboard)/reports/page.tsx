import Link from "next/link";
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
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl lg:text-4xl font-extrabold text-stone-900 tracking-tight flex items-center gap-3">
            Reports <span className="text-rose-400 font-normal">✧</span>
          </h1>
          <p className="text-stone-500 mt-2 font-medium">
            Line-by-line detail for the last {range.days} days, ready to export.
          </p>
        </div>
        <div className="flex gap-2">
          {RANGES.map((r) => (
            <Link
              key={r.value}
              href={`/reports?range=${r.value}`}
              className={`px-3.5 py-2 rounded-xl text-sm font-medium border transition-colors ${
                String(range.days) === r.value
                  ? "bg-stone-900 text-white border-stone-900"
                  : "bg-white text-stone-600 border-stone-200 hover:border-stone-300"
              }`}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Orders", value: String(data.totals.orders), sub: data.totals.cancelled ? `${data.totals.cancelled} cancelled` : "none cancelled" },
          { label: "Revenue booked", value: money(data.totals.revenue), sub: "excluding cancelled" },
          { label: "Collected", value: money(data.totals.collected), sub: "deposits and installments" },
          { label: "Average order", value: money(data.totals.averageOrder), sub: `${money(data.totals.outstanding)} still owed` },
        ].map((k) => (
          <div key={k.label} className="bg-white/60 backdrop-blur-md rounded-2xl p-5 border border-stone-200/60">
            <div className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">{k.label}</div>
            <div className="text-2xl font-extrabold text-stone-900 tabular-nums">{k.value}</div>
            <div className="text-xs text-stone-400 mt-1">{k.sub}</div>
          </div>
        ))}
      </div>

      <Section
        title="Orders"
        subtitle={`${data.orderRows.length} in this range`}
        exportHref={`/reports/export?report=orders&${q}`}
        empty={data.orderRows.length === 0}
        emptyText="No orders were created in this range."
      >
        <Table
          head={["Reference", "Date", "Customer", "Status", "Total", "Collected", "Outstanding"]}
          align={["left", "left", "left", "left", "right", "right", "right"]}
          rows={data.orderRows.slice(0, 100).map((o) => [
            o.ref_no,
            o.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
            o.customerName,
            o.status.replace(/_/g, " "),
            money(o.total),
            money(o.collected),
            money(o.outstanding),
          ])}
          note={data.orderRows.length > 100 ? "Showing the first 100. Export for the full list." : undefined}
        />
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Section
          title="By stylist"
          subtitle="Orders written in this range"
          exportHref={`/reports/export?report=staff&${q}`}
          empty={data.staff.length === 0}
          emptyText="No orders to attribute yet."
        >
          <Table
            head={["Stylist", "Orders", "Revenue"]}
            align={["left", "right", "right"]}
            rows={data.staff.map((s) => [s.name, String(s.orders), money(s.revenue)])}
          />
        </Section>

        <Section
          title="By category"
          subtitle="Stock and interest"
          exportHref={`/reports/export?report=categories&${q}`}
          empty={data.categories.length === 0}
          emptyText="Add products to see category breakdowns."
        >
          <Table
            head={["Category", "Try-ons", "Units", "Stock value"]}
            align={["left", "right", "right", "right"]}
            rows={data.categories.map((c) => [c.category, String(c.tryOns), String(c.units), money(c.revenue)])}
          />
        </Section>
      </div>

      {data.statuses.length > 0 && (
        <Section title="By status" subtitle="Where orders stand" empty={false} emptyText="">
          <Table
            head={["Status", "Orders", "Value"]}
            align={["left", "right", "right"]}
            rows={data.statuses.map((s) => [s.status.replace(/_/g, " "), String(s.count), money(s.amount)])}
          />
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
    <div className="bg-white/60 backdrop-blur-xl rounded-[2rem] border border-stone-200/60 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-stone-100">
        <div>
          <h2 className="font-bold text-stone-900">{title}</h2>
          <p className="text-xs text-stone-400 mt-0.5">{subtitle}</p>
        </div>
        {exportHref && !empty && (
          <a
            href={exportHref}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:border-stone-400 hover:text-stone-900 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            CSV
          </a>
        )}
      </div>
      {empty ? <p className="px-6 py-10 text-sm text-stone-400 text-center">{emptyText}</p> : children}
    </div>
  );
}

function Table({
  head, rows, align, note,
}: {
  head: string[]; rows: string[][]; align: ("left" | "right")[]; note?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse text-sm">
        <thead>
          <tr className="bg-stone-50/50 border-b border-stone-100">
            {head.map((h, i) => (
              <th
                key={h}
                className={`px-6 py-3 text-xs font-bold text-stone-500 uppercase tracking-wider ${align[i] === "right" ? "text-right" : ""}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100/60">
          {rows.map((row, ri) => (
            <tr key={ri} className="hover:bg-white/70 transition-colors">
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={`px-6 py-3.5 ${align[ci] === "right" ? "text-right tabular-nums" : ""} ${ci === 0 ? "font-medium text-stone-800" : "text-stone-600"} ${ci === 3 && align[ci] === "left" ? "capitalize" : ""}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {note && <p className="px-6 py-3 text-xs text-stone-400 border-t border-stone-100">{note}</p>}
    </div>
  );
}

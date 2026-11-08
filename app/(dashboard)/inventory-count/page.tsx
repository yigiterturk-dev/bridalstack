import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import ModuleGuard from "@/components/module-guard";
import { summarizeCount } from "@/lib/inventory";
import { startCount } from "./actions";
import EmptyState from "@/components/empty-state";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  forbidden: "You do not have permission to run stock counts.",
  noproducts: "Add some gowns to your catalogue before counting them.",
  already_open: "There is already an open count — finish that one first.",
  notfound: "That count no longer exists.",
};

type Props = { searchParams?: Promise<{ error?: string; success?: string }> };

export default async function InventoryCountPage({ searchParams }: Props) {
  const params = await searchParams;
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  return (
    <ModuleGuard moduleId="inventory" enabledModules={tenant.enabled_modules}>
      <CountsContent tenantId={tenant.id} error={params?.error} />
    </ModuleGuard>
  );
}

async function CountsContent({ tenantId, error }: { tenantId: string; error?: string }) {
  const counts = await prisma.stockCount.findMany({
    where: { tenant_id: tenantId },
    orderBy: { started_at: "desc" },
    take: 25,
    include: { items: { select: { expected_qty: true, counted_qty: true } } },
  });

  const open = counts.find((c) => c.status === "open");

  return (
    <div className="animate-fade-in-up">
      <div className="mb-10">
        <h1 className="text-3xl lg:text-4xl font-serif font-normal text-[var(--ink)]">Stock count</h1>
        <p className="text-[var(--muted)] mt-2 font-medium">
          Walk the rail, enter what is actually there, and let the system correct your stock.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-gold/30 bg-gold-soft px-5 py-3 text-sm font-medium text-gold">
          {ERRORS[error] ?? "Something went wrong."}
        </div>
      )}

      {open ? (
        <div className="mb-8 bg-white rounded-2xl border border-amber-200 shadow-sm p-6 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-amber-600 mb-1">Count in progress</div>
            <h2 className="text-lg font-serif font-normal text-[var(--ink)]">{open.reference}</h2>
            <p className="text-sm text-[var(--muted)] mt-0.5">
              {summarizeCount(open.items).counted} of {open.items.length} gowns counted
            </p>
          </div>
          <Link
            href={`/inventory-count/${open.id}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-stone-900 text-white text-sm font-medium hover:bg-gold transition-colors"
          >
            Continue counting
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </Link>
        </div>
      ) : (
        <div className="mb-8 bg-white rounded-2xl border border-[var(--line)] shadow-sm p-6">
          <h2 className="text-lg font-serif font-normal text-[var(--ink)] mb-1">Start a new count</h2>
          <p className="text-sm text-[var(--muted)] mb-4">
            Today&apos;s stock levels are frozen as the expected figures the moment you start.
          </p>
          <form id="new" action={startCount} className="scroll-mt-24 flex flex-col sm:flex-row gap-3">
            <input
              name="reference"
              maxLength={80}
              placeholder="e.g. September rail check"
              className="flex-1 px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-sm outline-none focus:border-stone-400"
            />
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-stone-900 text-white text-sm font-semibold hover:bg-gold transition-colors"
            >
              Start count
            </button>
          </form>
        </div>
      )}

      <h2 className="text-sm font-serif font-normal text-[var(--muted)] uppercase tracking-wider mb-4">History</h2>

      {counts.length === 0 ? (
        <EmptyState icon="inventory" action={{ href: "#new", label: "Start a count" }} title="No counts yet">
          A count tells you what quietly walked out of the shop. Most boutiques run one every quarter.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          {counts.map((c) => {
            const s = summarizeCount(c.items);
            return (
              <Link
                key={c.id}
                href={`/inventory-count/${c.id}`}
                className="bg-white rounded-2xl border border-[var(--line)] shadow-sm p-5 flex items-center gap-4 hover:border-stone-300 transition-colors"
              >
                <div className="w-11 h-11 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-violet-500 text-[20px]">inventory</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-[var(--ink)]">{c.reference}</h3>
                    <StatusChip status={c.status} />
                  </div>
                  <p className="text-sm text-[var(--muted)] mt-0.5">
                    {c.started_at.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} ·{" "}
                    {s.counted}/{s.total} counted
                    {s.accuracy !== null && ` · ${s.accuracy}% matched`}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div
                    className={`text-lg font-bold tabular-nums ${
                      s.netUnits < 0 ? "text-gold" : s.netUnits > 0 ? "text-amber-600" : "text-stone-400"
                    }`}
                  >
                    {s.netUnits > 0 ? `+${s.netUnits}` : s.netUnits}
                  </div>
                  <div className="text-[11px] text-stone-400">units off</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function StatusChip({ status }: { status: string }) {
  const style =
    status === "open"
      ? "bg-amber-50 text-amber-700 border-amber-100"
      : status === "closed"
      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
      : "bg-stone-100 text-[var(--muted)] border-stone-200";
  return (
    <span className={`text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${style}`}>
      {status}
    </span>
  );
}

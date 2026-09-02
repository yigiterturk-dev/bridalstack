import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import ModuleGuard from "@/components/module-guard";
import { summarizeCount, variance } from "@/lib/inventory";
import { saveCounts, closeCount, cancelCount } from "../actions";
import { StatusChip } from "../page";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ success?: string; error?: string }>;
};

export default async function CountSheetPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  return (
    <ModuleGuard moduleId="inventory" enabledModules={tenant.enabled_modules}>
      <Sheet tenantId={tenant.id} countId={id} notice={sp?.success} />
    </ModuleGuard>
  );
}

async function Sheet({ tenantId, countId, notice }: { tenantId: string; countId: string; notice?: string }) {
  const count = await prisma.stockCount.findFirst({
    where: { id: countId, tenant_id: tenantId },
    include: {
      items: {
        include: { product: { select: { id: true, name: true, sku: true, category: true, image_url: true } } },
      },
    },
  });
  if (!count) notFound();

  const items = [...count.items].sort((a, b) =>
    (a.product.name ?? "").localeCompare(b.product.name ?? "")
  );
  const summary = summarizeCount(items);
  const isOpen = count.status === "open";

  return (
    <div className="animate-fade-in-up">
      <Link href="/inventory-count" className="text-sm text-stone-500 hover:text-stone-900 inline-flex items-center gap-1 mb-4">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span> All counts
      </Link>

      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-stone-900 tracking-tight">{count.reference}</h1>
            <StatusChip status={count.status} />
          </div>
          <p className="text-stone-500 mt-2 font-medium">
            Started {count.started_at.toLocaleDateString("en-US", { month: "long", day: "numeric" })}
            {count.closed_at &&
              ` · closed ${count.closed_at.toLocaleDateString("en-US", { month: "long", day: "numeric" })}`}
          </p>
        </div>

        {isOpen && (
          <div className="flex items-center gap-2">
            <form action={cancelCount}>
              <input type="hidden" name="count_id" value={count.id} />
              <button type="submit" className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm font-semibold text-stone-600 hover:bg-stone-50">
                Cancel count
              </button>
            </form>
            <form action={closeCount}>
              <input type="hidden" name="count_id" value={count.id} />
              <button
                type="submit"
                disabled={summary.counted === 0}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-40"
              >
                Close &amp; adjust stock
              </button>
            </form>
          </div>
        )}
      </div>

      {notice === "closed" && (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-medium text-emerald-700">
          Count closed. Stock levels now match what you counted.
        </div>
      )}
      {notice === "saved" && (
        <div className="mb-6 rounded-2xl border border-stone-200 bg-white px-5 py-3 text-sm font-medium text-stone-600">
          Saved. You can keep counting and come back to this sheet later.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <Stat label="Counted" value={`${summary.counted}/${summary.total}`} />
        <Stat label="Matched" value={summary.accuracy === null ? "—" : `${summary.accuracy}%`} />
        <Stat label="Short" value={String(summary.short)} tone={summary.short > 0 ? "rose" : undefined} />
        <Stat label="Net units" value={summary.netUnits > 0 ? `+${summary.netUnits}` : String(summary.netUnits)} tone={summary.netUnits < 0 ? "rose" : undefined} />
      </div>

      <form action={saveCounts}>
        <input type="hidden" name="count_id" value={count.id} />

        <div className="bg-white/70 backdrop-blur-xl rounded-[2rem] border border-stone-200/60 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-bold uppercase tracking-wide text-stone-400 border-b border-stone-100">
                  <th className="px-6 py-3">Gown</th>
                  <th className="px-4 py-3 text-right">Expected</th>
                  <th className="px-4 py-3 text-right">Counted</th>
                  <th className="px-6 py-3 text-right">Difference</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const diff = variance(item);
                  return (
                    <tr key={item.id} className="border-b border-stone-50 last:border-0">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          {item.product.image_url ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={item.product.image_url} alt={item.product.name} className="w-9 h-9 rounded-lg object-cover border border-stone-200" />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-stone-100 flex items-center justify-center">
                              <span className="material-symbols-outlined text-stone-400 text-[18px]">checkroom</span>
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-semibold text-stone-900 truncate">{item.product.name}</div>
                            <div className="text-xs text-stone-400">
                              {item.product.sku ?? item.product.category ?? "—"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-stone-500">{item.expected_qty}</td>
                      <td className="px-4 py-3 text-right">
                        {isOpen ? (
                          <input
                            name={`qty_${item.id}`}
                            type="number"
                            min="0"
                            max="99999"
                            defaultValue={item.counted_qty ?? ""}
                            placeholder="—"
                            className="w-20 px-3 py-1.5 rounded-lg border border-stone-200 text-right tabular-nums text-sm outline-none focus:border-stone-400"
                          />
                        ) : (
                          <span className="tabular-nums text-stone-900">{item.counted_qty ?? "—"}</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-right">
                        {diff === null ? (
                          <span className="text-stone-300">—</span>
                        ) : (
                          <span
                            className={`font-bold tabular-nums ${
                              diff < 0 ? "text-rose-600" : diff > 0 ? "text-amber-600" : "text-emerald-600"
                            }`}
                          >
                            {diff > 0 ? `+${diff}` : diff}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {isOpen && (
          <div className="mt-5 flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm text-stone-500">
              Leave a box empty for anything you have not counted — it stays untouched when you close.
            </p>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-stone-900 text-white text-sm font-semibold hover:bg-rose-600 transition-colors"
            >
              Save counts
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "rose" }) {
  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-stone-200/60 shadow-sm px-5 py-4">
      <div className="text-[11px] font-bold uppercase tracking-wide text-stone-400">{label}</div>
      <div className={`text-2xl font-extrabold tabular-nums mt-1 ${tone === "rose" ? "text-rose-600" : "text-stone-900"}`}>
        {value}
      </div>
    </div>
  );
}

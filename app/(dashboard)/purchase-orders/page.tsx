import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import { formatPrice } from "@/config/modules";
import { todayISO } from "@/lib/finance";
import { normalizeTimeZone } from "@/lib/timezone";
import ModuleGuard from "@/components/module-guard";
import SelectField from "@/components/select-field";
import { PO_STATUS_LABELS, isLate, summarize, type PoStatus } from "@/lib/purchasing";
import { createPurchaseOrder } from "./actions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  forbidden: "You do not have permission to manage purchasing.",
  required: "Pick a supplier.",
  invalid: "That supplier does not belong to your boutique.",
  insert: "That order could not be created. Try again.",
  notfound: "That order no longer exists.",
};

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-stone-100 text-stone-600 border-stone-200",
  ordered: "bg-amber-50 text-amber-700 border-amber-100",
  partial: "bg-sky-50 text-sky-700 border-sky-100",
  received: "bg-emerald-50 text-emerald-700 border-emerald-100",
  cancelled: "bg-stone-100 text-[var(--muted)] border-stone-200",
};

type Props = { searchParams?: Promise<{ error?: string }> };

export default async function PurchaseOrdersPage({ searchParams }: Props) {
  const params = await searchParams;
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  return (
    <ModuleGuard moduleId="inventory" enabledModules={tenant.enabled_modules}>
      <PurchaseOrdersContent tenantId={tenant.id} timeZone={normalizeTimeZone(tenant.settings.time_zone)} error={params?.error} />
    </ModuleGuard>
  );
}

async function PurchaseOrdersContent({ tenantId, timeZone, error }: { tenantId: string; timeZone: string; error?: string }) {
  const today = todayISO(new Date(), timeZone);

  const [orders, suppliers] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: "desc" },
      take: 150,
      include: { lines: true, supplier: { select: { id: true, name: true } } },
    }),
    prisma.supplier.findMany({
      where: { tenant_id: tenantId, is_active: true },
      orderBy: { name: "asc" },
      take: 500,
      select: { id: true, name: true, lead_time_days: true },
    }),
  ]);

  const open = orders.filter((o) => o.status === "ordered" || o.status === "partial");
  const late = open.filter((o) => isLate(o, o.lines, today));
  const onOrder = open.reduce((sum, o) => {
    const s = summarize(o.lines);
    return sum + (s.orderedCost - s.receivedCost);
  }, 0);

  return (
    <div className="animate-fade-in-up">
      <div className="mb-10">
        <h1 className="text-3xl lg:text-4xl font-serif font-normal text-[var(--ink)]">Purchase Orders</h1>
        <p className="text-[var(--muted)] mt-2 font-medium">
          {open.length === 0
            ? "Gowns on their way in — ordered, received, and costed"
            : `${open.length} open · ${formatPrice(Math.round(onOrder))} still on order${late.length > 0 ? ` · ${late.length} late` : ""}`}
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-gold/30 bg-gold-soft px-5 py-3 text-sm font-medium text-gold">
          {ERRORS[error] ?? "Something went wrong."}
        </div>
      )}

      {suppliers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[var(--line)] shadow-sm p-16 text-center">
          <span className="flex items-center justify-center w-16 h-16 rounded-2xl bg-violet-50 text-violet-500 mx-auto mb-5 material-symbols-outlined text-[32px]">
            local_shipping
          </span>
          <h3 className="text-xl font-bold text-[var(--ink)] mb-2">Add a supplier first</h3>
          <p className="text-[var(--muted)] max-w-md mx-auto mb-6">
            A purchase order is placed with somebody. Add the house you buy from and its lead time,
            then come back here.
          </p>
          <Link
            href="/suppliers"
            className="inline-block px-5 py-2.5 bg-stone-900 text-white rounded-xl text-sm font-semibold hover:bg-gold transition-colors"
          >
            Go to suppliers
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl border border-[var(--line)] shadow-sm p-6 h-fit">
            <h2 className="text-lg font-serif font-normal text-[var(--ink)] mb-4">Start an order</h2>
            <form action={createPurchaseOrder} className="flex flex-col gap-3">
              <Field label="Supplier">
                <SelectField
                  name="supplier_id"
                  required
                  placeholder="Select a supplier…"
                  options={suppliers.map((s) => ({
                    value: s.id,
                    label: s.name,
                    hint: s.lead_time_days ? `${s.lead_time_days} day lead time` : undefined,
                  }))}
                />
              </Field>
              <Field label="Expected">
                <input name="expected_on" type="date" className={INPUT} />
              </Field>
              <Field label="Notes">
                <textarea name="notes" rows={2} className={`${INPUT} resize-y`} placeholder="Optional…" />
              </Field>

              <p className="text-xs text-stone-400 leading-relaxed">
                Leave the date empty and the supplier&apos;s lead time fills it in. You add the gowns
                on the next screen — nothing hits the rail until the boxes actually arrive.
              </p>

              <button
                type="submit"
                className="mt-1 py-2.5 bg-stone-900 text-white rounded-xl text-sm font-semibold hover:bg-gold transition-colors"
              >
                Create draft
              </button>
            </form>
          </div>

          <div className="xl:col-span-2">
            {orders.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[var(--line)] shadow-sm p-16 text-center">
                <span className="flex items-center justify-center w-16 h-16 rounded-2xl bg-violet-50 text-violet-500 mx-auto mb-5 material-symbols-outlined text-[32px]">
                  inbox
                </span>
                <h3 className="text-xl font-bold text-[var(--ink)] mb-2">No purchase orders yet</h3>
                <p className="text-[var(--muted)] max-w-md mx-auto">
                  This is how stock gets in. Order from a supplier, tick off what actually arrives,
                  and the rail and the ledger both follow on their own.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {orders.map((o) => {
                  const s = summarize(o.lines);
                  const overdue = isLate(o, o.lines, today);
                  return (
                    <Link
                      key={o.id}
                      href={`/purchase-orders/${o.id}`}
                      className={`block bg-white rounded-2xl border shadow-sm p-5 hover:border-stone-300 transition-colors ${
                        overdue ? "border-late/30" : "border-[var(--line)]"
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center flex-shrink-0">
                          <span className="material-symbols-outlined text-stone-400 text-[20px]">local_shipping</span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-[var(--ink)]">{o.supplier?.name ?? "Supplier"}</h3>
                            <span className={`text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${STATUS_STYLE[o.status] ?? STATUS_STYLE.cancelled}`}>
                              {PO_STATUS_LABELS[o.status as PoStatus] ?? o.status}
                            </span>
                            {overdue && (
                              <span className="text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border bg-gold-soft text-gold border-gold/30">
                                late
                              </span>
                            )}
                          </div>

                          <p className="text-sm text-stone-600 mt-1">
                            {o.ref_no}
                            <span className="text-stone-400">
                              {" · "}
                              {s.lines === 0
                                ? "no gowns yet"
                                : `${s.receivedUnits}/${s.orderedUnits} received`}
                            </span>
                          </p>

                          <div className="flex items-center gap-3 mt-1.5 text-xs text-stone-400 flex-wrap">
                            {o.ordered_on && <span>Ordered {o.ordered_on}</span>}
                            {o.expected_on && <span>Expected {o.expected_on}</span>}
                            {o.closed_on && <span className="text-emerald-600">Closed {o.closed_on}</span>}
                            {s.orderedCost > 0 && (
                              <span className="text-stone-600 font-semibold">{formatPrice(Math.round(s.orderedCost))}</span>
                            )}
                          </div>
                        </div>

                        <span className="material-symbols-outlined text-stone-300 flex-shrink-0">chevron_right</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const INPUT =
  "w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-sm text-[var(--ink)] outline-none focus:border-stone-400 transition-colors";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-1">{label}</label>
      {children}
    </div>
  );
}

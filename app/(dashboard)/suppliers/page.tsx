import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import { formatPrice } from "@/config/modules";
import ModuleGuard from "@/components/module-guard";
import { todayISO } from "@/lib/finance";
import { isLate, summarize } from "@/lib/purchasing";
import { createSupplier, toggleSupplier, deleteSupplier } from "./actions";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  return (
    <ModuleGuard moduleId="inventory" enabledModules={tenant.enabled_modules}>
      <SuppliersContent tenantId={tenant.id} />
    </ModuleGuard>
  );
}

async function SuppliersContent({ tenantId }: { tenantId: string }) {
  const [suppliers, products, openOrders] = await Promise.all([
    prisma.supplier.findMany({
      where: { tenant_id: tenantId },
      orderBy: [{ is_active: "desc" }, { name: "asc" }],
    }),
    prisma.product.findMany({
      where: { tenant_id: tenantId },
      select: { supplier_id: true, stock_quantity: true, cost: true },
    }),
    // Yola çıkmış ama henüz kapanmamış siparişler. Taslaklar sayılmaz:
    // tedarikçi onlardan haberdar değil.
    prisma.purchaseOrder.findMany({
      where: { tenant_id: tenantId, status: { in: ["ordered", "partial"] } },
      orderBy: { expected_on: "asc" },
      select: { id: true, ref_no: true, supplier_id: true, status: true, expected_on: true, lines: true },
    }),
  ]);

  // Tedarikçi başına kaç elbise ve rafta ne kadar para duruyor.
  const stats = new Map<string, { count: number; units: number; value: number }>();
  for (const p of products) {
    if (!p.supplier_id) continue;
    const s = stats.get(p.supplier_id) ?? { count: 0, units: 0, value: 0 };
    s.count += 1;
    s.units += p.stock_quantity;
    s.value += p.stock_quantity * p.cost;
    stats.set(p.supplier_id, s);
  }

  const unassigned = products.filter((p) => !p.supplier_id).length;

  // Tedarikçi başına açık sipariş: kaç adet yolda ve parası ne kadar.
  const today = todayISO();
  const ordersBySupplier = new Map<string, typeof openOrders>();
  for (const o of openOrders) {
    const rows = ordersBySupplier.get(o.supplier_id) ?? [];
    rows.push(o);
    ordersBySupplier.set(o.supplier_id, rows);
  }

  return (
    <div className="animate-fade-in-up">
      <div className="mb-10">
        <h1 className="text-3xl lg:text-4xl font-extrabold text-stone-900 tracking-tight">Suppliers</h1>
        <p className="text-stone-500 mt-2 font-medium">
          {suppliers.length === 0
            ? "Who you buy your gowns from, and how long they take to deliver"
            : `${suppliers.length} ${suppliers.length === 1 ? "supplier" : "suppliers"}${
                unassigned > 0 ? ` · ${unassigned} gowns not linked to one` : ""
              }`}
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="bg-white/70 backdrop-blur-xl rounded-[2rem] border border-stone-200/60 shadow-sm p-6 h-fit">
          <h2 className="text-lg font-bold text-stone-900 mb-4">Add supplier</h2>
          <form action={createSupplier} className="flex flex-col gap-3">
            <Field label="Name *">
              <input name="name" required maxLength={120} className={INPUT} placeholder="e.g. Maggie Sottero" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Contact">
                <input name="contact_name" maxLength={120} className={INPUT} placeholder="Rep name" />
              </Field>
              <Field label="Lead time (days)">
                <input name="lead_time_days" type="number" min="0" max="730" className={INPUT} placeholder="120" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email">
                <input name="email" type="email" className={INPUT} placeholder="orders@..." />
              </Field>
              <Field label="Phone">
                <input name="phone" className={INPUT} placeholder="+1 555…" />
              </Field>
            </div>
            <Field label="Payment terms">
              <input name="payment_terms" maxLength={120} className={INPUT} placeholder="50% deposit, net 30" />
            </Field>
            <Field label="Notes">
              <textarea name="notes" rows={2} className={`${INPUT} resize-y`} placeholder="Optional…" />
            </Field>
            <button
              type="submit"
              className="mt-1 py-2.5 bg-stone-900 text-white rounded-xl text-sm font-semibold hover:bg-rose-600 transition-colors"
            >
              Add supplier
            </button>
          </form>
        </div>

        <div className="xl:col-span-2">
          {suppliers.length === 0 ? (
            <div className="bg-white/60 backdrop-blur-xl rounded-[2rem] border border-stone-200/60 shadow-sm p-16 text-center">
              <span className="flex items-center justify-center w-16 h-16 rounded-3xl bg-violet-50 text-violet-500 mx-auto mb-5 material-symbols-outlined text-[32px]">
                local_shipping
              </span>
              <h3 className="text-xl font-bold text-stone-900 mb-2">No suppliers yet</h3>
              <p className="text-stone-500 max-w-md mx-auto">
                Add the designers and wholesalers you order from. Lead times here become the delivery
                dates you promise your brides.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {suppliers.map((s) => {
                const stat = stats.get(s.id) ?? { count: 0, units: 0, value: 0 };
                return (
                  <div
                    key={s.id}
                    className={`bg-white/70 backdrop-blur-xl rounded-2xl border border-stone-200/60 shadow-sm p-5 ${
                      s.is_active ? "" : "opacity-60"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-11 h-11 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-violet-500 text-[20px]">local_shipping</span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-stone-900">{s.name}</h3>
                          {!s.is_active && (
                            <span className="text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-stone-100 text-stone-500">
                              Inactive
                            </span>
                          )}
                          {s.lead_time_days !== null && (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                              {s.lead_time_days} day lead time
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 mt-1 text-xs text-stone-500 flex-wrap">
                          {s.contact_name && <span>{s.contact_name}</span>}
                          {s.email && <span className="truncate">{s.email}</span>}
                          {s.phone && <span>{s.phone}</span>}
                          {s.payment_terms && <span className="text-stone-400">{s.payment_terms}</span>}
                        </div>

                        <p className="text-sm text-stone-600 mt-2">
                          {stat.count === 0 ? (
                            <span className="text-stone-400">No gowns linked yet</span>
                          ) : (
                            <>
                              <strong className="text-stone-800">{stat.count}</strong>{" "}
                              {stat.count === 1 ? "gown" : "gowns"} · {stat.units} in stock ·{" "}
                              {formatPrice(Math.round(stat.value))} at cost
                            </>
                          )}
                        </p>

                        {(() => {
                          const orders = ordersBySupplier.get(s.id) ?? [];
                          if (orders.length === 0) return null;
                          const units = orders.reduce((sum, o) => sum + summarize(o.lines).outstandingUnits, 0);
                          const value = orders.reduce((sum, o) => {
                            const t = summarize(o.lines);
                            return sum + (t.orderedCost - t.receivedCost);
                          }, 0);
                          const late = orders.filter((o) => isLate(o, o.lines, today));
                          return (
                            <div className="mt-2.5 rounded-2xl border border-stone-200/70 bg-stone-50/60 px-4 py-3">
                              <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
                                <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
                                  On order
                                </span>
                                <span className="text-xs text-stone-500">
                                  {units} {units === 1 ? "gown" : "gowns"} ·{" "}
                                  <span className="font-semibold text-stone-800">{formatPrice(Math.round(value))}</span>
                                  {late.length > 0 && (
                                    <span className="text-rose-600 font-semibold"> · {late.length} late</span>
                                  )}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {orders.slice(0, 4).map((o) => {
                                  const t = summarize(o.lines);
                                  return (
                                    <Link
                                      key={o.id}
                                      href={`/purchase-orders/${o.id}`}
                                      className={`text-[11px] font-semibold px-2 py-1 rounded-lg border transition-colors ${
                                        isLate(o, o.lines, today)
                                          ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                          : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                                      }`}
                                      title={o.expected_on ? `Expected ${o.expected_on}` : "No expected date"}
                                    >
                                      {o.ref_no} · {t.receivedUnits}/{t.orderedUnits}
                                    </Link>
                                  );
                                })}
                                {orders.length > 4 && (
                                  <span className="text-[11px] text-stone-400 px-1 py-1">
                                    +{orders.length - 4} more
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {s.notes && <p className="text-xs text-stone-400 mt-1.5">{s.notes}</p>}
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <form action={toggleSupplier}>
                          <input type="hidden" name="id" value={s.id} />
                          <input type="hidden" name="is_active" value={s.is_active ? "false" : "true"} />
                          <button
                            type="submit"
                            className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${
                              s.is_active ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"
                            }`}
                          >
                            {s.is_active ? "Active" : "Off"}
                          </button>
                        </form>
                        <form action={deleteSupplier}>
                          <input type="hidden" name="id" value={s.id} />
                          <button
                            type="submit"
                            title={stat.count > 0 ? "Has gowns — will be deactivated" : "Delete"}
                            className="text-xs text-stone-300 hover:text-rose-600 px-1.5 py-1"
                          >
                            ✕
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const INPUT =
  "w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-sm text-stone-900 outline-none focus:border-stone-400 transition-colors";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">{label}</label>
      {children}
    </div>
  );
}

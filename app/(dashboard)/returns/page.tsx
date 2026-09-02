import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import { formatPrice } from "@/config/modules";
import ModuleGuard from "@/components/module-guard";
import SelectField from "@/components/select-field";
import {
  RETURN_REASONS,
  RETURN_CONDITIONS,
  allowedTransitions,
  restockUnits,
} from "@/lib/inventory";
import { createReturn, updateReturnStatus } from "./actions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  forbidden: "You do not have permission to process returns.",
  required: "Pick at least a bride or a gown.",
  invalid: "That record does not belong to your boutique.",
  notfound: "That return no longer exists.",
  transition: "That return has already moved past this step.",
};

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-100",
  approved: "bg-sky-50 text-sky-700 border-sky-100",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-100",
  rejected: "bg-stone-100 text-stone-500 border-stone-200",
};

const ACTION_LABEL: Record<string, string> = {
  approved: "Approve",
  rejected: "Reject",
  completed: "Mark received",
};

type Props = { searchParams?: Promise<{ error?: string }> };

export default async function ReturnsPage({ searchParams }: Props) {
  const params = await searchParams;
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  return (
    <ModuleGuard moduleId="inventory" enabledModules={tenant.enabled_modules}>
      <ReturnsContent tenantId={tenant.id} error={params?.error} />
    </ModuleGuard>
  );
}

async function ReturnsContent({ tenantId, error }: { tenantId: string; error?: string }) {
  const [returns, customers, products, orders] = await Promise.all([
    prisma.productReturn.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: "desc" },
      take: 100,
      include: {
        customer: { select: { id: true, name: true } },
        product: { select: { id: true, name: true, image_url: true } },
        order: { select: { id: true, ref_no: true } },
      },
    }),
    prisma.customer.findMany({
      where: { tenant_id: tenantId },
      orderBy: { name: "asc" },
      take: 500,
      select: { id: true, name: true, email: true },
    }),
    prisma.product.findMany({
      where: { tenant_id: tenantId },
      orderBy: { name: "asc" },
      take: 500,
      select: { id: true, name: true, sku: true },
    }),
    prisma.order.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: "desc" },
      take: 200,
      select: { id: true, ref_no: true },
    }),
  ]);

  const open = returns.filter((r) => r.status === "pending" || r.status === "approved");
  const refundExposure = open.reduce((sum, r) => sum + r.refund_amount, 0);

  return (
    <div className="animate-fade-in-up">
      <div className="mb-10">
        <h1 className="text-3xl lg:text-4xl font-extrabold text-stone-900 tracking-tight">Returns</h1>
        <p className="text-stone-500 mt-2 font-medium">
          {open.length === 0
            ? "Gowns coming back — logged, approved, and put back on the rail"
            : `${open.length} open · ${formatPrice(Math.round(refundExposure))} in refunds pending`}
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-medium text-rose-700">
          {ERRORS[error] ?? "Something went wrong."}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="bg-white/70 backdrop-blur-xl rounded-[2rem] border border-stone-200/60 shadow-sm p-6 h-fit">
          <h2 className="text-lg font-bold text-stone-900 mb-4">Log a return</h2>
          <form action={createReturn} className="flex flex-col gap-3">
            <Field label="Bride">
              <SelectField
                name="customer_id"
                placeholder="Select a bride…"
                options={customers.map((c) => ({ value: c.id, label: c.name, hint: c.email ?? undefined }))}
              />
            </Field>
            <Field label="Gown">
              <SelectField
                name="product_id"
                placeholder="Select a gown…"
                options={products.map((p) => ({ value: p.id, label: p.name, hint: p.sku ?? undefined }))}
              />
            </Field>
            <Field label="Order (optional)">
              <SelectField
                name="order_id"
                placeholder="Link an order…"
                options={orders.map((o) => ({ value: o.id, label: o.ref_no }))}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Reason">
                <SelectField
                  name="reason"
                  defaultValue="sizing"
                  searchable={false}
                  options={RETURN_REASONS.map((r) => ({ value: r.id, label: r.label }))}
                />
              </Field>
              <Field label="Condition">
                <SelectField
                  name="condition"
                  defaultValue="resellable"
                  searchable={false}
                  options={RETURN_CONDITIONS.map((c) => ({ value: c.id, label: c.label }))}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Quantity">
                <input name="quantity" type="number" min="1" max="99" defaultValue={1} className={INPUT} />
              </Field>
              <Field label="Refund">
                <input name="refund_amount" type="number" step="0.01" min="0" placeholder="0" className={INPUT} />
              </Field>
            </div>

            <label className="flex items-center gap-2 text-sm text-stone-600 mt-1">
              <input type="checkbox" name="restock" defaultChecked className="w-4 h-4 rounded border-stone-300" />
              Put back on the rail when received
            </label>

            <Field label="Notes">
              <textarea name="notes" rows={2} className={`${INPUT} resize-y`} placeholder="Optional…" />
            </Field>

            <button
              type="submit"
              className="mt-1 py-2.5 bg-stone-900 text-white rounded-xl text-sm font-semibold hover:bg-rose-600 transition-colors"
            >
              Log return
            </button>
          </form>
        </div>

        <div className="xl:col-span-2">
          {returns.length === 0 ? (
            <div className="bg-white/60 backdrop-blur-xl rounded-[2rem] border border-stone-200/60 shadow-sm p-16 text-center">
              <span className="flex items-center justify-center w-16 h-16 rounded-3xl bg-violet-50 text-violet-500 mx-auto mb-5 material-symbols-outlined text-[32px]">
                swap_horiz
              </span>
              <h3 className="text-xl font-bold text-stone-900 mb-2">No returns logged</h3>
              <p className="text-stone-500 max-w-md mx-auto">
                Log every gown that comes back. Stock only moves when you mark it received, so an
                approved return never inflates your rail.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {returns.map((r) => {
                const units = restockUnits(r);
                const next = allowedTransitions(r.status);
                return (
                  <div key={r.id} className="bg-white/70 backdrop-blur-xl rounded-2xl border border-stone-200/60 shadow-sm p-5">
                    <div className="flex items-start gap-4">
                      {r.product?.image_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={r.product.image_url} alt={r.product.name} className="w-12 h-12 rounded-xl object-cover border border-stone-200 flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center flex-shrink-0">
                          <span className="material-symbols-outlined text-stone-400 text-[20px]">swap_horiz</span>
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-stone-900">
                            {r.product?.name ?? "Gown"}
                            {r.quantity > 1 && <span className="text-stone-400"> ×{r.quantity}</span>}
                          </h3>
                          <span className={`text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${STATUS_STYLE[r.status] ?? STATUS_STYLE.rejected}`}>
                            {r.status}
                          </span>
                        </div>

                        <p className="text-sm text-stone-600 mt-1">
                          {r.customer?.name ?? "Walk-in"}
                          {r.order && <span className="text-stone-400"> · {r.order.ref_no}</span>}
                          <span className="text-stone-400">
                            {" · "}
                            {RETURN_REASONS.find((x) => x.id === r.reason)?.label ?? r.reason}
                          </span>
                        </p>

                        <div className="flex items-center gap-3 mt-1.5 text-xs text-stone-400 flex-wrap">
                          <span>{r.created_at.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                          <span>{RETURN_CONDITIONS.find((x) => x.id === r.condition)?.label ?? r.condition}</span>
                          {r.refund_amount > 0 && (
                            <span className="text-stone-600 font-semibold">{formatPrice(Math.round(r.refund_amount))} refund</span>
                          )}
                          <span className={units > 0 ? "text-emerald-600 font-semibold" : "text-stone-400"}>
                            {units > 0 ? `+${units} back to stock` : "Not restocked"}
                          </span>
                        </div>

                        {r.notes && <p className="text-xs text-stone-400 mt-1.5">{r.notes}</p>}
                      </div>

                      {next.length > 0 && (
                        <div className="flex flex-col gap-1.5 flex-shrink-0">
                          {next.map((status) => (
                            <form key={status} action={updateReturnStatus}>
                              <input type="hidden" name="id" value={r.id} />
                              <input type="hidden" name="status" value={status} />
                              <button
                                type="submit"
                                className={`w-full text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                                  status === "rejected"
                                    ? "border border-stone-200 text-stone-500 hover:bg-stone-50"
                                    : "bg-stone-900 text-white hover:bg-rose-600"
                                }`}
                              >
                                {ACTION_LABEL[status] ?? status}
                              </button>
                            </form>
                          ))}
                        </div>
                      )}
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

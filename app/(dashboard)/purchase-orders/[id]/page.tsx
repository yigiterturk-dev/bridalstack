import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import { formatPrice } from "@/config/modules";
import { todayISO } from "@/lib/finance";
import ModuleGuard from "@/components/module-guard";
import SelectField from "@/components/select-field";
import {
  PO_STATUS_LABELS,
  canCancel,
  canCloseShort,
  canReceive,
  isEditable,
  isLate,
  summarize,
  type PoStatus,
} from "@/lib/purchasing";
import {
  addLine,
  cancelPurchaseOrder,
  closeShort,
  placeOrder,
  receiveLines,
  removeLine,
} from "../actions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  required: "Pick a gown.",
  invalid: "That gown does not belong to your boutique.",
  locked: "This order has already gone to the supplier — its lines are frozen.",
  transition: "This order has already moved past this step.",
  empty: "Add at least one gown before sending the order.",
  nothing: "Nothing new to receive.",
  received: "Stock has already come in on this order, so it cannot be cancelled.",
};

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-stone-100 text-stone-600 border-stone-200",
  ordered: "bg-amber-50 text-amber-700 border-amber-100",
  partial: "bg-sky-50 text-sky-700 border-sky-100",
  received: "bg-emerald-50 text-emerald-700 border-emerald-100",
  cancelled: "bg-stone-100 text-stone-500 border-stone-200",
};

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string }>;
};

export default async function PurchaseOrderPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  return (
    <ModuleGuard moduleId="inventory" enabledModules={tenant.enabled_modules}>
      <PurchaseOrderDetail tenantId={tenant.id} id={id} error={query?.error} />
    </ModuleGuard>
  );
}

async function PurchaseOrderDetail({
  tenantId,
  id,
  error,
}: {
  tenantId: string;
  id: string;
  error?: string;
}) {
  const today = todayISO();

  const po = await prisma.purchaseOrder.findFirst({
    where: { id, tenant_id: tenantId },
    include: {
      supplier: { select: { id: true, name: true, lead_time_days: true, payment_terms: true } },
      lines: { include: { product: { select: { id: true, name: true, sku: true, stock_quantity: true } } } },
    },
  });
  if (!po) notFound();

  const products = isEditable(po.status)
    ? await prisma.product.findMany({
        where: { tenant_id: tenantId },
        orderBy: { name: "asc" },
        take: 500,
        select: { id: true, name: true, sku: true, cost: true },
      })
    : [];

  const s = summarize(po.lines);
  const editable = isEditable(po.status);
  const receivable = canReceive(po.status);
  const overdue = isLate(po, po.lines, today);

  return (
    <div className="animate-fade-in-up">
      <Link href="/purchase-orders" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">
        ← Purchase orders
      </Link>

      <div className="mt-4 mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-3xl lg:text-4xl font-extrabold text-stone-900 tracking-tight">
              {po.supplier?.name ?? "Supplier"}
            </h1>
            <span className={`text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${STATUS_STYLE[po.status] ?? STATUS_STYLE.cancelled}`}>
              {PO_STATUS_LABELS[po.status as PoStatus] ?? po.status}
            </span>
            {overdue && (
              <span className="text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border bg-rose-50 text-rose-700 border-rose-100">
                late
              </span>
            )}
          </div>
          <p className="text-stone-500 mt-2 font-medium">
            {po.ref_no}
            {po.expected_on && <span className="text-stone-400"> · expected {po.expected_on}</span>}
            {po.supplier?.payment_terms && <span className="text-stone-400"> · {po.supplier.payment_terms}</span>}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {po.status === "draft" && (
            <form action={placeOrder}>
              <input type="hidden" name="po_id" value={po.id} />
              <button
                type="submit"
                className="px-4 py-2 bg-stone-900 text-white rounded-xl text-sm font-semibold hover:bg-rose-600 transition-colors"
              >
                Send to supplier
              </button>
            </form>
          )}
          {canCloseShort(po.status, po.lines) && (
            <form action={closeShort}>
              <input type="hidden" name="po_id" value={po.id} />
              <button
                type="submit"
                className="px-4 py-2 border border-stone-200 text-stone-600 rounded-xl text-sm font-semibold hover:bg-stone-50 transition-colors"
              >
                Close short
              </button>
            </form>
          )}
          {canCancel(po.status, po.lines) && (
            <form action={cancelPurchaseOrder}>
              <input type="hidden" name="po_id" value={po.id} />
              <button
                type="submit"
                className="px-4 py-2 border border-stone-200 text-stone-500 rounded-xl text-sm font-semibold hover:bg-stone-50 transition-colors"
              >
                Cancel
              </button>
            </form>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-medium text-rose-700">
          {ERRORS[error] ?? "Something went wrong."}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="Gowns ordered" value={String(s.orderedUnits)} />
        <Stat label="Received" value={`${s.receivedUnits} / ${s.orderedUnits}`} />
        <Stat label="Order value" value={formatPrice(Math.round(s.orderedCost))} />
        <Stat
          label={po.status === "received" ? "Booked to cash" : "Received value"}
          value={formatPrice(Math.round(s.receivedCost))}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {editable && (
          <div className="bg-white/70 backdrop-blur-xl rounded-[2rem] border border-stone-200/60 shadow-sm p-6 h-fit">
            <h2 className="text-lg font-bold text-stone-900 mb-4">Add a gown</h2>
            <form action={addLine} className="flex flex-col gap-3">
              <input type="hidden" name="po_id" value={po.id} />
              <Field label="Gown">
                <SelectField
                  name="product_id"
                  required
                  placeholder="Select a gown…"
                  options={products.map((p) => ({
                    value: p.id,
                    label: p.name,
                    hint: p.sku ?? undefined,
                  }))}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Quantity">
                  <input name="ordered_qty" type="number" min="1" max="999" defaultValue={1} className={INPUT} />
                </Field>
                <Field label="Unit cost">
                  <input name="unit_cost" type="number" step="0.01" min="0" placeholder="From product" className={INPUT} />
                </Field>
              </div>
              <p className="text-xs text-stone-400 leading-relaxed">
                Leave the cost empty to use the gown&apos;s stored cost. Adding a gown that is already
                on the order raises its quantity instead of listing it twice.
              </p>
              <button
                type="submit"
                className="mt-1 py-2.5 bg-stone-900 text-white rounded-xl text-sm font-semibold hover:bg-rose-600 transition-colors"
              >
                Add to order
              </button>
            </form>
          </div>
        )}

        <div className={editable ? "xl:col-span-2" : "xl:col-span-3"}>
          {po.lines.length === 0 ? (
            <div className="bg-white/60 backdrop-blur-xl rounded-[2rem] border border-stone-200/60 shadow-sm p-16 text-center">
              <span className="flex items-center justify-center w-16 h-16 rounded-3xl bg-violet-50 text-violet-500 mx-auto mb-5 material-symbols-outlined text-[32px]">
                checkroom
              </span>
              <h3 className="text-xl font-bold text-stone-900 mb-2">Nothing on this order yet</h3>
              <p className="text-stone-500 max-w-md mx-auto">
                Add the gowns you are buying, then send the order. It cannot go out empty.
              </p>
            </div>
          ) : (
            <form action={receiveLines} className="bg-white/70 backdrop-blur-xl rounded-[2rem] border border-stone-200/60 shadow-sm overflow-hidden">
              <input type="hidden" name="po_id" value={po.id} />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-200/60 text-left">
                      <Th>Gown</Th>
                      <Th className="text-right">Ordered</Th>
                      <Th className="text-right">Received</Th>
                      <Th className="text-right">Unit cost</Th>
                      <Th className="text-right">Line</Th>
                      {(editable || receivable) && <Th className="text-right">{receivable ? "Receive" : ""}</Th>}
                    </tr>
                  </thead>
                  <tbody>
                    {po.lines.map((line) => {
                      const done = line.received_qty >= line.ordered_qty;
                      return (
                        <tr key={line.id} className="border-b border-stone-100 last:border-0">
                          <td className="px-5 py-3">
                            <div className="font-semibold text-stone-900">{line.product?.name ?? "Gown"}</div>
                            <div className="text-xs text-stone-400">
                              {line.product?.sku ?? "—"} · {line.product?.stock_quantity ?? 0} on the rail
                            </div>
                          </td>
                          <td className="px-5 py-3 text-right text-stone-600">{line.ordered_qty}</td>
                          <td className={`px-5 py-3 text-right font-semibold ${done ? "text-emerald-600" : "text-stone-600"}`}>
                            {line.received_qty}
                          </td>
                          <td className="px-5 py-3 text-right text-stone-600">
                            {formatPrice(Math.round(line.unit_cost))}
                          </td>
                          <td className="px-5 py-3 text-right font-semibold text-stone-900">
                            {formatPrice(Math.round(line.ordered_qty * line.unit_cost))}
                          </td>
                          {(editable || receivable) && (
                            <td className="px-5 py-3 text-right">
                              {receivable && !done && (
                                <input
                                  name={`recv_${line.id}`}
                                  type="number"
                                  min={line.received_qty}
                                  max={line.ordered_qty}
                                  placeholder={String(line.received_qty)}
                                  className="w-20 px-3 py-1.5 rounded-lg border border-stone-200 bg-white text-sm text-right text-stone-900 outline-none focus:border-stone-400 transition-colors"
                                />
                              )}
                              {editable && (
                                <button
                                  type="submit"
                                  formAction={removeLine}
                                  name="line_id"
                                  value={line.id}
                                  className="text-xs font-semibold text-stone-400 hover:text-rose-600 transition-colors"
                                >
                                  Remove
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {receivable && (
                <div className="flex items-center justify-between gap-4 px-5 py-4 border-t border-stone-200/60 bg-stone-50/50 flex-wrap">
                  <p className="text-xs text-stone-500 max-w-md leading-relaxed">
                    Type the running total you have received, not what arrived today. The rail only
                    moves by the difference, so submitting twice never doubles your stock. The order
                    closes on its own once every gown is in, and only then does the cost hit the drawer.
                    Each product&rsquo;s cost is re-averaged over the stock you already hold; lines with no
                    unit cost leave it untouched.
                  </p>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-stone-900 text-white rounded-xl text-sm font-semibold hover:bg-rose-600 transition-colors"
                  >
                    Receive stock
                  </button>
                </div>
              )}
            </form>
          )}

          {po.notes && (
            <p className="mt-4 text-sm text-stone-500 bg-white/60 rounded-2xl border border-stone-200/60 px-5 py-3">
              {po.notes}
            </p>
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

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-5 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide ${className}`}>
      {children}
    </th>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-stone-200/60 shadow-sm px-5 py-4">
      <div className="text-xs font-semibold text-stone-500 uppercase tracking-wide">{label}</div>
      <div className="text-xl font-extrabold text-stone-900 mt-1">{value}</div>
    </div>
  );
}

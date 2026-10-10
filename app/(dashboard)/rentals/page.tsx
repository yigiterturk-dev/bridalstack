import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import { formatPrice } from "@/config/modules";
import { todayISO } from "@/lib/finance";
import { normalizeTimeZone } from "@/lib/timezone";
import ModuleGuard from "@/components/module-guard";
import SelectField from "@/components/select-field";
import SubmitButton from "@/components/submit-button";
import {
  RENTAL_STATUS_LABELS,
  allowedTransitions,
  isOverdue,
  lateDays,
  outstandingLateFee,
  type RentalStatus,
} from "@/lib/rentals";
import { collectLateFee, createRental, updateRentalStatus } from "./actions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  forbidden: "You do not have permission to manage rentals.",
  required: "Pick a bride and a gown.",
  range: "The return date cannot be before the pickup date.",
  invalid: "That record does not belong to your boutique.",
  conflict: "That gown is already promised to someone on those dates.",
  notfound: "That rental no longer exists.",
  transition: "That rental has already moved past this step.",
  nolatefee: "Nothing is owed on that rental.",
};

const STATUS_STYLE: Record<string, string> = {
  reserved: "bg-amber-50 text-amber-700 border-amber-100",
  out: "bg-sky-50 text-sky-700 border-sky-100",
  returned: "bg-emerald-50 text-emerald-700 border-emerald-100",
  cancelled: "bg-stone-100 text-stone-500 border-stone-200",
};

const ACTION_LABEL: Record<string, string> = {
  out: "Hand over",
  returned: "Check back in",
  cancelled: "Cancel",
};

type Props = { searchParams?: Promise<{ error?: string }> };

export default async function RentalsPage({ searchParams }: Props) {
  const params = await searchParams;
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  return (
    <ModuleGuard moduleId="inventory" enabledModules={tenant.enabled_modules}>
      <RentalsContent tenantId={tenant.id} timeZone={normalizeTimeZone(tenant.settings.time_zone)} error={params?.error} />
    </ModuleGuard>
  );
}

async function RentalsContent({ tenantId, timeZone, error }: { tenantId: string; timeZone: string; error?: string }) {
  const today = todayISO(new Date(), timeZone);

  const [rentals, customers, products, orders] = await Promise.all([
    prisma.rental.findMany({
      where: { tenant_id: tenantId },
      orderBy: [{ status: "asc" }, { due_date: "asc" }],
      take: 150,
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

  // Geciken kiralamalar en başa: kaybolan elbise listenin dibinde kalmasın.
  const sorted = [...rentals].sort((a, b) => {
    const rank = (r: typeof a) => (isOverdue(r, today) ? 0 : r.status === "out" ? 1 : r.status === "reserved" ? 2 : 3);
    return rank(a) - rank(b) || a.due_date.localeCompare(b.due_date);
  });

  const out = rentals.filter((r) => r.status === "out");
  const overdue = out.filter((r) => isOverdue(r, today));
  const feesDue = overdue.reduce((sum, r) => sum + outstandingLateFee(r, today), 0);

  return (
    <div className="animate-fade-in-up">
      <div className="mb-10">
        <h1 className="text-3xl lg:text-4xl font-extrabold text-stone-900 tracking-tight">Rentals</h1>
        <p className="text-stone-500 mt-2 font-medium">
          {out.length === 0
            ? "Gowns out on loan — booked, handed over, and checked back in"
            : `${out.length} out${overdue.length > 0 ? ` · ${overdue.length} overdue · ${formatPrice(Math.round(feesDue))} in late fees` : ""}`}
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-medium text-rose-700">
          {ERRORS[error] ?? "Something went wrong."}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="bg-white/70 backdrop-blur-xl rounded-[2rem] border border-stone-200/60 shadow-sm p-6 h-fit">
          <h2 className="text-lg font-bold text-stone-900 mb-4">Book a rental</h2>
          <form action={createRental} className="flex flex-col gap-3">
            <Field label="Bride" htmlFor="customer_id-select">
              <SelectField
                name="customer_id"
                required
                placeholder="Select a bride…"
                options={customers.map((c) => ({ value: c.id, label: c.name, hint: c.email ?? undefined }))}
              />
            </Field>
            <Field label="Gown" htmlFor="product_id-select">
              <SelectField
                name="product_id"
                required
                placeholder="Select a gown…"
                options={products.map((p) => ({ value: p.id, label: p.name, hint: p.sku ?? undefined }))}
              />
            </Field>
            <Field label="Order (optional)" htmlFor="order_id-select">
              <SelectField
                name="order_id"
                placeholder="Link an order…"
                options={orders.map((o) => ({ value: o.id, label: o.ref_no }))}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
                <Field label="Pickup" htmlFor="rental-start-date">
                <input id="rental-start-date" name="start_date" type="date" required defaultValue={today} className={INPUT} />
              </Field>
              <Field label="Due back" htmlFor="rental-due-date">
                <input id="rental-due-date" name="due_date" type="date" required className={INPUT} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Rental fee" htmlFor="rental-fee">
                <input id="rental-fee" name="rental_fee" type="number" step="0.01" min="0" placeholder="0" className={INPUT} />
              </Field>
              <Field label="Deposit (held)" htmlFor="rental-deposit">
                <input id="rental-deposit" name="deposit" type="number" step="0.01" min="0" placeholder="0" className={INPUT} />
              </Field>
            </div>

            <Field label="Late fee per day" htmlFor="rental-late-fee">
              <input id="rental-late-fee" name="late_fee_per_day" type="number" step="0.01" min="0" placeholder="0" className={INPUT} />
            </Field>

            <Field label="Notes" htmlFor="rental-notes">
              <textarea id="rental-notes" name="notes" rows={2} className={`${INPUT} resize-y`} placeholder="Optional…" />
            </Field>

            <p className="text-xs text-stone-400 leading-relaxed">
              Booking holds the dates. The gown only leaves the rail when you hand it over, and the
              deposit is a hold — it never lands in the drawer.
            </p>

            <SubmitButton
              pendingLabel="Booking rental…"
              className="mt-1 py-2.5 bg-stone-900 text-white rounded-xl text-sm font-semibold hover:bg-rose-600 transition-colors disabled:opacity-60 disabled:cursor-wait"
            >
              Book rental
            </SubmitButton>
          </form>
        </div>

        <div className="xl:col-span-2">
          {rentals.length === 0 ? (
            <div className="bg-white/60 backdrop-blur-xl rounded-[2rem] border border-stone-200/60 shadow-sm p-16 text-center">
              <span className="flex items-center justify-center w-16 h-16 rounded-3xl bg-violet-50 text-violet-500 mx-auto mb-5 material-symbols-outlined text-[32px]">
                event_available
              </span>
              <h3 className="text-xl font-bold text-stone-900 mb-2">No rentals booked</h3>
              <p className="text-stone-500 max-w-md mx-auto">
                Book a gown for a date range and the calendar is held — the same gown can never be
                promised to two brides for the same weekend.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {sorted.map((r) => {
                const late = lateDays(r, today);
                const fee = outstandingLateFee(r, today);
                const next = allowedTransitions(r.status);
                return (
                  <div
                    key={r.id}
                    className={`bg-white/70 backdrop-blur-xl rounded-2xl border shadow-sm p-5 ${
                      isOverdue(r, today) ? "border-rose-200" : "border-stone-200/60"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {r.product?.image_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={r.product.image_url} alt={r.product.name} className="w-12 h-12 rounded-xl object-cover border border-stone-200 flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center flex-shrink-0">
                          <span className="material-symbols-outlined text-stone-400 text-[20px]">checkroom</span>
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-stone-900">{r.product?.name ?? "Gown"}</h3>
                          <span className={`text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${STATUS_STYLE[r.status] ?? STATUS_STYLE.cancelled}`}>
                            {RENTAL_STATUS_LABELS[r.status as RentalStatus] ?? r.status}
                          </span>
                          {isOverdue(r, today) && (
                            <span className="text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border bg-rose-50 text-rose-700 border-rose-100">
                              {late} {late === 1 ? "day" : "days"} late
                            </span>
                          )}
                        </div>

                        <p className="text-sm text-stone-600 mt-1">
                          {r.customer?.name ?? "Walk-in"}
                          {r.order && <span className="text-stone-400"> · {r.order.ref_no}</span>}
                        </p>

                        <div className="flex items-center gap-3 mt-1.5 text-xs text-stone-400 flex-wrap">
                          <span>
                            {r.start_date} → {r.due_date}
                          </span>
                          {r.rental_fee > 0 && (
                            <span className="text-stone-600 font-semibold">{formatPrice(Math.round(r.rental_fee))} fee</span>
                          )}
                          {r.deposit > 0 && <span>{formatPrice(Math.round(r.deposit))} deposit held</span>}
                          {r.returned_on && <span className="text-emerald-600">Back {r.returned_on}</span>}
                        </div>

                        {r.notes && <p className="text-xs text-stone-400 mt-1.5">{r.notes}</p>}

                        {fee > 0 && (
                          <form action={collectLateFee} className="mt-2.5 flex items-center gap-2">
                            <input type="hidden" name="id" value={r.id} />
                            <span className="text-xs font-semibold text-rose-700">
                              {formatPrice(Math.round(fee))} late fee due
                            </span>
                            <button
                              type="submit"
                              className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 transition-colors"
                            >
                              Collect to cash
                            </button>
                          </form>
                        )}
                      </div>

                      {next.length > 0 && (
                        <div className="flex flex-col gap-1.5 flex-shrink-0 w-36">
                          {next.map((status) => (
                            <form key={status} action={updateRentalStatus}>
                              <input type="hidden" name="id" value={r.id} />
                              <input type="hidden" name="status" value={status} />
                              {status === "returned" && (
                                <label className="flex items-center gap-1.5 text-[11px] text-stone-500 mb-1.5">
                                  <input type="checkbox" name="needs_cleaning" defaultChecked className="w-3.5 h-3.5 rounded border-stone-300" />
                                  Send to cleaning
                                </label>
                              )}
                              <button
                                type="submit"
                                className={`w-full text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                                  status === "cancelled"
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

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">{label}</label>
      {children}
    </div>
  );
}

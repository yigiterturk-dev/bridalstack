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
  CLEANING_STATUS_LABELS,
  allowedTransitions,
  isOverdue,
  sourceLabel,
  type CleaningStatus,
} from "@/lib/cleaning";
import { createCleaningJob, updateCleaningStatus } from "./actions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  forbidden: "You do not have permission to manage cleaning.",
  required: "Pick a gown.",
  invalid: "That record does not belong to your boutique.",
  nostock: "That gown is not on the rail right now.",
  notfound: "That cleaning job no longer exists.",
  transition: "That job has already moved past this step.",
};

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-100",
  sent: "bg-sky-50 text-sky-700 border-sky-100",
  returned: "bg-emerald-50 text-emerald-700 border-emerald-100",
  written_off: "bg-stone-100 text-stone-500 border-stone-200",
};

const ACTION_LABEL: Record<string, string> = {
  sent: "Send out",
  returned: "Back on the rail",
  written_off: "Write off",
};

type Props = { searchParams?: Promise<{ error?: string }> };

export default async function CleaningPage({ searchParams }: Props) {
  const params = await searchParams;
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  return (
    <ModuleGuard moduleId="inventory" enabledModules={tenant.enabled_modules}>
      <CleaningContent tenantId={tenant.id} timeZone={normalizeTimeZone(tenant.settings.time_zone)} error={params?.error} />
    </ModuleGuard>
  );
}

async function CleaningContent({ tenantId, timeZone, error }: { tenantId: string; timeZone: string; error?: string }) {
  const today = todayISO(new Date(), timeZone);

  const [jobs, products] = await Promise.all([
    prisma.cleaningJob.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: "desc" },
      take: 150,
      include: {
        product: { select: { id: true, name: true, image_url: true } },
        customer: { select: { id: true, name: true } },
      },
    }),
    prisma.product.findMany({
      where: { tenant_id: tenantId, stock_quantity: { gt: 0 } },
      orderBy: { name: "asc" },
      take: 500,
      select: { id: true, name: true, sku: true, stock_quantity: true },
    }),
  ]);

  const open = jobs.filter((j) => j.status === "pending" || j.status === "sent");
  const offRail = open.reduce((sum, j) => sum + j.quantity, 0);
  const late = open.filter((j) => isOverdue(j, today));

  return (
    <div className="animate-fade-in-up">
      <div className="mb-10">
        <h1 className="text-3xl lg:text-4xl font-extrabold text-stone-900 tracking-tight">Cleaning</h1>
        <p className="text-stone-500 mt-2 font-medium">
          {open.length === 0
            ? "Gowns at the cleaner — off the rail until they come back"
            : `${offRail} off the rail${late.length > 0 ? ` · ${late.length} overdue at the cleaner` : ""}`}
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-medium text-rose-700">
          {ERRORS[error] ?? "Something went wrong."}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="bg-white/70 backdrop-blur-xl rounded-[2rem] border border-stone-200/60 shadow-sm p-6 h-fit">
          <h2 className="text-lg font-bold text-stone-900 mb-4">Send a gown out</h2>
          <form action={createCleaningJob} className="flex flex-col gap-3">
            <Field label="Gown" htmlFor="product_id-select">
              <SelectField
                name="product_id"
                required
                placeholder="Select a gown on the rail…"
                options={products.map((p) => ({
                  value: p.id,
                  label: p.name,
                  hint: `${p.stock_quantity} on the rail`,
                }))}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Quantity" htmlFor="cleaning-quantity">
                <input id="cleaning-quantity" name="quantity" type="number" min="1" max="99" defaultValue={1} className={INPUT} />
              </Field>
              <Field label="Cost" htmlFor="cleaning-cost">
                <input id="cleaning-cost" name="cost" type="number" step="0.01" min="0" placeholder="0" className={INPUT} />
              </Field>
            </div>

            <Field label="Cleaner" htmlFor="cleaning-vendor">
              <input id="cleaning-vendor" name="vendor" type="text" placeholder="Who is cleaning it?" className={INPUT} />
            </Field>
            <Field label="Expected back" htmlFor="cleaning-expected-on">
              <input id="cleaning-expected-on" name="expected_on" type="date" className={INPUT} />
            </Field>
            <Field label="Notes" htmlFor="cleaning-notes">
              <textarea id="cleaning-notes" name="notes" rows={2} className={`${INPUT} resize-y`} placeholder="Optional…" />
            </Field>

            <p className="text-xs text-stone-400 leading-relaxed">
              The gown leaves the rail the moment you log it and comes back only when you mark it
              returned. Returns and rentals open their own jobs — those gowns are already off the rail.
            </p>

            <SubmitButton
              pendingLabel="Saving cleaning job…"
              className="mt-1 py-2.5 bg-stone-900 text-white rounded-xl text-sm font-semibold hover:bg-rose-600 transition-colors disabled:opacity-60 disabled:cursor-wait"
            >
              Send to cleaning
            </SubmitButton>
          </form>
        </div>

        <div className="xl:col-span-2">
          {jobs.length === 0 ? (
            <div className="bg-white/60 backdrop-blur-xl rounded-[2rem] border border-stone-200/60 shadow-sm p-16 text-center">
              <span className="flex items-center justify-center w-16 h-16 rounded-3xl bg-violet-50 text-violet-500 mx-auto mb-5 material-symbols-outlined text-[32px]">
                local_laundry_service
              </span>
              <h3 className="text-xl font-bold text-stone-900 mb-2">Nothing at the cleaner</h3>
              <p className="text-stone-500 max-w-md mx-auto">
                Every dirty gown lands here — sent out by hand, or opened automatically when a return
                or a rental comes back soiled. None of them counts as stock until it is back.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {jobs.map((j) => {
                const next = allowedTransitions(j.status);
                return (
                  <div
                    key={j.id}
                    className={`bg-white/70 backdrop-blur-xl rounded-2xl border shadow-sm p-5 ${
                      isOverdue(j, today) ? "border-rose-200" : "border-stone-200/60"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {j.product?.image_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={j.product.image_url} alt={j.product.name} className="w-12 h-12 rounded-xl object-cover border border-stone-200 flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center flex-shrink-0">
                          <span className="material-symbols-outlined text-stone-400 text-[20px]">local_laundry_service</span>
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-stone-900">
                            {j.product?.name ?? "Gown"}
                            {j.quantity > 1 && <span className="text-stone-400"> ×{j.quantity}</span>}
                          </h3>
                          <span className={`text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${STATUS_STYLE[j.status] ?? STATUS_STYLE.written_off}`}>
                            {CLEANING_STATUS_LABELS[j.status as CleaningStatus] ?? j.status}
                          </span>
                          {isOverdue(j, today) && (
                            <span className="text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border bg-rose-50 text-rose-700 border-rose-100">
                              overdue
                            </span>
                          )}
                        </div>

                        <p className="text-sm text-stone-600 mt-1">
                          {sourceLabel(j.source)}
                          {j.customer && <span className="text-stone-400"> · {j.customer.name}</span>}
                          {j.vendor && <span className="text-stone-400"> · {j.vendor}</span>}
                        </p>

                        <div className="flex items-center gap-3 mt-1.5 text-xs text-stone-400 flex-wrap">
                          {j.sent_on && <span>Sent {j.sent_on}</span>}
                          {j.expected_on && <span>Expected {j.expected_on}</span>}
                          {j.returned_on && <span className="text-emerald-600">Back {j.returned_on}</span>}
                          {j.cost > 0 && (
                            <span className="text-stone-600 font-semibold">{formatPrice(Math.round(j.cost))} cost</span>
                          )}
                        </div>

                        {j.notes && <p className="text-xs text-stone-400 mt-1.5">{j.notes}</p>}
                      </div>

                      {next.length > 0 && (
                        <div className="flex flex-col gap-1.5 flex-shrink-0 w-36">
                          {next.map((status) => (
                            <form key={status} action={updateCleaningStatus}>
                              <input type="hidden" name="id" value={j.id} />
                              <input type="hidden" name="status" value={status} />
                              <button
                                type="submit"
                                className={`w-full text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                                  status === "written_off"
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

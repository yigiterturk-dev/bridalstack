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
  ALTERATION_KINDS,
  ALTERATION_STATUS_LABELS,
  allowedTransitions,
  isOpen,
  isOverdue,
  kindLabel,
  urgencyKey,
  type AlterationStatus,
} from "@/lib/alterations";
import { createAlteration, updateAlterationStatus } from "./actions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  forbidden: "You do not have permission to manage alterations.",
  required: "Pick a bride.",
  invalid: "That record does not belong to your boutique.",
  notfound: "That alteration no longer exists.",
  transition: "That job has already moved past this step.",
};

const STATUS_STYLE: Record<string, string> = {
  requested: "bg-amber-50 text-amber-700 border-amber-100",
  in_progress: "bg-sky-50 text-sky-700 border-sky-100",
  ready: "bg-violet-50 text-violet-700 border-violet-100",
  delivered: "bg-emerald-50 text-emerald-700 border-emerald-100",
  cancelled: "bg-stone-100 text-stone-500 border-stone-200",
};

const ACTION_LABEL: Record<string, string> = {
  in_progress: "Start work",
  ready: "Mark ready",
  delivered: "Hand over",
  cancelled: "Cancel",
};

type Props = { searchParams?: Promise<{ error?: string }> };

export default async function AlterationsPage({ searchParams }: Props) {
  const params = await searchParams;
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  return (
    <ModuleGuard moduleId="inventory" enabledModules={tenant.enabled_modules}>
      <AlterationsContent tenantId={tenant.id} timeZone={normalizeTimeZone(tenant.settings.time_zone)} error={params?.error} />
    </ModuleGuard>
  );
}

async function AlterationsContent({ tenantId, timeZone, error }: { tenantId: string; timeZone: string; error?: string }) {
  const today = todayISO(new Date(), timeZone);

  const [jobs, customers, products, orders] = await Promise.all([
    prisma.alteration.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: "desc" },
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

  // Geciken işler en başta, sonra söz verilen güne göre.
  const sorted = [...jobs].sort((a, b) => urgencyKey(a, today).localeCompare(urgencyKey(b, today)));

  const open = jobs.filter((j) => isOpen(j.status));
  const late = open.filter((j) => isOverdue(j, today));
  const owed = open.reduce((sum, j) => sum + j.price, 0);

  return (
    <div className="animate-fade-in-up">
      <div className="mb-10">
        <h1 className="text-3xl lg:text-4xl font-extrabold text-stone-900 tracking-tight">Alterations</h1>
        <p className="text-stone-500 mt-2 font-medium">
          {open.length === 0
            ? "Fittings and tailoring — from the pin to the handover"
            : `${open.length} on the table${late.length > 0 ? ` · ${late.length} past the promised date` : ""} · ${formatPrice(Math.round(owed))} to collect`}
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-medium text-rose-700">
          {ERRORS[error] ?? "Something went wrong."}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="bg-white/70 backdrop-blur-xl rounded-[2rem] border border-stone-200/60 shadow-sm p-6 h-fit">
          <h2 className="text-lg font-bold text-stone-900 mb-4">Log an alteration</h2>
          <form action={createAlteration} className="flex flex-col gap-3">
            <Field label="Bride" htmlFor="customer_id-select">
              <SelectField
                name="customer_id"
                required
                placeholder="Select a bride…"
                options={customers.map((c) => ({ value: c.id, label: c.name, hint: c.email ?? undefined }))}
              />
            </Field>
            <Field label="Gown (optional)" htmlFor="product_id-select">
              <SelectField
                name="product_id"
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

            <Field label="Work" htmlFor="kind-select">
              <SelectField
                name="kind"
                defaultValue="hem"
                searchable={false}
                options={ALTERATION_KINDS.map((k) => ({ value: k.id, label: k.label }))}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Fitting" htmlFor="alteration-fitting-date">
                <input id="alteration-fitting-date" name="fitting_date" type="date" className={INPUT} />
              </Field>
              <Field label="Promised" htmlFor="alteration-promised-date">
                <input id="alteration-promised-date" name="promised_date" type="date" className={INPUT} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Seamstress" htmlFor="alteration-seamstress">
                <input id="alteration-seamstress" name="seamstress" type="text" placeholder="Who is sewing?" className={INPUT} />
              </Field>
              <Field label="Price" htmlFor="alteration-price">
                <input id="alteration-price" name="price" type="number" step="0.01" min="0" placeholder="0" className={INPUT} />
              </Field>
            </div>

            <Field label="Notes" htmlFor="alteration-notes">
              <textarea id="alteration-notes" name="notes" rows={2} className={`${INPUT} resize-y`} placeholder="Optional…" />
            </Field>

            <p className="text-xs text-stone-400 leading-relaxed">
              The price only lands in the drawer when the bride takes the gown — a job that is ready
              but not collected is not money yet.
            </p>

            <SubmitButton
              pendingLabel="Saving alteration…"
              className="mt-1 py-2.5 bg-stone-900 text-white rounded-xl text-sm font-semibold hover:bg-rose-600 transition-colors disabled:opacity-60 disabled:cursor-wait"
            >
              Log alteration
            </SubmitButton>
          </form>
        </div>

        <div className="xl:col-span-2">
          {jobs.length === 0 ? (
            <div className="bg-white/60 backdrop-blur-xl rounded-[2rem] border border-stone-200/60 shadow-sm p-16 text-center">
              <span className="flex items-center justify-center w-16 h-16 rounded-3xl bg-violet-50 text-violet-500 mx-auto mb-5 material-symbols-outlined text-[32px]">
                content_cut
              </span>
              <h3 className="text-xl font-bold text-stone-900 mb-2">No alterations logged</h3>
              <p className="text-stone-500 max-w-md mx-auto">
                Every hem, bustle and bead. Give each one a promised date and the ones running late
                climb to the top of this list on their own.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {sorted.map((j) => {
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
                          <span className="material-symbols-outlined text-stone-400 text-[20px]">content_cut</span>
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-stone-900">{j.customer?.name ?? "Bride"}</h3>
                          <span className={`text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${STATUS_STYLE[j.status] ?? STATUS_STYLE.cancelled}`}>
                            {ALTERATION_STATUS_LABELS[j.status as AlterationStatus] ?? j.status}
                          </span>
                          {isOverdue(j, today) && (
                            <span className="text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border bg-rose-50 text-rose-700 border-rose-100">
                              past promised
                            </span>
                          )}
                        </div>

                        <p className="text-sm text-stone-600 mt-1">
                          {kindLabel(j.kind)}
                          {j.product && <span className="text-stone-400"> · {j.product.name}</span>}
                          {j.order && <span className="text-stone-400"> · {j.order.ref_no}</span>}
                        </p>

                        <div className="flex items-center gap-3 mt-1.5 text-xs text-stone-400 flex-wrap">
                          {j.fitting_date && <span>Fitting {j.fitting_date}</span>}
                          {j.promised_date && <span>Promised {j.promised_date}</span>}
                          {j.seamstress && <span>{j.seamstress}</span>}
                          {j.price > 0 && (
                            <span className="text-stone-600 font-semibold">{formatPrice(Math.round(j.price))}</span>
                          )}
                        </div>

                        {j.notes && <p className="text-xs text-stone-400 mt-1.5">{j.notes}</p>}
                      </div>

                      {next.length > 0 && (
                        <div className="flex flex-col gap-1.5 flex-shrink-0 w-32">
                          {next.map((status) => (
                            <form key={status} action={updateAlterationStatus}>
                              <input type="hidden" name="id" value={j.id} />
                              <input type="hidden" name="status" value={status} />
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

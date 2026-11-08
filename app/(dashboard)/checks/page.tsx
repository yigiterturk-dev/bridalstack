import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import { formatPrice } from "@/config/modules";
import ModuleGuard from "@/components/module-guard";
import SelectField from "@/components/select-field";
import {
  summarizeChecks,
  checkTransitions,
  isOutstandingCheck,
  CHECK_STATUS_LABELS,
  todayISO,
  type CheckRow,
} from "@/lib/finance";
import { createCheck, moveCheck, deleteCheck } from "./actions";
import ConfirmSubmitButton from "@/components/confirm-submit-button";
import { normalizeTimeZone } from "@/lib/timezone";
import EmptyState from "@/components/empty-state";
import AddPanel from "@/components/add-panel";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  forbidden: "Only the owner can manage checks.",
  required: "Who wrote the check?",
  amount: "Enter an amount greater than zero.",
  date: "Pick a due date.",
  invalid: "That record does not belong to your boutique.",
  transition: "That check has already moved past this step.",
  notfound: "That check no longer exists.",
};

const STATUS_STYLE: Record<string, string> = {
  portfolio: "bg-stone-100 text-stone-600 border-stone-200",
  deposited: "bg-sky-50 text-sky-700 border-sky-100",
  cleared: "bg-emerald-50 text-emerald-700 border-emerald-100",
  bounced: "bg-gold-soft text-gold border-gold/30",
  cancelled: "bg-stone-100 text-stone-400 border-stone-200",
};

const ACTION_LABEL: Record<string, string> = {
  deposited: "Deposit",
  cleared: "Cleared",
  bounced: "Bounced",
  cancelled: "Cancel",
};

type Props = { searchParams?: Promise<{ error?: string }> };

export default async function ChecksPage({ searchParams }: Props) {
  const params = await searchParams;
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  return (
    <ModuleGuard moduleId="finance" enabledModules={tenant.enabled_modules}>
      <ChecksContent tenantId={tenant.id} timeZone={normalizeTimeZone(tenant.settings.time_zone)} error={params?.error} />
    </ModuleGuard>
  );
}

async function ChecksContent({ tenantId, timeZone, error }: { tenantId: string; timeZone: string; error?: string }) {
  const [checks, customers] = await Promise.all([
    prisma.check.findMany({
      where: { tenant_id: tenantId },
      orderBy: [{ due_date: "asc" }],
      take: 300,
    }),
    prisma.customer.findMany({
      where: { tenant_id: tenantId },
      orderBy: { name: "asc" },
      take: 500,
      select: { id: true, name: true },
    }),
  ]);

  const summary = summarizeChecks(checks as CheckRow[]);
  const today = todayISO(new Date(), timeZone);

  const outstanding = checks.filter((c) => isOutstandingCheck(c.status));
  const settled = checks.filter((c) => !isOutstandingCheck(c.status));

  return (
    <div className="animate-fade-in-up">
      <div className="mb-8">
        <h1 className="text-3xl lg:text-4xl font-serif font-normal text-[var(--ink)]">Checks</h1>
        <p className="text-[var(--muted)] mt-2 font-medium">
          {outstanding.length === 0
            ? "No checks waiting to clear"
            : `${outstanding.length} outstanding · ${formatPrice(Math.round(summary.incoming))} coming in`}
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-gold/30 bg-gold-soft px-5 py-3 text-sm font-medium text-gold">
          {ERRORS[error] ?? "Something went wrong."}
        </div>
      )}

      {(summary.incoming > 0 || summary.outgoing > 0 || summary.dueThisWeek > 0 || summary.overdue > 0) && (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <Stat label="Incoming" value={formatPrice(Math.round(summary.incoming))} tone="emerald" />
        <Stat label="Outgoing" value={formatPrice(Math.round(summary.outgoing))} tone={summary.outgoing > 0 ? "rose" : undefined} />
        <Stat label="Due this week" value={formatPrice(Math.round(summary.dueThisWeek))} />
        <Stat label="Past due" value={formatPrice(Math.round(summary.overdue))} tone={summary.overdue > 0 ? "rose" : undefined} />
      </div>
      )}

      <div className="flex flex-col gap-6">
        <AddPanel title="Log a check">
          <form id="new" action={createCheck} className="scroll-mt-24 flex flex-col gap-3">
            <Field label="Direction">
              <SelectField
                name="direction"
                defaultValue="received"
                searchable={false}
                options={[
                  { value: "received", label: "Received from a bride" },
                  { value: "issued", label: "Written by us" },
                ]}
              />
            </Field>

            <Field label="Written by *">
              <input name="counterparty" required maxLength={120} className={INPUT} placeholder="Name on the check" />
            </Field>

            <Field label="Bride (optional)">
              <SelectField
                name="customer_id"
                placeholder="Link a bride…"
                options={customers.map((c) => ({ value: c.id, label: c.name }))}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount *">
                <input name="amount" type="number" step="0.01" min="0.01" required className={INPUT} placeholder="0.00" />
              </Field>
              <Field label="Due date *">
                <input name="due_date" type="date" required defaultValue={today} className={INPUT} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Bank">
                <input name="bank" maxLength={80} className={INPUT} placeholder="Optional" />
              </Field>
              <Field label="Check no">
                <input name="check_no" maxLength={40} className={INPUT} placeholder="Optional" />
              </Field>
            </div>

            <Field label="Notes">
              <input name="notes" maxLength={160} className={INPUT} placeholder="Optional" />
            </Field>

            <button
              type="submit"
              className="mt-1 py-2.5 bg-stone-900 text-white rounded-xl text-sm font-semibold hover:bg-gold transition-colors"
            >
              Add check
            </button>
          </form>
        </AddPanel>

        <div>
          {checks.length === 0 ? (
            <EmptyState icon="request_quote" action={{ href: "#new", label: "Log a check" }} title="No checks logged">
              A check only becomes money in the ledger when you mark it cleared — and if it bounces, that entry comes straight back out.
            </EmptyState>
          ) : (
            <div className="flex flex-col gap-6">
              <Section title="Waiting" checks={outstanding} today={today} />
              <Section title="Settled" checks={settled} today={today} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  checks,
  today,
}: {
  title: string;
  checks: {
    id: string; direction: string; counterparty: string; bank: string | null; check_no: string | null;
    amount: number; due_date: string; status: string; notes: string | null;
  }[];
  today: string;
}) {
  if (checks.length === 0) return null;

  return (
    <div>
      <h2 className="text-sm font-serif font-normal text-[var(--muted)] uppercase tracking-wider mb-4">{title}</h2>
      <div className="flex flex-col gap-2">
        {checks.map((c) => {
          const late = isOutstandingCheck(c.status) && c.due_date < today;
          const next = checkTransitions(c.status);
          return (
            <div key={c.id} className="bg-white rounded-2xl border border-[var(--line)] shadow-sm p-4 flex items-center gap-4 flex-wrap">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  c.direction === "issued" ? "bg-gold-soft text-gold" : "bg-emerald-50 text-emerald-600"
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">request_quote</span>
              </div>

              <div className="flex-1 min-w-[180px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-[var(--ink)]">{c.counterparty}</span>
                  <span className={`text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${STATUS_STYLE[c.status]}`}>
                    {CHECK_STATUS_LABELS[c.status] ?? c.status}
                  </span>
                  {late && (
                    <span className="text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-gold-soft text-gold border border-gold/30">
                      past due
                    </span>
                  )}
                </div>
                <div className="text-xs text-stone-400 mt-0.5">
                  due {c.due_date}
                  {c.bank && ` · ${c.bank}`}
                  {c.check_no && ` · #${c.check_no}`}
                  {c.notes && ` · ${c.notes}`}
                </div>
              </div>

              <div className={`text-lg font-bold tabular-nums ${c.direction === "issued" ? "text-gold" : "text-[var(--ink)]"}`}>
                {c.direction === "issued" ? "−" : "+"}
                {formatPrice(Math.round(c.amount))}
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                {next.map((status) => (
                  <form key={status} action={moveCheck}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="status" value={status} />
                    <button
                      type="submit"
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                        status === "cleared"
                          ? "bg-stone-900 text-white hover:bg-gold"
                          : "border border-stone-200 text-stone-600 hover:bg-stone-50"
                      }`}
                    >
                      {ACTION_LABEL[status] ?? status}
                    </button>
                  </form>
                ))}
                {next.length === 0 && (
                  <form action={deleteCheck}>
                    <input type="hidden" name="id" value={c.id} />
                    <ConfirmSubmitButton
                      message={`Delete check from ${c.counterparty}? This cannot be undone.`}
                      ariaLabel={`Delete check from ${c.counterparty}`}
                      title="Delete check"
                      className="text-xs text-stone-300 hover:text-gold px-1.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 focus-visible:ring-offset-2"
                    >
                      <span aria-hidden="true">✕</span>
                    </ConfirmSubmitButton>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </div>
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

function Stat({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "rose" }) {
  const color = tone === "emerald" ? "text-emerald-600" : tone === "rose" ? "text-gold" : "text-[var(--ink)]";
  return (
    <div className="bg-white rounded-2xl border border-[var(--line)] shadow-sm px-5 py-4">
      <div className="text-[11px] font-bold uppercase tracking-wide text-stone-400">{label}</div>
      <div className={`text-2xl font-extrabold tabular-nums mt-1 ${color}`}>{value}</div>
    </div>
  );
}

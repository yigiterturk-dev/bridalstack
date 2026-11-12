import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import { formatPrice } from "@/config/modules";
import ModuleGuard from "@/components/module-guard";
import ConfirmSubmitButton from "@/components/confirm-submit-button";
import { deriveStatus, daysUntilDue } from "@/lib/installments";
import { payInstallment, unpayInstallment } from "./actions";
import EmptyState from "@/components/empty-state";
import { usDay } from "@/lib/us-date";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  forbidden: "You do not have permission to collect payments.",
  notfound: "That installment no longer exists.",
};

const FILTERS = [
  { id: "open", label: "Open" },
  { id: "overdue", label: "Overdue" },
  { id: "paid", label: "Paid" },
  { id: "all", label: "All" },
];

const STATUS_STYLE: Record<string, string> = {
  overdue: "bg-late-soft text-late border-late/30",
  due: "bg-amber-50 text-amber-700 border-amber-100",
  pending: "bg-stone-100 text-stone-600 border-stone-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-100",
  cancelled: "bg-stone-100 text-stone-400 border-stone-200",
};

type Props = { searchParams?: Promise<{ filter?: string; error?: string }> };

export default async function InstallmentsPage({ searchParams }: Props) {
  const params = await searchParams;
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  return (
    <ModuleGuard moduleId="finance" enabledModules={tenant.enabled_modules}>
      <InstallmentsContent tenantId={tenant.id} filter={params?.filter} error={params?.error} />
    </ModuleGuard>
  );
}

async function InstallmentsContent({
  tenantId,
  filter = "open",
  error,
}: {
  tenantId: string;
  filter?: string;
  error?: string;
}) {
  const rows = await prisma.installment.findMany({
    where: { tenant_id: tenantId },
    orderBy: [{ due_date: "asc" }],
    take: 500,
    include: {
      customer: { select: { id: true, name: true } },
      order: { select: { id: true, ref_no: true } },
    },
  });

  const withStatus = rows.map((r) => ({
    ...r,
    derived: deriveStatus({ due_date: r.due_date, paid_at: r.paid_at?.toISOString() ?? null, status: r.status as never }),
    days: daysUntilDue(r.due_date),
  }));

  const visible = withStatus.filter((r) => {
    if (filter === "all") return true;
    if (filter === "paid") return r.derived === "paid";
    if (filter === "overdue") return r.derived === "overdue";
    return r.derived !== "paid" && r.derived !== "cancelled";
  });

  const openRows = withStatus.filter((r) => r.derived !== "paid" && r.derived !== "cancelled");
  const outstanding = openRows.reduce((s, r) => s + r.amount, 0);
  const overdue = openRows.filter((r) => r.derived === "overdue").reduce((s, r) => s + r.amount, 0);
  const dueSoon = openRows.filter((r) => r.derived === "due").reduce((s, r) => s + r.amount, 0);

  return (
    <div className="animate-fade-in-up">
      <div className="mb-8">
        <h1 className="text-3xl lg:text-4xl font-serif font-normal text-[var(--ink)]">Payment plans</h1>
        <p className="text-[var(--muted)] mt-2 font-medium">
          {openRows.length === 0
            ? "Every payment plan is settled"
            : `${formatPrice(Math.round(outstanding))} still to collect across ${openRows.length} payments`}
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-gold/30 bg-gold-soft px-5 py-3 text-sm font-medium text-gold">
          {ERRORS[error] ?? "Something went wrong."}
        </div>
      )}

      {(outstanding > 0 || overdue > 0 || dueSoon > 0) && (
      <div className="grid grid-cols-3 gap-3 mb-8">
        <Stat label="Outstanding" value={formatPrice(Math.round(outstanding))} />
        <Stat label="Overdue" value={formatPrice(Math.round(overdue))} tone={overdue > 0 ? "rose" : undefined} />
        <Stat label="Due within 3 days" value={formatPrice(Math.round(dueSoon))} />
      </div>
      )}

      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            href={`/installments?filter=${f.id}`}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
              filter === f.id
                ? "bg-stone-900 text-white"
                : "bg-white border border-stone-200 text-stone-600 hover:border-stone-300"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState icon="receipt" action={{ href: "/orders", label: "Go to orders" }} title="Nothing here">
          Payment plans are created on an order. Once a bride is on a plan, every instalment shows up here on its due date.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl border border-[var(--line)] shadow-sm p-4 flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-[var(--ink)]">
                    {r.customer ? (
                      <Link href={`/customers/${r.customer.id}`} className="hover:text-gold">
                        {r.customer.name}
                      </Link>
                    ) : (
                      "Customer"
                    )}
                  </span>
                  <span className={`text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${STATUS_STYLE[r.derived]}`}>
                    {r.derived}
                  </span>
                </div>
                <div className="text-xs text-stone-400 mt-0.5">
                  {r.order && (
                    <Link href={`/orders/${r.order.id}`} className="hover:text-stone-700">
                      {r.order.ref_no}
                    </Link>
                  )}
                  {r.order && " · "}
                  Payment {r.installment_no}/{r.total_count} · due {usDay(r.due_date)}
                  {r.derived === "overdue" && ` · ${Math.abs(r.days)} days late`}
                </div>
              </div>

              <div className="text-right">
                <div className="text-lg font-bold tabular-nums text-[var(--ink)]">
                  {formatPrice(Math.round(r.amount))}
                </div>
                {r.paid_at && (
                  <div className="text-[11px] text-stone-400">
                    paid {r.paid_at.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </div>
                )}
              </div>

              <div className="flex-shrink-0">
                {r.derived === "paid" ? (
                  <form action={unpayInstallment}>
                    <input type="hidden" name="id" value={r.id} />
                    <ConfirmSubmitButton
                      message="Undo this payment? The cash entry and order balance will be reversed."
                      pendingLabel="Undoing…"
                      ariaLabel="Undo payment"
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-stone-200 text-[var(--muted)] hover:bg-stone-50 disabled:opacity-60 disabled:cursor-wait"
                    >
                      Undo
                    </ConfirmSubmitButton>
                  </form>
                ) : r.derived === "cancelled" ? (
                  <span className="text-xs text-stone-400 px-3">Cancelled</span>
                ) : (
                  <form action={payInstallment} className="flex items-center gap-1.5">
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="method" value="cash" />
                    <ConfirmSubmitButton
                      message={`Mark ${formatPrice(Math.round(r.amount))} as collected in cash?`}
                      pendingLabel="Saving…"
                      ariaLabel={`Mark ${formatPrice(Math.round(r.amount))} as collected`}
                      className="text-xs font-semibold px-3.5 py-2 rounded-lg bg-stone-900 text-white hover:bg-gold disabled:opacity-60 disabled:cursor-wait"
                    >
                      Mark collected
                    </ConfirmSubmitButton>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "rose" }) {
  return (
    <div className="bg-white rounded-2xl border border-[var(--line)] shadow-sm px-5 py-4">
      <div className="text-[11px] font-bold uppercase tracking-wide text-stone-400">{label}</div>
      <div className={`text-2xl font-extrabold tabular-nums mt-1 ${tone === "rose" ? "text-gold" : "text-[var(--ink)]"}`}>
        {value}
      </div>
    </div>
  );
}

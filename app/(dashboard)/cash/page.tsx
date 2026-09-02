import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import { formatPrice } from "@/config/modules";
import ModuleGuard from "@/components/module-guard";
import {
  summarize,
  groupByMethod,
  categoryLabel,
  CASH_METHODS,
  todayISO,
  type Movement,
} from "@/lib/finance";
import {
  DRAWER_METHOD,
  carryOver,
  expectedFor,
  variance,
  verdict,
} from "@/lib/cash-session";
import MovementForm from "./movement-form";
import { closeCashSession, deleteMovement, openCashSession } from "./actions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  forbidden: "Only the owner can open the register.",
  amount: "Enter an amount greater than zero.",
  invalid: "That entry was not valid.",
  linked: "This came from an installment or a check — undo it at the source instead.",
  notfound: "That entry no longer exists.",
  session_exists: "This day is already open.",
  session_closed: "This day has already been counted.",
  count: "Enter how much cash you counted.",
};

type Props = { searchParams?: Promise<{ date?: string; error?: string }> };

export default async function CashPage({ searchParams }: Props) {
  const params = await searchParams;
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  return (
    <ModuleGuard moduleId="finance" enabledModules={tenant.enabled_modules}>
      <CashContent tenantId={tenant.id} date={params?.date} error={params?.error} />
    </ModuleGuard>
  );
}

async function CashContent({ tenantId, date, error }: { tenantId: string; date?: string; error?: string }) {
  const today = /^\d{4}-\d{2}-\d{2}$/.test(date ?? "") ? (date as string) : todayISO();

  const [movements, session, previous] = await Promise.all([
    prisma.cashMovement.findMany({
      where: { tenant_id: tenantId, occurred_on: today },
      orderBy: { created_at: "desc" },
    }),
    prisma.cashSession.findFirst({ where: { tenant_id: tenantId, business_date: today } }),
    prisma.cashSession.findFirst({
      where: { tenant_id: tenantId, business_date: { lt: today } },
      orderBy: { business_date: "desc" },
      select: { status: true, opening_float: true, counted_close: true, expected_close: true },
    }),
  ]);

  const day = summarize(movements as Movement[]);
  const byMethod = groupByMethod(movements as Movement[]);
  const cashOnly = byMethod.find((m) => m.method === "cash")?.net ?? 0;

  // Çekmecede sadece nakit vardır; sayım yalnız bu hareketlere bakar.
  const drawerMovements = movements.filter((m) => m.method === DRAWER_METHOD);
  const expected = session ? expectedFor(session, drawerMovements) : null;
  const diff = session ? variance(session, drawerMovements) : null;
  const state = verdict(diff);
  const suggestedFloat = carryOver(previous);

  return (
    <div className="animate-fade-in-up">
      <div className="mb-10">
        <h1 className="text-3xl lg:text-4xl font-extrabold text-stone-900 tracking-tight">Cash register</h1>
        <p className="text-stone-500 mt-2 font-medium">
          {new Date(`${today}T00:00:00Z`).toLocaleDateString("en-US", {
            weekday: "long", month: "long", day: "numeric", timeZone: "UTC",
          })}
          {" · "}
          {day.count === 0 ? "nothing recorded yet" : `${day.count} ${day.count === 1 ? "entry" : "entries"}`}
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-medium text-rose-700">
          {ERRORS[error] ?? "Something went wrong."}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <Stat label="In" value={formatPrice(Math.round(day.inflow))} tone="emerald" />
        <Stat label="Out" value={formatPrice(Math.round(day.outflow))} tone={day.outflow > 0 ? "rose" : undefined} />
        <Stat label="Net" value={formatPrice(Math.round(day.net))} />
        <Stat label="In the drawer" value={formatPrice(Math.round(cashOnly))} hint="cash only" />
      </div>

      <div className="bg-white/70 backdrop-blur-xl rounded-[2rem] border border-stone-200/60 shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <h2 className="text-lg font-bold text-stone-900">Till count</h2>
          {session && (
            <span
              className={`text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                session.status === "open"
                  ? "bg-amber-50 text-amber-700 border-amber-100"
                  : state === "exact"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                    : "bg-rose-50 text-rose-700 border-rose-100"
              }`}
            >
              {session.status === "open" ? "Open" : state === "exact" ? "Balanced" : state}
            </span>
          )}
        </div>

        {!session ? (
          <form action={openCashSession} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="business_date" value={today} />
            <div>
              <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">
                Cash in the drawer this morning
              </label>
              <input
                name="opening_float"
                type="number"
                step="0.01"
                min="0"
                placeholder={String(suggestedFloat)}
                className="w-48 px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-sm text-stone-900 outline-none focus:border-stone-400 transition-colors"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 bg-stone-900 text-white rounded-xl text-sm font-semibold hover:bg-rose-600 transition-colors"
            >
              Open the day
            </button>
            <p className="text-xs text-stone-400 flex-1 min-w-[16rem] leading-relaxed">
              Leave it empty to carry over what was counted last time
              {suggestedFloat > 0 ? ` (${formatPrice(Math.round(suggestedFloat))})` : ""}. Only cash
              counts — card and transfer payments never reach the drawer.
            </p>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Stat label="Opening float" value={formatPrice(Math.round(session.opening_float))} />
              <Stat label="Cash movements" value={formatPrice(Math.round(cashOnly))} hint="cash only" />
              <Stat
                label={session.status === "closed" ? "Expected (frozen)" : "Expected now"}
                value={formatPrice(Math.round(expected ?? 0))}
              />
              {session.status === "closed" ? (
                <Stat
                  label="Counted"
                  value={formatPrice(Math.round(session.counted_close ?? 0))}
                  tone={state === "exact" ? "emerald" : "rose"}
                />
              ) : (
                <Stat label="Counted" value="—" hint="not counted yet" />
              )}
            </div>

            {session.status === "open" ? (
              <form action={closeCashSession} className="flex flex-wrap items-end gap-3 pt-1">
                <input type="hidden" name="id" value={session.id} />
                <div>
                  <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">
                    Cash counted now
                  </label>
                  <input
                    name="counted_close"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    className="w-48 px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-sm text-stone-900 outline-none focus:border-stone-400 transition-colors"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-stone-600 pb-2.5">
                  <input type="checkbox" name="post_variance" defaultChecked className="w-4 h-4 rounded border-stone-300" />
                  Write the difference to the ledger
                </label>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-stone-900 text-white rounded-xl text-sm font-semibold hover:bg-rose-600 transition-colors"
                >
                  Close the day
                </button>
                <p className="text-xs text-stone-400 flex-1 min-w-[16rem] leading-relaxed">
                  What the drawer should hold is worked out and frozen at this moment — a movement
                  back-dated to today later on will never change this count.
                </p>
              </form>
            ) : (
              <div
                className={`rounded-2xl border px-5 py-3 text-sm font-medium ${
                  state === "exact"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-rose-200 bg-rose-50 text-rose-700"
                }`}
              >
                {state === "exact"
                  ? "The drawer balanced to the penny."
                  : `The drawer was ${formatPrice(Math.abs(Math.round(diff ?? 0)))} ${state === "over" ? "over" : "short"}.`}
                {session.notes && <span className="text-stone-500"> · {session.notes}</span>}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="bg-white/70 backdrop-blur-xl rounded-[2rem] border border-stone-200/60 shadow-sm p-6 h-fit">
          <h2 className="text-lg font-bold text-stone-900 mb-4">New entry</h2>
          <MovementForm today={today} back="/cash" />
        </div>

        <div className="xl:col-span-2">
          {movements.length === 0 ? (
            <div className="bg-white/60 backdrop-blur-xl rounded-[2rem] border border-stone-200/60 shadow-sm p-16 text-center">
              <span className="flex items-center justify-center w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 mx-auto mb-5 material-symbols-outlined text-[32px]">
                account_balance
              </span>
              <h3 className="text-xl font-bold text-stone-900 mb-2">Nothing today</h3>
              <p className="text-stone-500 max-w-md mx-auto">
                Every deposit, balance and expense you record here rolls straight into the ledger.
                Installment payments land here on their own.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 mb-4">
                {byMethod.map((m) => (
                  <span
                    key={m.method}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full bg-white border border-stone-200 text-stone-600"
                  >
                    {m.label}: <span className="tabular-nums text-stone-900">{formatPrice(Math.round(m.net))}</span>
                  </span>
                ))}
              </div>

              <div className="flex flex-col gap-2">
                {movements.map((m) => (
                  <div key={m.id} className="bg-white/70 backdrop-blur-xl rounded-2xl border border-stone-200/60 shadow-sm p-4 flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        m.direction === "out" ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {m.direction === "out" ? "arrow_outward" : "south_west"}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-stone-900">
                        {categoryLabel(m.direction, m.category)}
                        {(m.installment_id || m.check_id) && (
                          <span className="ml-2 text-[11px] font-bold uppercase tracking-wide text-stone-400">auto</span>
                        )}
                      </div>
                      <div className="text-xs text-stone-400 truncate">
                        {CASH_METHODS.find((x) => x.id === m.method)?.label ?? m.method}
                        {m.description && ` · ${m.description}`}
                      </div>
                    </div>

                    <div
                      className={`text-lg font-bold tabular-nums flex-shrink-0 ${
                        m.direction === "out" ? "text-rose-600" : "text-stone-900"
                      }`}
                    >
                      {m.direction === "out" ? "−" : "+"}
                      {formatPrice(Math.round(m.amount))}
                    </div>

                    {!m.installment_id && !m.check_id && (
                      <form action={deleteMovement} className="flex-shrink-0">
                        <input type="hidden" name="id" value={m.id} />
                        <input type="hidden" name="back" value="/cash" />
                        <button type="submit" className="text-xs text-stone-300 hover:text-rose-600 px-1.5">✕</button>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone, hint }: { label: string; value: string; tone?: "emerald" | "rose"; hint?: string }) {
  const color = tone === "emerald" ? "text-emerald-600" : tone === "rose" ? "text-rose-600" : "text-stone-900";
  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-stone-200/60 shadow-sm px-5 py-4">
      <div className="text-[11px] font-bold uppercase tracking-wide text-stone-400">{label}</div>
      <div className={`text-2xl font-extrabold tabular-nums mt-1 ${color}`}>{value}</div>
      {hint && <div className="text-[11px] text-stone-400 mt-0.5">{hint}</div>}
    </div>
  );
}

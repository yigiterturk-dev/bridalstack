import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import { formatPrice } from "@/config/modules";
import ModuleGuard from "@/components/module-guard";
import SelectField from "@/components/select-field";
import { createRule, toggleRule, deleteRule } from "../actions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  forbidden: "Only the owner can change commission rules.",
  required: "Give the rule a name.",
  staff: "Pick whose rule this is.",
  empty: "A rule needs a percentage or a flat amount.",
};

type Props = { searchParams?: Promise<{ error?: string }> };

export default async function RulesPage({ searchParams }: Props) {
  const params = await searchParams;
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  return (
    <ModuleGuard moduleId="commissions" enabledModules={tenant.enabled_modules}>
      <RulesContent tenantId={tenant.id} error={params?.error} />
    </ModuleGuard>
  );
}

async function RulesContent({ tenantId, error }: { tenantId: string; error?: string }) {
  const [rules, members, orders] = await Promise.all([
    prisma.commissionRule.findMany({
      where: { tenant_id: tenantId },
      orderBy: [{ is_active: "desc" }, { priority: "desc" }, { name: "asc" }],
    }),
    prisma.tenantMember.findMany({
      where: { tenant_id: tenantId },
      select: { display_name: true, user: { select: { name: true, email: true } } },
    }),
    prisma.order.findMany({
      where: { tenant_id: tenantId, sales_person: { not: null } },
      select: { sales_person: true },
      take: 500,
    }),
  ]);

  // Kural yazılacak isimler: ekip listesi + siparişlerde geçen satışçı adları.
  const names = new Set<string>();
  for (const m of members) {
    const label = (m.display_name || m.user.name || m.user.email || "").trim();
    if (label) names.add(label);
  }
  for (const o of orders) {
    const label = (o.sales_person ?? "").trim();
    if (label) names.add(label);
  }
  const staffOptions = [...names].sort().map((n) => ({ value: n, label: n }));

  return (
    <div className="animate-fade-in-up">
      <Link href="/commissions" className="text-sm text-stone-500 hover:text-stone-900 inline-flex items-center gap-1 mb-4">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span> Commissions
      </Link>

      <div className="mb-10">
        <h1 className="text-3xl lg:text-4xl font-extrabold text-stone-900 tracking-tight">Commission rules</h1>
        <p className="text-stone-500 mt-2 font-medium">
          When two rules fit one order, the higher priority wins — and a rule written for one
          stylist beats the shop-wide rule at the same priority.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-medium text-rose-700">
          {ERRORS[error] ?? "Something went wrong."}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="bg-white/70 backdrop-blur-xl rounded-[2rem] border border-stone-200/60 shadow-sm p-6 h-fit">
          <h2 className="text-lg font-bold text-stone-900 mb-4">New rule</h2>
          <form action={createRule} className="flex flex-col gap-3">
            <Field label="Name *">
              <input name="name" required maxLength={80} className={INPUT} placeholder="e.g. Standard 5%" />
            </Field>

            <Field label="Applies to">
              <SelectField
                name="scope"
                defaultValue="all"
                searchable={false}
                options={[
                  { value: "all", label: "Everyone" },
                  { value: "staff", label: "One stylist" },
                ]}
              />
            </Field>

            <Field label="Stylist (only for a one-stylist rule)">
              {staffOptions.length > 0 ? (
                <SelectField name="staff_name" placeholder="Select…" options={staffOptions} />
              ) : (
                <input name="staff_name" className={INPUT} placeholder="Name as written on orders" />
              )}
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Rate %">
                <input name="rate_percent" type="number" step="0.1" min="0" max="100" className={INPUT} placeholder="5" />
              </Field>
              <Field label="Flat bonus">
                <input name="flat_amount" type="number" step="0.01" min="0" className={INPUT} placeholder="0" />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Minimum order">
                <input name="min_order_total" type="number" step="0.01" min="0" className={INPUT} placeholder="0" />
              </Field>
              <Field label="Priority">
                <input name="priority" type="number" min="0" max="999" className={INPUT} placeholder="0" />
              </Field>
            </div>

            <button
              type="submit"
              className="mt-1 py-2.5 bg-stone-900 text-white rounded-xl text-sm font-semibold hover:bg-rose-600 transition-colors"
            >
              Add rule
            </button>
          </form>
        </div>

        <div className="xl:col-span-2">
          {rules.length === 0 ? (
            <div className="bg-white/60 backdrop-blur-xl rounded-[2rem] border border-stone-200/60 shadow-sm p-16 text-center">
              <span className="flex items-center justify-center w-16 h-16 rounded-3xl bg-amber-50 text-amber-500 mx-auto mb-5 material-symbols-outlined text-[32px]">
                rule
              </span>
              <h3 className="text-xl font-bold text-stone-900 mb-2">No rules yet</h3>
              <p className="text-stone-500 max-w-md mx-auto">
                Most boutiques start with one shop-wide percentage, then add a better rate for the
                stylist who closes the big gowns.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {rules.map((r) => (
                <div
                  key={r.id}
                  className={`bg-white/70 backdrop-blur-xl rounded-2xl border border-stone-200/60 shadow-sm p-5 flex items-center gap-4 ${
                    r.is_active ? "" : "opacity-60"
                  }`}
                >
                  <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-amber-600 text-[20px]">rule</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-stone-900">{r.name}</h3>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                        {r.scope === "staff" ? r.staff_name : "Everyone"}
                      </span>
                      {r.priority > 0 && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-100">
                          priority {r.priority}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-stone-600 mt-1">
                      {r.rate_percent > 0 && <strong className="text-stone-900">{r.rate_percent}%</strong>}
                      {r.rate_percent > 0 && r.flat_amount > 0 && " + "}
                      {r.flat_amount > 0 && <strong className="text-stone-900">{formatPrice(r.flat_amount)}</strong>}
                      {r.min_order_total > 0 && (
                        <span className="text-stone-400"> · orders over {formatPrice(r.min_order_total)}</span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <form action={toggleRule}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="is_active" value={r.is_active ? "false" : "true"} />
                      <button
                        type="submit"
                        className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${
                          r.is_active ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"
                        }`}
                      >
                        {r.is_active ? "Active" : "Off"}
                      </button>
                    </form>
                    <form action={deleteRule}>
                      <input type="hidden" name="id" value={r.id} />
                      <button type="submit" className="text-xs text-stone-300 hover:text-rose-600 px-1.5 py-1">✕</button>
                    </form>
                  </div>
                </div>
              ))}
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

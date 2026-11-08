import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant, getCurrentUserId } from "@/lib/tenant";
import { calculateMonthlyPrice, formatPrice, type PackId } from "@/config/modules";
import { isDemoTenant } from "@/lib/demo-identity";
import { switchTenant, createLocation } from "./actions";
import PageHead, { BTN_PRIMARY, BTN_SECONDARY } from "@/components/page-head";
import AddPanel from "@/components/add-panel";
import { ListBox } from "@/components/list-row";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  forbidden: "You do not have access to that location.",
  demo: "The demo account cannot create locations. Create your own account to add a shop.",
  limit: "You have reached the location limit for this account.",
};

export default async function LocationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const [memberships, active, params] = await Promise.all([
    prisma.tenantMember.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "asc" },
      select: {
        tenant_id: true,
        role: true,
        tenant: { select: { id: true, name: true, packs: true, plan: true } },
      },
    }),
    getCurrentTenant(),
    searchParams ?? Promise.resolve({} as { error?: string }),
  ]);

  const error = params.error ? ERRORS[params.error] : null;
  const demo = active ? isDemoTenant(active) : true;

  return (
    <div className="max-w-3xl">
      <PageHead
        title="Locations"
        sub="Each shop has its own customers, stock, orders, team and subscription"
      />

      {error && (
        <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-late">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-6">
        <ListBox>
          {memberships.map((m) => {
            const current = m.tenant_id === active?.id;
            const price = calculateMonthlyPrice((m.tenant.packs ?? []) as PackId[]);
            return (
              <div key={m.tenant_id} className="flex items-center gap-4 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {current && <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-gold" />}
                    <span className="truncate font-medium text-[var(--ink)]">{m.tenant.name}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-[var(--muted)]">
                    {current ? "You are here · " : ""}
                    {price > 0 ? `${formatPrice(price)}/mo` : "Free plan"} · {m.role}
                  </p>
                </div>
                {current ? (
                  <Link href="/dashboard" className={BTN_SECONDARY}>Open</Link>
                ) : (
                  <form action={switchTenant}>
                    <input type="hidden" name="tenantId" value={m.tenant_id} />
                    <button type="submit" className={BTN_PRIMARY}>Switch here</button>
                  </form>
                )}
              </div>
            );
          })}
        </ListBox>

        {!demo && (
          <AddPanel title="Add a location">
            <form action={createLocation} className="flex flex-col gap-3">
              <div>
                <label htmlFor="location-name" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Location name
                </label>
                <input
                  id="location-name"
                  name="name"
                  required
                  minLength={2}
                  maxLength={80}
                  placeholder="e.g. Bridal Stack — Austin"
                  className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-[var(--ink)] outline-none transition-colors focus:border-stone-400"
                />
              </div>
              <p className="text-sm text-[var(--muted)]">
                Starts on the free plan with a 30-day trial of every paid module. You can switch back any time.
              </p>
              <button type="submit" className={`${BTN_PRIMARY} justify-center`}>Add location</button>
            </form>
          </AddPanel>
        )}

        <p className="text-sm text-[var(--muted)]">
          Need a multi-location discount or shared customers across shops?{" "}
          <a href="mailto:hello@bridalstack.com?subject=Multi-location%20BridalStack" className="text-[var(--ink)] underline">
            Talk to us
          </a>
          .
        </p>
      </div>
    </div>
  );
}

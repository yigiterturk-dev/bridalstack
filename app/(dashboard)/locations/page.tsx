import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant, getCurrentUserId } from "@/lib/tenant";
import { calculateMonthlyPrice, formatPrice, type PackId } from "@/config/modules";
import { isDemoTenant } from "@/lib/demo-identity";
import { switchTenant, createLocation } from "./actions";

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
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-normal text-[var(--ink)] lg:text-4xl">Locations</h1>
        <p className="mt-1.5 text-[var(--muted)]">
          Each location is its own workspace: its own customers, stock, orders and team.
          Billing is per location, so every shop carries its own subscription.
        </p>
      </div>

      {error && (
        <div role="alert" className="mb-6 rounded-xl border border-gold/30 bg-gold-soft px-4 py-3 text-sm text-gold">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {memberships.map((m) => {
          const current = m.tenant_id === active?.id;
          const price = calculateMonthlyPrice((m.tenant.packs ?? []) as PackId[]);
          return (
            <div
              key={m.tenant_id}
              className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-5 ${
                current ? "border-gold/30 bg-gold-soft" : "border-gray-200 bg-white"
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900 truncate">{m.tenant.name}</span>
                  {current && (
                    <span className="rounded-full bg-gold-soft px-2 py-0.5 text-[11px] font-semibold text-gold">
                      Current
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {price > 0 ? `${formatPrice(price)}/mo` : "Free plan"} · {m.role}
                </p>
              </div>
              {current ? (
                <Link
                  href="/dashboard"
                  className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Open
                </Link>
              ) : (
                <form action={switchTenant}>
                  <input type="hidden" name="tenantId" value={m.tenant_id} />
                  <button
                    type="submit"
                    className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                  >
                    Switch here
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </div>

      {!demo && (
        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-serif font-normal text-gray-900">Add a location</h2>
          <p className="mt-1 text-sm text-gray-500">
            A new location starts on the free plan with a 30-day trial of every paid module.
            You can switch back to your current shop at any time.
          </p>
          <form action={createLocation} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <label htmlFor="location-name" className="sr-only">
              Location name
            </label>
            <input
              id="location-name"
              name="name"
              required
              minLength={2}
              maxLength={80}
              placeholder="e.g. Bridal Stack — Austin"
              className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gold/30 focus:ring-4 focus:ring-gold/40"
            />
            <button
              type="submit"
              className="rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-white hover:bg-gold"
            >
              Add location
            </button>
          </form>
        </div>
      )}

      <p className="mt-6 text-xs text-gray-400">
        Need a multi-location discount or shared customers across shops?{" "}
        <a href="mailto:hello@bridalstack.com?subject=Multi-location%20BridalStack" className="underline hover:text-gray-600">
          Talk to us
        </a>
        .
      </p>
    </div>
  );
}

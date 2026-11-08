import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import ModuleGuard from "@/components/module-guard";
import SearchBar from "@/components/search-bar";
import BrideRow from "@/components/bride-row";
import PageHead, { BTN_PRIMARY, BTN_SECONDARY } from "@/components/page-head";
import { buildJourney } from "@/lib/journey";
import { dateInTimeZone, normalizeTimeZone } from "@/lib/timezone";

type PageProps = { searchParams?: Promise<{ q?: string }> };

export default async function CustomersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  return (
    <ModuleGuard moduleId="crm" enabledModules={tenant.enabled_modules}>
      <CustomersContent tenantId={tenant.id} query={params?.q?.trim() ?? ""} tz={normalizeTimeZone((tenant.settings as Record<string, unknown> | null)?.time_zone)} />
    </ModuleGuard>
  );
}

async function CustomersContent({ tenantId, query, tz }: { tenantId: string; query: string; tz: string }) {
  const where = {
    tenant_id: tenantId,
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { phone: { contains: query, mode: "insensitive" as const } },
            { email: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [list, count] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: 200,
      select: {
        id: true, name: true, phone: true, event_date: true,
        orders: { select: { status: true } },
        appointments: { select: { status: true, appointment_date: true } },
        alterations: { select: { kind: true, status: true, promised_date: true } },
        installments: { select: { status: true } },
      },
    }),
    prisma.customer.count({ where: { tenant_id: tenantId } }),
  ]);

  const today = dateInTimeZone(new Date(), tz);
  // Düğünü en yakın olan üstte; tarihsizler sonra, evlenmişler en altta.
  const rank = (d: number | null) => (d === null ? 1e6 : d < 0 ? 2e6 - d : d);
  const rows = list
    .map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      journey: buildJourney({
        eventDate: c.event_date,
        today,
        orders: c.orders,
        appointments: c.appointments.map((a) => ({ status: a.status, date: dateInTimeZone(a.appointment_date, tz) })),
        alterations: c.alterations,
        installments: c.installments,
      }),
    }))
    .sort((x, y) => rank(x.journey.daysToWedding) - rank(y.journey.daysToWedding));

  return (
    <div className="animate-fade-in-up">
      <PageHead title="Brides" sub={count === 0 ? "No brides yet" : `${count} ${count === 1 ? "bride" : "brides"}, closest wedding first`}>
        <Link href="/customers/import" className={BTN_SECONDARY}>
          <span aria-hidden="true" className="material-symbols-outlined text-[20px]">upload_file</span>
          Import
        </Link>
        <Link href="/customers/new" className={BTN_PRIMARY}>
          <span aria-hidden="true" className="material-symbols-outlined text-[20px]">add</span>
          New bride
        </Link>
      </PageHead>

      <div className="mb-6 max-w-md">
        <SearchBar placeholder="Search by name, phone or email" basePath="/customers" />
      </div>

      {list.length > 0 ? (
        <div className="bg-white rounded-2xl border border-[var(--line)] divide-y divide-[var(--line)] overflow-hidden">
          {rows.map((r) => (
            <BrideRow key={r.id} id={r.id} name={r.name} reason={r.journey.reasons[0] ?? r.phone} daysToWedding={r.journey.daysToWedding} steps={r.journey.steps} risk={r.journey.risk} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[var(--line)] shadow-sm p-16 text-center">
          <span className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gold-soft text-gold mx-auto mb-5 material-symbols-outlined text-[32px]">favorite</span>
          <h3 className="text-xl font-bold text-[var(--ink)] mb-2">{query ? "No results found" : "No brides yet"}</h3>
          <p className="text-[var(--muted)] mb-8">{query ? "Try a different search term." : "Start your journey by adding your very first bride."}</p>
          {!query && (
            <Link href="/customers/new" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-stone-900 text-white font-medium text-sm hover:bg-gold transition-all duration-300">
              <span className="material-symbols-outlined text-[20px]">add</span>
              Add Bride
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

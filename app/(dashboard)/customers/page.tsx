import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import ModuleGuard from "@/components/module-guard";
import SearchBar from "@/components/search-bar";
import PortalLinkButton from "@/components/portal-link-button";

type PageProps = { searchParams?: Promise<{ q?: string }> };

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  hot_lead: "Hot Lead",
  appointment_set: "Appointment Set",
  fitting_done: "Fitting Done",
  sold: "Sold",
  delivered: "Delivered",
  lost: "Lost",
};

function statusStyle(status: string) {
  switch (status) {
    case "hot_lead":
      return "bg-gold-soft text-gold border border-gold/30";
    case "appointment_set":
    case "fitting_done":
      return "bg-amber-50 text-amber-600 border border-amber-100";
    case "sold":
    case "delivered":
      return "bg-emerald-50 text-emerald-600 border border-emerald-100";
    default:
      return "bg-stone-50 text-stone-600 border border-stone-200";
  }
}

export default async function CustomersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  return (
    <ModuleGuard moduleId="crm" enabledModules={tenant.enabled_modules}>
      <CustomersContent tenantId={tenant.id} query={params?.q?.trim() ?? ""} />
    </ModuleGuard>
  );
}

async function CustomersContent({ tenantId, query }: { tenantId: string; query: string }) {
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
      select: { id: true, name: true, phone: true, email: true, status: true, created_at: true },
    }),
    prisma.customer.count({ where: { tenant_id: tenantId } }),
  ]);

  return (
    <div className="animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl lg:text-4xl font-serif font-normal text-[var(--ink)] flex items-center gap-3">
            Brides <span className="text-gold font-normal">✧</span>
          </h1>
          <p className="text-[var(--muted)] mt-2 font-medium">
            {count === 0 ? "No brides yet" : `Managing ${count} stunning ${count === 1 ? "bride" : "brides"}`}
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/customers/import" className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-stone-700 font-medium text-sm border border-stone-200 hover:border-gold/30 hover:shadow-sm hover:text-gold transition-all duration-300">
            <span className="material-symbols-outlined text-[20px]">upload_file</span>
            Import
          </Link>
          <Link href="/customers/new" className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-stone-900 text-white font-medium text-sm hover:bg-gold transition-all duration-300">
            <span className="material-symbols-outlined text-[20px]">add</span>
            New Bride
          </Link>
        </div>
      </div>

      <div className="mb-8 max-w-md">
        <SearchBar placeholder="Search by name, phone or email..." basePath="/customers" />
      </div>

      {list.length > 0 ? (
        <div className="bg-white rounded-2xl border border-[var(--line)] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50/50 border-b border-[var(--line)]">
                  <th className="px-8 py-5 text-xs font-bold text-[var(--muted)] uppercase tracking-wider">Bride</th>
                  <th className="px-8 py-5 text-xs font-bold text-[var(--muted)] uppercase tracking-wider">Contact</th>
                  <th className="px-8 py-5 text-xs font-bold text-[var(--muted)] uppercase tracking-wider">Status</th>
                  <th className="px-8 py-5 text-xs font-bold text-[var(--muted)] uppercase tracking-wider">Added</th>
                  <th className="px-8 py-5 text-xs font-bold text-[var(--muted)] uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {list.map((c) => (
                  <tr key={c.id} className="hover:bg-stone-50 transition-colors group">
                    <td className="px-8 py-6">
                      <Link href={`/customers/${c.id}`} className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-gold-soft flex items-center justify-center text-gold font-bold text-sm">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold text-[var(--ink)] group-hover:text-gold transition-colors">{c.name}</span>
                      </Link>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-stone-700">{c.phone ?? "—"}</span>
                        <span className="text-xs text-stone-400">{c.email ?? "—"}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase ${statusStyle(c.status)}`}>
                        {STATUS_LABELS[c.status] ?? c.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-sm font-medium text-[var(--muted)]">
                      {c.created_at.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-8 py-6 text-right">
                      <PortalLinkButton customerId={c.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import { createTrunkShow } from "./actions";
import SubmitButton from "@/components/submit-button";

const ERRORS: Record<string, string> = {
  required: "Enter an event name and both dates.",
  too_long: "Keep the event name and notes within the allowed length.",
  dates: "The end date must be on or after the start date.",
};

type Props = { searchParams?: Promise<{ error?: string }> };

export default async function TrunkShowsPage({ searchParams }: Props) {
  const params = await searchParams;
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  const shows = await prisma.trunkShow.findMany({
    where: { tenant_id: tenant.id },
    orderBy: { start_date: "desc" },
    include: {
      items: { select: { id: true, gown_name: true, status: true, try_count: true } },
    },
  });
  // Şablon `trunk_show_items` adını bekliyor (Supabase iç içe select kalıntısı).
  const list = shows.map(({ items, ...s }) => ({ ...s, trunk_show_items: items }));

  const STATUS_STYLE: Record<string, string> = {
    upcoming: "bg-blue-100 text-blue-700", active: "bg-green-100 text-green-700",
    completed: "bg-gray-100 text-gray-700", cancelled: "bg-red-100 text-red-700",
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-normal text-gray-900">Trunk Shows</h1>
        <p className="text-sm text-gray-500 mt-1">Manage vendor sample events and gown tracking</p>
      </div>
      {params?.error && ERRORS[params.error] && (
        <div role="alert" aria-live="assertive" className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {ERRORS[params.error]}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-lg font-serif font-normal text-gray-900 mb-4">New Trunk Show</h2>
          <form action={createTrunkShow} className="flex flex-col gap-3">
            <div>
              <label htmlFor="trunk-show-name" className="block text-sm font-medium text-gray-700 mb-1">Event Name *</label>
              <input id="trunk-show-name" name="name" required className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none" placeholder="e.g. Pronovias Spring 2026" />
            </div>
            <div>
              <label htmlFor="trunk-show-vendor" className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
              <input id="trunk-show-vendor" name="vendor" className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none" placeholder="Designer / Brand" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="trunk-show-start" className="block text-sm font-medium text-gray-700 mb-1">Start</label>
                <input id="trunk-show-start" name="start_date" type="date" required className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none" />
              </div>
              <div>
                <label htmlFor="trunk-show-end" className="block text-sm font-medium text-gray-700 mb-1">End</label>
                <input id="trunk-show-end" name="end_date" type="date" required className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none" />
              </div>
            </div>
            <div>
              <label htmlFor="trunk-show-notes" className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea id="trunk-show-notes" name="notes" rows={2} className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none resize-y" />
            </div>
            <SubmitButton pendingLabel="Creating event…" className="mt-2 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-60 disabled:cursor-wait">Create Event</SubmitButton>
          </form>
        </div>

        <div className="lg:col-span-2">
          {list.length > 0 ? (
            <div className="flex flex-col gap-4">
              {list.map((s) => {
                const items = s.trunk_show_items as { id: string; gown_name: string; status: string; try_count: number }[] ?? [];
                return (
                  <div key={s.id} className="bg-white rounded-2xl border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">{s.name}</h3>
                        <p className="text-xs text-gray-500">{s.vendor ?? "—"} · {new Date(s.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} - {new Date(s.end_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                      </div>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_STYLE[s.status] ?? STATUS_STYLE.upcoming}`}>{s.status}</span>
                    </div>
                    {items.length > 0 && (
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
                        {items.map((item) => (
                          <div key={item.id} className="p-2.5 rounded-lg bg-gray-50 text-xs">
                            <span className="font-medium text-gray-900">{item.gown_name}</span>
                            <span className="text-gray-400 ml-1">· {item.try_count} tries</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {items.length === 0 && <p className="text-xs text-gray-400 mt-2">No gowns added yet</p>}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
              <span className="material-symbols-outlined text-4xl text-gray-300 mb-4 block">event_note</span>
              <h3 className="text-lg font-semibold text-gray-900">No trunk shows yet</h3>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import { createService, deleteService, toggleService } from "./actions";
import SelectField from "@/components/select-field";
import ModuleGuard from "@/components/module-guard";
import ConfirmSubmitButton from "@/components/confirm-submit-button";
import { formatPrice } from "@/config/modules";

const CATEGORIES = ["Hair", "Nails", "Skin", "Massage", "Makeup", "Tattoo", "Barber", "Lashes", "Waxing", "Other"];
const DURATIONS = [15, 30, 45, 60, 90, 120, 150, 180];

export default async function ServicesPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");
  // Modül kapısı: bu sayfa ücretsiz "salon" paketine ait, ama kapı yine de
  // uygulanmalı — paketi olmayan kiracı sayfayı doğrudan URL ile açabiliyordu.
  if (!tenant.enabled_modules.includes("services")) {
    return <ModuleGuard moduleId="services" enabledModules={tenant.enabled_modules}>{null}</ModuleGuard>;
  }

  const list = await prisma.service.findMany({
    where: { tenant_id: tenant.id },
    orderBy: [{ sort_order: "asc" }, { name: "asc" }],
  });

  const grouped = list.reduce((acc, s) => {
    const cat = s.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {} as Record<string, typeof list>);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Services</h1>
          <p className="text-sm text-gray-500 mt-1">{list.length} services</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Service</h2>
          <form action={createService} className="flex flex-col gap-3">
            <div>
              <label htmlFor="service-name" className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input id="service-name" name="name" required className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none" placeholder="e.g. Haircut & Style" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="category-select" className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <SelectField
                  name="category"
                  defaultValue={CATEGORIES[0]}
                  searchable={false}
                  options={CATEGORIES.map((c) => ({ value: c, label: c }))}
                />
              </div>
              <div>
                <label htmlFor="duration-select" className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                <SelectField
                  name="duration"
                  defaultValue={String(DURATIONS[1])}
                  searchable={false}
                  options={DURATIONS.map((d) => ({
                    value: String(d),
                    label: d >= 60 ? `${d / 60}h${d % 60 ? ` ${d % 60}m` : ""}` : `${d}min`,
                  }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="service-price" className="block text-sm font-medium text-gray-700 mb-1">Price ($)</label>
                <input id="service-price" name="price" type="number" step="0.01" min="0" className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none" placeholder="40" />
              </div>
              <div>
                <label htmlFor="service-max-price" className="block text-sm font-medium text-gray-700 mb-1">Max Price ($)</label>
                <input id="service-max-price" name="price_max" type="number" step="0.01" min="0" className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none" placeholder="Optional" />
              </div>
            </div>
            <div>
              <label htmlFor="service-description" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea id="service-description" name="description" rows={2} className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm outline-none resize-y" placeholder="Optional..." />
            </div>
            <button type="submit" className="mt-1 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800">Add Service</button>
          </form>
        </div>

        <div className="lg:col-span-2">
          {Object.keys(grouped).length > 0 ? (
            <div className="flex flex-col gap-6">
              {Object.entries(grouped).map(([category, items]) => (
                <div key={category}>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">{category}</h3>
                  <div className="flex flex-col gap-2">
                    {items.map(s => (
                      <div key={s.id} className={`bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between ${!s.is_active ? "opacity-50" : ""}`}>
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center">
                            <span className="material-symbols-outlined text-rose-500 text-lg">content_cut</span>
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900 text-sm">{s.name}</h4>
                            <p className="text-xs text-gray-500">
                              {s.duration >= 60 ? `${Math.floor(s.duration / 60)}h${s.duration % 60 ? ` ${s.duration % 60}m` : ""}` : `${s.duration}min`}
                              {s.description && ` · ${s.description}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <span className="font-semibold text-gray-900 text-sm">
                              {formatPrice(Number(s.price))}
                              {s.price_max ? ` - ${formatPrice(Number(s.price_max))}` : ""}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <form action={toggleService}>
                              <input type="hidden" name="id" value={s.id} />
                              <input type="hidden" name="is_active" value={s.is_active ? "false" : "true"} />
                              <button type="submit" className={`text-xs px-2 py-1 rounded-lg ${s.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                                {s.is_active ? "On" : "Off"}
                              </button>
                            </form>
                            <form action={deleteService}>
                              <input type="hidden" name="id" value={s.id} />
                              <ConfirmSubmitButton
                                message={`Delete ${s.name}? This cannot be undone.`}
                                ariaLabel={`Delete ${s.name}`}
                                title="Delete service"
                                className="text-xs text-red-400 hover:text-red-600 px-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2"
                              >
                                <span aria-hidden="true">✕</span>
                              </ConfirmSubmitButton>
                            </form>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
              <span className="material-symbols-outlined text-4xl text-gray-300 mb-4 block">content_cut</span>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">No services yet</h3>
              <p className="text-sm text-gray-500">Add your first service to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

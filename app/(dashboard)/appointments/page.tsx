import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import { createAppointment, updateAppointmentStatus } from "@/lib/actions";
import ModuleGuard from "@/components/module-guard";
import SelectField from "@/components/select-field";
import SubmitButton from "@/components/submit-button";
import { dateInTimeZone, normalizeTimeZone } from "@/lib/timezone";
import EmptyState from "@/components/empty-state";

function statusStyle(status: string) {
  switch (status) {
    case "pending":
      return "bg-amber-50 text-amber-600 border-amber-100";
    case "confirmed":
      return "bg-blue-50 text-blue-600 border-blue-100";
    case "completed":
      return "bg-emerald-50 text-emerald-600 border-emerald-100";
    case "cancelled":
      return "bg-gold-soft text-gold border-gold/30";
    default:
      return "bg-stone-50 text-stone-600 border-stone-200";
  }
}

export default async function AppointmentsPage({ searchParams }: { searchParams?: Promise<{ customer?: string }> }) {
  const params = await searchParams;
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  return (
    <ModuleGuard moduleId="appointments" enabledModules={tenant.enabled_modules}>
      <AppointmentsContent tenantId={tenant.id} timeZone={normalizeTimeZone(tenant.settings.time_zone)} customer={params?.customer} />
    </ModuleGuard>
  );
}

async function AppointmentsContent({ tenantId, timeZone, customer }: { tenantId: string; timeZone: string; customer?: string }) {
  const [list, customers] = await Promise.all([
    prisma.appointment.findMany({
      where: { tenant_id: tenantId },
      orderBy: { appointment_date: "desc" },
      take: 200,
      select: {
        id: true, title: true, appointment_date: true, status: true,
        customer: { select: { name: true, phone: true } },
      },
    }),
    prisma.customer.findMany({
      where: { tenant_id: tenantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const now = new Date();
  const today = dateInTimeZone(now, timeZone);

  return (
    <div className="animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl lg:text-4xl font-serif font-normal text-[var(--ink)] flex items-center gap-3">
            Appointments
          </h1>
          <p className="text-[var(--muted)] mt-2 font-medium">
            {list.length === 0
              ? "No appointments scheduled yet"
              : `You have ${list.length} ${list.length === 1 ? "appointment" : "appointments"} scheduled`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* New Appointment Form */}
        <div className="bg-white rounded-2xl border border-[var(--line)] shadow-sm p-8 h-fit">
          <div className="flex items-center gap-3 mb-6">
            <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-stone-900 text-white material-symbols-outlined text-[20px]">add</span>
            <h2 className="text-xl font-serif font-normal text-[var(--ink)]">New Booking</h2>
          </div>
          {customers.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              Add a bride first, then you can schedule appointments for her.
            </p>
          ) : (
            <form id="new" action={createAppointment} className="scroll-mt-24 flex flex-col gap-5">
              <div>
                <label htmlFor="customer_id-select" className="block text-xs font-bold text-[var(--muted)] uppercase tracking-wider mb-2">Customer *</label>
                <SelectField
                  name="customer_id"
                  required
                  defaultValue={customer ?? ""}
                  placeholder="Select a bride…"
                  options={customers.map((c) => ({ value: c.id, label: c.name }))}
                />
              </div>
              <div>
                <label htmlFor="appointment-title" className="block text-xs font-bold text-[var(--muted)] uppercase tracking-wider mb-2">Title</label>
                <input id="appointment-title" name="title" className="w-full px-4 py-3.5 rounded-2xl border border-stone-200 bg-white/50 text-stone-700 text-sm outline-none focus:border-gold/30 focus:ring-4 focus:ring-gold/40 transition-all" placeholder="e.g. First Fitting" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="appointment-date" className="block text-xs font-bold text-[var(--muted)] uppercase tracking-wider mb-2">Date *</label>
                  <input id="appointment-date" name="date" type="date" required defaultValue={today} className="w-full px-4 py-3.5 rounded-2xl border border-stone-200 bg-white/50 text-stone-700 text-sm outline-none focus:border-gold/30 focus:ring-4 focus:ring-gold/40 transition-all" />
                </div>
                <div>
                  <label htmlFor="appointment-time" className="block text-xs font-bold text-[var(--muted)] uppercase tracking-wider mb-2">Time</label>
                  <input id="appointment-time" name="time" type="time" defaultValue="10:00" className="w-full px-4 py-3.5 rounded-2xl border border-stone-200 bg-white/50 text-stone-700 text-sm outline-none focus:border-gold/30 focus:ring-4 focus:ring-gold/40 transition-all" />
                </div>
              </div>
              <div>
                <label htmlFor="appointment-notes" className="block text-xs font-bold text-[var(--muted)] uppercase tracking-wider mb-2">Notes</label>
                <textarea id="appointment-notes" name="description" rows={2} className="w-full px-4 py-3.5 rounded-2xl border border-stone-200 bg-white/50 text-stone-700 text-sm outline-none focus:border-gold/30 focus:ring-4 focus:ring-gold/40 transition-all resize-y" placeholder="Optional notes for stylist..." />
              </div>
              <SubmitButton pendingLabel="Scheduling…" className="mt-2 w-full py-3.5 bg-stone-900 text-white rounded-2xl text-sm font-bold hover:bg-gold transition-all duration-300 disabled:opacity-60 disabled:cursor-wait">
                Schedule Appointment
              </SubmitButton>
            </form>
          )}
        </div>

        {/* Appointment List */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[var(--line)] shadow-sm overflow-hidden">
          {list.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50/50 border-b border-[var(--line)]">
                    <th className="px-8 py-5 text-xs font-bold text-[var(--muted)] uppercase tracking-wider">Bride</th>
                    <th className="px-8 py-5 text-xs font-bold text-[var(--muted)] uppercase tracking-wider">Appointment</th>
                    <th className="px-8 py-5 text-xs font-bold text-[var(--muted)] uppercase tracking-wider">Date &amp; Time</th>
                    <th className="px-8 py-5 text-xs font-bold text-[var(--muted)] uppercase tracking-wider">Status</th>
                    <th className="px-8 py-5 text-xs font-bold text-[var(--muted)] uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {list.map((a) => {
                    const dt = a.appointment_date;
                    const isPast = dt < now && a.status === "pending";
                    return (
                      <tr key={a.id} className={`hover:bg-stone-50 transition-colors group ${isPast ? "bg-late-soft" : ""}`}>
                        <td className="px-8 py-6">
                          <div className="flex flex-col">
                            <span className="font-bold text-[var(--ink)] group-hover:text-gold transition-colors">{a.customer?.name ?? "—"}</span>
                            <span className="text-xs text-stone-400 mt-0.5">{a.customer?.phone ?? ""}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-sm font-medium text-stone-700">{a.title ?? "—"}</td>
                        <td className="px-8 py-6">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-stone-800">{dt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                            <span className="text-xs text-[var(--muted)]">{dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase border ${statusStyle(a.status)}`}>
                            {a.status}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-right">
                          {a.status === "pending" && (
                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                              <form action={updateAppointmentStatus}>
                                <input type="hidden" name="id" value={a.id} />
                                <input type="hidden" name="status" value="confirmed" />
                                <button type="submit" aria-label="Confirm appointment" className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-500 hover:text-white transition-colors" title="Confirm">
                                  <span className="material-symbols-outlined text-[16px]">check</span>
                                </button>
                              </form>
                              <form action={updateAppointmentStatus}>
                                <input type="hidden" name="id" value={a.id} />
                                <input type="hidden" name="status" value="completed" />
                                <button type="submit" aria-label="Mark appointment completed" className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-colors" title="Mark Completed">
                                  <span className="material-symbols-outlined text-[16px]">done_all</span>
                                </button>
                              </form>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon="event_busy" action={{ href: "#new", label: "Book a fitting" }} title="No appointments">
              Your calendar is clear. Schedule a fitting to get started.
            </EmptyState>
          )}
        </div>
      </div>
    </div>
  );
}

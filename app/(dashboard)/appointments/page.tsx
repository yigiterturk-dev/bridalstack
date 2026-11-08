import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import { createAppointment, updateAppointmentStatus } from "@/lib/actions";
import ModuleGuard from "@/components/module-guard";
import SelectField from "@/components/select-field";
import SubmitButton from "@/components/submit-button";
import { addCalendarDays, dateInTimeZone, normalizeTimeZone } from "@/lib/timezone";
import PageHead from "@/components/page-head";
import EmptyState from "@/components/empty-state";

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
  const tomorrow = addCalendarDays(today, 1);
  const time = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone });
  const dayLabel = (day: string) =>
    day === today ? "Today" : day === tomorrow ? "Tomorrow"
      : new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });

  const live = list.filter((a) => a.status !== "cancelled");
  const upcoming = live.filter((a) => dateInTimeZone(a.appointment_date, timeZone) >= today).reverse(); // en yakın üstte
  const past = live.filter((a) => dateInTimeZone(a.appointment_date, timeZone) < today);
  const days: { day: string; items: typeof upcoming }[] = [];
  for (const a of upcoming) {
    const day = dateInTimeZone(a.appointment_date, timeZone);
    const last = days[days.length - 1];
    if (last?.day === day) last.items.push(a);
    else days.push({ day, items: [a] });
  }
  const next = upcoming[0];
  const formOpen = Boolean(customer) || upcoming.length === 0;

  const row = (a: (typeof list)[number], isPast: boolean) => {
    const unconfirmed = a.status === "pending";
    const needsClose = isPast && a.status !== "completed";
    return (
      <div key={a.id} className="flex items-center gap-4 px-4 py-3">
        <span className="w-[4.5rem] shrink-0 whitespace-nowrap font-serif text-base tabular-nums text-[var(--ink)] sm:w-24 sm:text-lg">{time(a.appointment_date)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {unconfirmed && !isPast && <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-amber" />}
            <span className="truncate font-medium text-[var(--ink)]">{a.customer?.name ?? "No bride"}</span>
          </div>
          <p className="mt-0.5 text-sm text-[var(--muted)] sm:truncate">
            {[a.title, unconfirmed && !isPast ? "Not confirmed yet" : null, a.status === "completed" ? "Done" : null].filter(Boolean).join(" · ")}
          </p>
        </div>
        {(unconfirmed && !isPast) || needsClose ? (
          <form action={updateAppointmentStatus} className="shrink-0">
            <input type="hidden" name="id" value={a.id} />
            <input type="hidden" name="status" value={needsClose ? "completed" : "confirmed"} />
            <button type="submit" className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm font-medium text-[var(--ink)] transition-colors hover:border-gold hover:bg-gold-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40">
              {needsClose ? "Mark done" : "Confirm"}
            </button>
          </form>
        ) : null}
      </div>
    );
  };

  const field = "w-full rounded-xl border border-[var(--line)] bg-white px-3.5 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30";
  const label = "mb-1.5 block text-sm font-medium text-[var(--ink)]";

  return (
    <div className="animate-fade-in-up">
      <PageHead
        title="Appointments"
        sub={next ? `Next: ${next.customer?.name ?? "a bride"} · ${dayLabel(dateInTimeZone(next.appointment_date, timeZone))}, ${time(next.appointment_date)}`: "Nothing booked yet"}
      />

      <details id="new" open={formOpen} className="group mb-8 scroll-mt-24 rounded-2xl border border-[var(--line)] bg-white">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 font-medium text-[var(--ink)] [&::-webkit-details-marker]:hidden">
          <span aria-hidden="true" className="material-symbols-outlined flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--ink)] text-[18px] leading-none text-white">add</span>
          Book an appointment
          <span aria-hidden="true" className="material-symbols-outlined ml-auto text-stone-400 transition-transform group-open:rotate-180">expand_more</span>
        </summary>
        <div className="border-t border-[var(--line)] px-4 py-5">
          {customers.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Add a bride first, then you can book her in.</p>
          ) : (
            <form action={createAppointment} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="sm:col-span-2">
                <label htmlFor="customer_id-select" className={label}>Bride</label>
                <SelectField
                  name="customer_id"
                  required
                  defaultValue={customer ?? ""}
                  placeholder="Choose a bride"
                  options={customers.map((c) => ({ value: c.id, label: c.name }))}
                />
              </div>
              <div>
                <label htmlFor="appointment-date" className={label}>Day</label>
                <input id="appointment-date" name="date" type="date" required defaultValue={today} className={field} />
              </div>
              <div>
                <label htmlFor="appointment-time" className={label}>Time</label>
                <input id="appointment-time" name="time" type="time" defaultValue="10:00" className={field} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="appointment-title" className={label}>What for</label>
                <input id="appointment-title" name="title" className={field} placeholder="First fitting" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="appointment-notes" className={label}>Note <span className="font-normal text-[var(--muted)]">(optional)</span></label>
                <input id="appointment-notes" name="description" className={field} placeholder="Bring her shoes" />
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <SubmitButton pendingLabel="Booking…" className="rounded-xl bg-[var(--ink)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-800 disabled:cursor-wait disabled:opacity-60">
                  Book it
                </SubmitButton>
              </div>
            </form>
          )}
        </div>
      </details>

      {days.length > 0 ? (
        <div className="flex flex-col gap-6">
          {days.map((d) => (
            <section key={d.day}>
              <h2 className="mb-2 font-serif text-lg text-[var(--ink)]">{dayLabel(d.day)}</h2>
              <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white divide-y divide-[var(--line)]">
                {d.items.map((a) => row(a, false))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState icon="event_busy" action={{ href: "#new", label: "Book a fitting" }} title="Nothing coming up">
          Your calendar is clear.
        </EmptyState>
      )}

      {past.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer text-sm font-medium text-[var(--muted)] hover:text-[var(--ink)]">Past appointments ({past.length})</summary>
          <div className="mt-3 overflow-hidden rounded-2xl border border-[var(--line)] bg-white divide-y divide-[var(--line)]">
            {past.map((a) => row(a, true))}
          </div>
        </details>
      )}
    </div>
  );
}

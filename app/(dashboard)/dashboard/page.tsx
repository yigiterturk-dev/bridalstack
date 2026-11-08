import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant, getCurrentUserId } from "@/lib/tenant";
import { formatPrice } from "@/config/modules";
import { addCalendarDays, dateInTimeZone, normalizeTimeZone, startOfDayInTimeZone } from "@/lib/timezone";
import { buildJourney, sortForAttention } from "@/lib/journey";
import BrideRow from "@/components/bride-row";

const OPEN_INSTALLMENT = ["pending", "due", "overdue"];

export default async function TodayPage() {
  const [tenant, userId] = await Promise.all([getCurrentTenant(), getCurrentUserId()]);
  if (!tenant) redirect("/onboarding");

  const tz = normalizeTimeZone((tenant.settings as Record<string, unknown> | null)?.time_zone);
  const now = new Date();
  const today = dateInTimeZone(now, tz);
  const dayStart = startOfDayInTimeZone(today, tz);
  const dayEnd = startOfDayInTimeZone(addCalendarDays(today, 1), tz);
  const weekEnd = addCalendarDays(today, 6);
  const t = tenant.id;

  const [user, customerCount, apptToday, alterFitToday, dueWeek, brides] = await Promise.all([
    userId ? prisma.user.findUnique({ where: { id: userId }, select: { name: true } }) : null,
    prisma.customer.count({ where: { tenant_id: t } }),
    prisma.appointment.count({ where: { tenant_id: t, appointment_date: { gte: dayStart, lt: dayEnd }, status: { not: "cancelled" } } }),
    prisma.alteration.count({ where: { tenant_id: t, fitting_date: today, status: { notIn: ["cancelled", "delivered"] } } }),
    prisma.installment.aggregate({ where: { tenant_id: t, status: { in: OPEN_INSTALLMENT }, due_date: { gte: today, lte: weekEnd } }, _sum: { amount: true } }),
    // Yaklaşan düğünü olan ya da bir şeyi geciken gelinler — geri kalanı Today'i meşgul etmez.
    prisma.customer.findMany({
      where: {
        tenant_id: t,
        OR: [
          { event_date: { gte: today } },
          { alterations: { some: { status: { in: ["requested", "in_progress", "ready"] }, promised_date: { lt: today } } } },
          { installments: { some: { status: "overdue" } } },
        ],
      },
      take: 300,
      select: {
        id: true, name: true, event_date: true,
        orders: { select: { status: true } },
        appointments: { select: { status: true, appointment_date: true } },
        alterations: { select: { kind: true, status: true, promised_date: true } },
        installments: { select: { status: true } },
      },
    }),
  ]);

  const rows = brides.map((c) => ({
    id: c.id,
    name: c.name,
    journey: buildJourney({
      eventDate: c.event_date,
      today,
      orders: c.orders,
      appointments: c.appointments.map((a) => ({ status: a.status, date: dateInTimeZone(a.appointment_date, tz) })),
      alterations: c.alterations,
      installments: c.installments,
    }),
  }));
  const active = rows.filter((r) => r.journey.risk !== "married");
  const attention = sortForAttention(active.filter((r) => r.journey.risk === "late" || r.journey.risk === "behind"));
  const upcoming = active
    .filter((r) => r.journey.daysToWedding !== null && r.journey.daysToWedding <= 60)
    .sort((a, b) => (a.journey.daysToWedding ?? 0) - (b.journey.daysToWedding ?? 0));
  const lateCount = active.filter((r) => r.journey.risk === "late").length;

  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(now));
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = user?.name?.split(" ")[0];
  const dateLabel = new Date(`${today}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });

  return (
    <div className="flex flex-col gap-10">
      <header>
        <p className="text-sm text-[var(--muted)]">{dateLabel}</p>
        <h1 className="mt-1 font-serif text-3xl sm:text-4xl text-[var(--ink)]">{greeting}{firstName ? `, ${firstName}` : ""}</h1>
      </header>

      {customerCount === 0 ? (
        <section className="rounded-2xl border border-[var(--line)] p-10 text-center">
          <h2 className="font-serif text-2xl text-[var(--ink)]">No brides yet</h2>
          <p className="mt-2 text-[var(--muted)]">Add a bride with her wedding date and Today will tell you who needs you.</p>
          <Link href="/customers/new" className="mt-6 inline-block rounded-xl bg-[var(--ink)] px-5 py-2.5 text-sm font-medium text-white">Add your first bride</Link>
        </section>
      ) : (
        <>
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Stat label="Fittings today" value={String(apptToday + alterFitToday)} href="/appointments" />
            <Stat label="Late" value={String(lateCount)} tone={lateCount ? "late" : undefined} href="#attention" />
            <Stat label="Payments due this week" value={formatPrice(dueWeek._sum.amount ?? 0)} href="/installments" />
          </section>

          <section id="attention">
            <h2 className="mb-3 font-serif text-xl text-[var(--ink)]">Needs attention</h2>
            {attention.length === 0 ? (
              <p className="rounded-2xl border border-[var(--line)] px-4 py-6 text-[var(--muted)]">Nothing is late. Nice.</p>
            ) : (
              <div className="divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)]">
                {attention.map((r) => (
                  <BrideRow key={r.id} id={r.id} name={r.name} reason={r.journey.reasons[0] ?? null} daysToWedding={r.journey.daysToWedding} steps={r.journey.steps} risk={r.journey.risk} />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 font-serif text-xl text-[var(--ink)]">Upcoming weddings <span className="text-base text-[var(--muted)]">· next 60 days</span></h2>
            {upcoming.length === 0 ? (
              <div className="rounded-2xl border border-[var(--line)] px-4 py-6 text-[var(--muted)]">
                No weddings in the next 60 days. Add wedding dates to your brides to see them here.
                <Link href="/customers" className="ml-2 font-medium text-[var(--ink)] underline">Open brides</Link>
              </div>
            ) : (
              <div className="divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)]">
                {upcoming.map((r) => (
                  <BrideRow key={r.id} id={r.id} name={r.name} reason={r.journey.reasons[0] ?? null} daysToWedding={r.journey.daysToWedding} steps={r.journey.steps} risk={r.journey.risk} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, href, tone }: { label: string; value: string; href: string; tone?: "late" }) {
  return (
    <Link href={href} className="rounded-2xl border border-[var(--line)] p-5 hover:border-stone-300 transition-colors">
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className={`mt-2 font-serif text-4xl tabular-nums ${tone === "late" ? "text-late" : "text-[var(--ink)]"}`}>{value}</p>
    </Link>
  );
}

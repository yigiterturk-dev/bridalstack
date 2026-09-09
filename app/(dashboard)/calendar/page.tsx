import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import { todayISO } from "@/lib/finance";
import ModuleGuard from "@/components/module-guard";
import {
  isLate,
  rentalDaysInMonth,
  rentalDaysInRange,
  weekDates,
  weekStart,
  type CalendarEvent,
} from "@/lib/calendar-events";
import CalendarView from "./calendar-view";
import CalendarWeekView from "./calendar-week-view";

type PageProps = { searchParams?: Promise<{ month?: string; view?: string; week?: string }> };

export default async function CalendarPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  const now = new Date();
  const today = todayISO();

  // Haftalık görünüm ayrı bir ekran değil, aynı verinin dar penceresi.
  const weekly = params?.view === "week";
  const weekFrom = weekly ? weekStart(/^\d{4}-\d{2}-\d{2}$/.test(params?.week ?? "") ? (params!.week as string) : today) : "";
  const weekTo = weekly ? weekDates(weekFrom)[6] : "";

  const monthParam = params?.month;
  const [year, month] = monthParam ? monthParam.split("-").map(Number) : [now.getFullYear(), now.getMonth() + 1];

  const start = weekly ? new Date(`${weekFrom}T00:00:00`) : new Date(year, month - 1, 1);
  const end = weekly ? new Date(`${weekTo}T23:59:59`) : new Date(year, month, 0, 23, 59, 59);

  // Kiralamalar Inventory paketinde. Paket kapalıysa takvim de göstermez;
  // takvimin açık olması envanteri açmaz.
  const showRentals = tenant.enabled_modules.includes("inventory");
  const rangeStart = weekly ? weekFrom : `${year}-${String(month).padStart(2, "0")}-01`;
  const rangeEnd = weekly
    ? weekTo
    : `${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;

  const [appointments, rentals] = await Promise.all([
    prisma.appointment.findMany({
      where: { tenant_id: tenant.id, appointment_date: { gte: start, lte: end } },
      select: { id: true, title: true, appointment_date: true, status: true, customer: { select: { name: true } } },
      orderBy: { appointment_date: "asc" },
    }),
    showRentals
      ? prisma.rental.findMany({
          // Aya değen her kiralama: aya sarkanlar da alınır.
          where: {
            tenant_id: tenant.id,
            status: { in: ["reserved", "out"] },
            start_date: { lte: rangeEnd },
            due_date: { gte: rangeStart },
          },
          select: {
            id: true, start_date: true, due_date: true, status: true,
            customer: { select: { name: true } },
            product: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const events: CalendarEvent[] = appointments.map((a) => ({
    id: a.id,
    kind: "appointment",
    title: a.title ?? "Appointment",
    customerName: a.customer?.name ?? "",
    date: a.appointment_date.toISOString(),
    status: a.status,
  }));

  // Bir kiralama aya düştüğü her gün için ayrı bir satır üretir; rolü o günün
  // ne anlama geldiğini söyler (çıkış / dönüş / sadece dışarıda).
  const rentalDays: Record<number, CalendarEvent[]> = {};
  const rentalDates: Record<string, CalendarEvent[]> = {};
  for (const r of rentals) {
    const late = isLate(r, today);
    const row = (key: string, role: "pickup" | "due" | "out"): CalendarEvent => ({
      id: `${r.id}-${key}`,
      kind: "rental",
      title: r.product?.name ?? "Gown",
      customerName: r.customer?.name ?? "",
      date: "",
      status: r.status,
      role,
      late,
    });

    if (weekly) {
      for (const { date, role } of rentalDaysInRange(r, weekFrom, weekTo)) {
        (rentalDates[date] ??= []).push(row(date, role));
      }
    } else {
      for (const { day, role } of rentalDaysInMonth(r, year, month)) {
        (rentalDays[day] ??= []).push(row(String(day), role));
      }
    }
  }

  return (
    <ModuleGuard moduleId="appointments" enabledModules={tenant.enabled_modules}>
      {weekly ? (
        <CalendarWeekView events={events} rentalDates={rentalDates} start={weekFrom} today={today} />
      ) : (
        <CalendarView events={events} rentalDays={rentalDays} year={year} month={month} />
      )}
    </ModuleGuard>
  );
}

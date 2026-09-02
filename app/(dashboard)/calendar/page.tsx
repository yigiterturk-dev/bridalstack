import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import ModuleGuard from "@/components/module-guard";
import CalendarView from "./calendar-view";

type PageProps = { searchParams?: Promise<{ month?: string }> };

export default async function CalendarPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  const now = new Date();
  const monthParam = params?.month;
  const [year, month] = monthParam ? monthParam.split("-").map(Number) : [now.getFullYear(), now.getMonth() + 1];

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);

  const appointments = await prisma.appointment.findMany({
    where: { tenant_id: tenant.id, appointment_date: { gte: start, lte: end } },
    select: { id: true, title: true, appointment_date: true, status: true, customer: { select: { name: true } } },
    orderBy: { appointment_date: "asc" },
  });

  const events = appointments.map((a) => ({
    id: a.id,
    title: a.title ?? "Appointment",
    customerName: a.customer?.name ?? "",
    date: a.appointment_date.toISOString(),
    status: a.status,
  }));

  return (
    <ModuleGuard moduleId="appointments" enabledModules={tenant.enabled_modules}>
      <CalendarView events={events} year={year} month={month} />
    </ModuleGuard>
  );
}

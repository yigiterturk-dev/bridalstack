import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Image from "next/image";
import BookingForm from "./booking-form";
import { DEMO_TENANT_SLUG } from "@/lib/demo-identity";
import { ensureDemoTenant } from "@/lib/demo-tenant";
import { dateInTimeZone, normalizeTimeZone, timeZoneLabel } from "@/lib/timezone";

type Props = { params: Promise<{ slug: string }> };

export default async function PublicBookingPage({ params }: Props) {
  const { slug } = await params;
  if (slug === DEMO_TENANT_SLUG) await ensureDemoTenant();

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, name: true, logo_url: true, accent_color: true, settings: true },
  });

  if (!tenant) notFound();

  const [services, members] = await Promise.all([
    prisma.service.findMany({
      where: { tenant_id: tenant.id, is_active: true },
      select: { id: true, name: true, category: true, duration: true, price: true, price_max: true, description: true },
      orderBy: [{ sort_order: "asc" }, { name: "asc" }],
    }),
    prisma.tenantMember.findMany({
      where: { tenant_id: tenant.id, is_bookable: true },
      select: { id: true, display_name: true, title: true, photo_url: true, is_bookable: true },
    }),
  ]);

  const memberIds = members.map((m) => m.id);
  const timeZone = normalizeTimeZone((tenant.settings as Record<string, unknown>)?.time_zone);
  const today = dateInTimeZone(new Date(), timeZone);
  // Eski sorgu staff_services'i kiracı filtresiz çekiyordu — sadece bu butiğin personeli.
  const [staffServices, schedules, bookings, timeOff] = await Promise.all([
    prisma.staffService.findMany({ where: { member_id: { in: memberIds } }, select: { member_id: true, service_id: true } }),
    prisma.staffSchedule.findMany({
      where: { member_id: { in: memberIds } },
      select: { member_id: true, day_of_week: true, start_time: true, end_time: true, break_start: true, break_end: true, is_off: true },
    }),
    prisma.booking.findMany({
      where: { tenant_id: tenant.id, booking_date: { gte: today }, status: { notIn: ["cancelled", "no_show"] } },
      select: { member_id: true, booking_date: true, start_time: true, end_time: true },
    }),
    prisma.staffTimeOff.findMany({
      where: { tenant_id: tenant.id, member_id: { in: memberIds }, date: { gte: today } },
      select: { member_id: true, date: true },
    }),
  ]);

  const accent = (tenant.accent_color as string) ?? "#b4496a";

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col">
      {/* Soft brand-tinted top band */}
      <div className="h-32 w-full" style={{ background: `linear-gradient(180deg, ${accent}14 0%, ${accent}05 60%, transparent 100%)` }} />

      <div className="max-w-xl w-full mx-auto px-4 -mt-20 flex-1">
        <header className="text-center mb-7">
          {tenant.logo_url ? (
            <Image unoptimized src={tenant.logo_url as string} alt={tenant.name} width={160} height={64} className="h-16 w-auto mx-auto mb-4 object-contain" />
          ) : (
            <div
              className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center text-white text-2xl font-semibold shadow-sm"
              style={{ backgroundColor: accent }}
            >
              {tenant.name.trim().charAt(0).toUpperCase()}
            </div>
          )}
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">{tenant.name}</h1>
          <p className="text-gray-500 mt-1.5 text-sm">Book your appointment online in a few steps</p>
        </header>

        <BookingForm
          tenantId={tenant.id}
          accent={accent}
          services={services ?? []}
          staff={(members ?? []).map((m) => ({
            id: m.id,
            name: m.display_name ?? "Staff",
            title: m.title,
            photo: m.photo_url,
            serviceIds: (staffServices ?? []).filter((ss) => ss.member_id === m.id).map((ss) => ss.service_id),
          }))}
          schedules={(schedules ?? []).map((s) => ({
            memberId: s.member_id,
            dayOfWeek: s.day_of_week,
            startTime: s.start_time,
            endTime: s.end_time,
            breakStart: s.break_start,
            breakEnd: s.break_end,
            isOff: s.is_off,
          }))}
          bookings={(bookings ?? []).map((b) => ({
            memberId: b.member_id,
            bookingDate: b.booking_date,
            startTime: b.start_time,
            endTime: b.end_time,
          }))}
          timeOff={(timeOff ?? []).map((entry) => ({ memberId: entry.member_id, date: entry.date }))}
          minDate={today}
          timeZoneLabel={timeZoneLabel(timeZone)}
        />
      </div>

      <footer className="text-center py-8 mt-6">
        <p className="text-xs text-gray-400 inline-flex items-center gap-1">
          <span className="material-symbols-outlined text-[13px]">bolt</span>
          Powered by BridalStack
        </p>
      </footer>
    </div>
  );
}

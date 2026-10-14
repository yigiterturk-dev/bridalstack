import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { UUID_RE, canStaffBookService, fitsSchedule, validateBookingInput } from "@/lib/booking-validation";
import { bookingRequestEmail, sendEmail } from "@/lib/email";
import { dateInTimeZone, normalizeTimeZone } from "@/lib/timezone";

export const dynamic = "force-dynamic";

// NOCTURN_PUBLIC_ENDPOINT: public booking is protected by tenant/service/slot validation and IP rate limiting; it does not use a user session.

class BookingConflictError extends Error {}

function clean(v: unknown, max = 200): string {
  return String(v ?? "").trim().slice(0, max);
}

export async function POST(req: Request) {
  try {
    // 1. Hız sınırı: IP başına 60 sn'de en fazla 5 rezervasyon denemesi.
    const ip = clientIp(req);
    const rl = await rateLimit(`book:${ip}`, 5, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
      );
    }

    let body: Record<string, unknown>;
    try {
      const parsed: unknown = await req.json();
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return NextResponse.json({ error: "Invalid request." }, { status: 400 });
      }
      body = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const tenant_id = clean(body.tenant_id, 64);
    const service_id = clean(body.service_id, 64);
    const member_id_raw = clean(body.member_id, 64);
    const customer_name = clean(body.customer_name, 120);
    const customer_phone = clean(body.customer_phone, 40);
    const customer_email = clean(body.customer_email, 160).toLowerCase();
    const booking_date = clean(body.booking_date, 10);
    const start_time = clean(body.start_time, 5);
    const end_time = clean(body.end_time, 5);
    const notes = clean(body.notes, 500) || null;

    // Do not pass attacker-controlled non-UUID strings to Prisma just to find
    // the tenant's time zone. Keep malformed requests a predictable 400.
    if (!UUID_RE.test(tenant_id) || !UUID_RE.test(service_id)) {
      return NextResponse.json({ error: "Missing or invalid fields." }, { status: 400 });
    }

    const tenantForDate = await prisma.tenant.findUnique({
      where: { id: tenant_id },
      select: { settings: true },
    });
    const timeZone = normalizeTimeZone((tenantForDate?.settings as Record<string, unknown> | null)?.time_zone);
    const today = dateInTimeZone(new Date(), timeZone);

    // 2. Şema doğrulaması (fail-closed) — saf çekirdek lib/booking-validation.ts
    const valid = validateBookingInput({
      tenant_id,
      service_id,
      customer_name,
      customer_phone,
      customer_email,
      booking_date,
      start_time,
      end_time,
    }, today);
    if (!valid.ok) {
      return NextResponse.json({ error: valid.error }, { status: 400 });
    }

    if (member_id_raw && !UUID_RE.test(member_id_raw)) {
      return NextResponse.json({ error: "Invalid staff member." }, { status: 400 });
    }
    const member_id = member_id_raw || null;
    const dayOfWeek = new Date(`${booking_date}T12:00:00Z`).getUTCDay();

    // 3. Tenant + servis gerçekten var mı? (uydurma id ile yazımı engelle)
    const svc = await prisma.service.findFirst({
      where: { id: service_id, tenant_id, is_active: true },
      select: { id: true, name: true, price: true, duration: true },
    });

    if (!svc) {
      return NextResponse.json({ error: "Service not found." }, { status: 404 });
    }
    // Fiyat istemciden DEĞİL, sunucudaki servis kaydından alınır.
    const amount = Number(svc.price ?? 0);
    const tenantOwner = await prisma.tenant.findUnique({
      where: { id: tenant_id },
      select: { name: true, owner: { select: { email: true } } },
    });

    // 4. Personel doğrulaması. Çakışma kontrolü ve yazım aşağıdaki transaction'da
    // aynı kilit altında yapılır; aksi halde iki eşzamanlı istek aynı boş slotu
    // görüp ikisi de kaydolabilir.
    if (member_id) {
      // Personel bu butiğe ait mi? (başka kiracının personeline rezervasyon yazılmasın)
      const staff = await prisma.tenantMember.findFirst({
        where: { id: member_id, tenant_id },
        select: { id: true, is_bookable: true },
      });
      if (!staff || !staff.is_bookable) {
        return NextResponse.json({ error: "Staff member not found." }, { status: 404 });
      }
      const [serviceLinks, schedules, timeOff] = await Promise.all([
        prisma.staffService.findMany({ where: { member_id, service_id }, select: { service_id: true } }),
        prisma.staffSchedule.findMany({
          where: { tenant_id, member_id, day_of_week: dayOfWeek },
          select: { start_time: true, end_time: true, break_start: true, break_end: true, is_off: true },
        }),
        prisma.staffTimeOff.findFirst({ where: { tenant_id, member_id, date: booking_date }, select: { id: true } }),
      ]);
      if (!canStaffBookService(serviceLinks.map((link) => link.service_id), service_id) || timeOff || !fitsSchedule(start_time, end_time, schedules)) {
        return NextResponse.json({ error: "That time is not available." }, { status: 409 });
      }
    }

    // 5. Müşteri profilini tenant içinde eşle/oluştur. Aynı kimlikle gelen
    // eşzamanlı booking'ler duplicate müşteri üretmesin diye kimlik anahtarını
    // transaction-scoped advisory lock ile seri hale getiriyoruz.
    let customerId: string | null = null;
    try {
      if (customer_email || customer_phone) {
        customerId = await prisma.$transaction(async (tx) => {
          const identity = customer_email ? `email:${customer_email}` : `phone:${customer_phone}`;
          const lockKey = `${tenant_id}:customer:${identity}`;
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;

          const existing = await tx.customer.findFirst({
            where: { tenant_id, ...(customer_email ? { email: customer_email } : { phone: customer_phone }) },
            select: { id: true },
          });
          if (existing) return existing.id;

          const created = await tx.customer.create({
            data: { tenant_id, name: customer_name, phone: customer_phone || null, email: customer_email || null, status: "new" },
            select: { id: true },
          });
          return created.id;
        });
      }
    } catch (e) {
      console.warn("Could not link customer profile:", e);
    }

    // 6. ONAY BEKLEYEN (pending) rezervasyon yaz — salon kabul edince confirmed olur.
    let booking: { id: string; status: string; booking_date: string; start_time: string };
    let effectiveMemberId = member_id;
    try {
      booking = await prisma.$transaction(async (tx) => {
        if (member_id) {
          // Transaction-scoped lock: same tenant/stylist/day requests cannot
          // pass the overlap check concurrently. The lock is released on commit.
          const lockKey = `${tenant_id}:${member_id}:${booking_date}`;
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;

          const clash = await tx.booking.findFirst({
            where: {
              tenant_id, member_id, booking_date,
              start_time: { lt: end_time },
              end_time: { gt: start_time },
              status: { notIn: ["cancelled", "no_show"] },
            },
            select: { id: true },
          });

          if (clash) throw new BookingConflictError();
        } else {
          // "No preference" still needs a concrete owner. Otherwise an
          // unassigned booking would bypass overlap protection entirely.
          const candidates = await tx.tenantMember.findMany({
            where: { tenant_id, is_bookable: true },
            select: { id: true },
            orderBy: { created_at: "asc" },
          });
          const serviceLinks = candidates.length
            ? await tx.staffService.findMany({
                where: { member_id: { in: candidates.map((candidate) => candidate.id) } },
                select: { member_id: true, service_id: true },
              })
            : [];
          const candidateIds = candidates.map((candidate) => candidate.id);
          const [candidateSchedules, candidateTimeOff] = candidateIds.length
            ? await Promise.all([
                tx.staffSchedule.findMany({
                  where: { tenant_id, member_id: { in: candidateIds }, day_of_week: dayOfWeek },
                  select: { member_id: true, start_time: true, end_time: true, break_start: true, break_end: true, is_off: true },
                }),
                tx.staffTimeOff.findMany({
                  where: { tenant_id, member_id: { in: candidateIds }, date: booking_date },
                  select: { member_id: true },
                }),
              ])
            : [[], []];
          const schedulesByMember = new Map<string, typeof candidateSchedules>();
          for (const schedule of candidateSchedules) {
            const rows = schedulesByMember.get(schedule.member_id) ?? [];
            rows.push(schedule);
            schedulesByMember.set(schedule.member_id, rows);
          }
          const timeOffMembers = new Set(candidateTimeOff.map((row) => row.member_id));
          const linkedServices = new Map<string, string[]>();
          for (const link of serviceLinks) {
            const services = linkedServices.get(link.member_id) ?? [];
            services.push(link.service_id);
            linkedServices.set(link.member_id, services);
          }

          for (const candidate of candidates) {
            const services = linkedServices.get(candidate.id) ?? [];
            if (!canStaffBookService(services, service_id)) continue;
            if (timeOffMembers.has(candidate.id) || !fitsSchedule(start_time, end_time, schedulesByMember.get(candidate.id) ?? [])) continue;

            const lockKey = `${tenant_id}:${candidate.id}:${booking_date}`;
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
            const clash = await tx.booking.findFirst({
              where: {
                tenant_id,
                member_id: candidate.id,
                booking_date,
                start_time: { lt: end_time },
                end_time: { gt: start_time },
                status: { notIn: ["cancelled", "no_show"] },
              },
              select: { id: true },
            });
            if (!clash) {
              effectiveMemberId = candidate.id;
              break;
            }
          }

          if (!effectiveMemberId) throw new BookingConflictError();
        }

        return tx.booking.create({
          data: {
            tenant_id,
            customer_id: customerId,
            member_id: effectiveMemberId,
            service_id,
            customer_name,
            customer_phone: customer_phone || null,
            customer_email: customer_email || null,
            booking_date,
            start_time,
            end_time,
            notes,
            amount,
            status: "pending",
            source: "online",
          },
          select: { id: true, status: true, booking_date: true, start_time: true },
        });
      });
    } catch (e) {
      if (e instanceof BookingConflictError) {
        return NextResponse.json(
          { error: "That time is no longer available. Please pick another slot." },
          { status: 409 }
        );
      }
      console.error("Could not write booking:", e);
      return NextResponse.json({ error: "Could not create the booking." }, { status: 500 });
    }

    if (tenantOwner?.owner?.email) {
      const mail = bookingRequestEmail(
        customer_name,
        tenantOwner.name,
        svc.name,
        booking_date,
        `${start_time}–${end_time}`,
        { email: customer_email, phone: customer_phone }
      );
      const delivery = await sendEmail({ to: tenantOwner.owner.email, ...mail });
      if (!delivery.sent) console.warn("Booking created but owner notification was not sent:", delivery.reason);
    }

    return NextResponse.json({ ok: true, booking });
  } catch (err) {
    console.error("Unexpected booking error:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

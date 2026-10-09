import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { UUID_RE, validateBookingInput } from "@/lib/booking-validation";

export const dynamic = "force-dynamic";

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
      body = await req.json();
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
    });
    if (!valid.ok) {
      return NextResponse.json({ error: valid.error }, { status: 400 });
    }

    const member_id = member_id_raw && UUID_RE.test(member_id_raw) ? member_id_raw : null;

    // 3. Tenant + servis gerçekten var mı? (uydurma id ile yazımı engelle)
    const svc = await prisma.service.findFirst({
      where: { id: service_id, tenant_id, is_active: true },
      select: { id: true, price: true, duration: true },
    });

    if (!svc) {
      return NextResponse.json({ error: "Service not found." }, { status: 404 });
    }
    // Fiyat istemciden DEĞİL, sunucudaki servis kaydından alınır.
    const amount = Number(svc.price ?? 0);

    // 4. Personel doğrulaması. Çakışma kontrolü ve yazım aşağıdaki transaction'da
    // aynı kilit altında yapılır; aksi halde iki eşzamanlı istek aynı boş slotu
    // görüp ikisi de kaydolabilir.
    if (member_id) {
      // Personel bu butiğe ait mi? (başka kiracının personeline rezervasyon yazılmasın)
      const staff = await prisma.tenantMember.findFirst({ where: { id: member_id, tenant_id }, select: { id: true } });
      if (!staff) {
        return NextResponse.json({ error: "Staff member not found." }, { status: 404 });
      }
    }

    // 5. Müşteri profilini en iyi çabayla eşle/oluştur
    let customerId: string | null = null;
    try {
      if (customer_email || customer_phone) {
        const existing = await prisma.customer.findFirst({
          where: { tenant_id, ...(customer_email ? { email: customer_email } : { phone: customer_phone }) },
          select: { id: true },
        });
        if (existing) {
          customerId = existing.id;
        } else {
          const created = await prisma.customer.create({
            data: { tenant_id, name: customer_name, phone: customer_phone || null, email: customer_email || null, status: "new" },
            select: { id: true },
          });
          customerId = created.id;
        }
      }
    } catch (e) {
      console.warn("Could not link customer profile:", e);
    }

    // 6. ONAY BEKLEYEN (pending) rezervasyon yaz — salon kabul edince confirmed olur.
    let booking: { id: string; status: string; booking_date: string; start_time: string };
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
        }

        return tx.booking.create({
          data: {
            tenant_id,
            customer_id: customerId,
            member_id,
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

    return NextResponse.json({ ok: true, booking });
  } catch (err) {
    console.error("Unexpected booking error:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

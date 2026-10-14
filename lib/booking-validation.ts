// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Genel rezervasyon (public booking) doğrulama + çakışma — SAF KOD          ║
// ║  DB / ağ yok. Route handler (app/api/book/route.ts) bu yardımcıları        ║
// ║  kullanır; böylece mantık birim testlerle doğrulanabilir.                  ║
// ╚══════════════════════════════════════════════════════════════════════════╝

export const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type BookingInput = {
  tenant_id: string;
  service_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string; // lowercase'lenmiş; boş olabilir
  booking_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM
  end_time: string; // HH:MM
};

export type ValidationResult = { ok: true } | { ok: false; error: string };

function utcDateOnly(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
}

// Genel rezervasyon girdisini doğrular (fail-closed). `today` enjekte edilebilir
// (test edilebilirlik için); varsayılan bugünün UTC tarihidir.
export function validateBookingInput(
  input: BookingInput,
  today: string = utcDateOnly()
): ValidationResult {
  const { tenant_id, service_id, customer_name, customer_phone, customer_email, booking_date, start_time, end_time } = input;

  if (
    !UUID_RE.test(tenant_id) ||
    !UUID_RE.test(service_id) ||
    !customer_name ||
    !DATE_RE.test(booking_date) ||
    !TIME_RE.test(start_time) ||
    !TIME_RE.test(end_time) ||
    start_time >= end_time
  ) {
    return { ok: false, error: "Missing or invalid fields." };
  }
  if (customer_email && !EMAIL_RE.test(customer_email)) {
    return { ok: false, error: "Invalid email address." };
  }
  if (!customer_phone && !customer_email) {
    return { ok: false, error: "A phone number or email address is required." };
  }
  if (booking_date < today) {
    return { ok: false, error: "A past date cannot be selected." };
  }
  return { ok: true };
}

// İki zaman aralığının (HH:MM string'leri, aynı gün) örtüşüp örtüşmediği.
// Yarı-açık aralık [start, end): bitiş == başlangıç çakışma SAYILMAZ.
// DB sorgusundaki `start < end' && end > start'` koşuluyla aynı semantik.
export function intervalsOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

// Yeni bir rezervasyonun, mevcut (iptal/no-show olmayan) rezervasyonlardan
// herhangi biriyle çakışıp çakışmadığı. SAF: çağıran taraf kayıtları DB'den
// getirip (aynı personel + tarih) buraya verir.
export type ExistingBooking = { start_time: string; end_time: string; status: string };
const BLOCKING_EXEMPT = new Set(["cancelled", "no_show"]);

export function hasConflict(
  start_time: string,
  end_time: string,
  existing: ExistingBooking[]
): boolean {
  return existing.some(
    (b) => !BLOCKING_EXEMPT.has(b.status) && intervalsOverlap(start_time, end_time, b.start_time, b.end_time)
  );
}

export type BookingSchedule = {
  start_time: string;
  end_time: string;
  break_start: string | null;
  break_end: string | null;
  is_off: boolean;
};

// A client can alter the slot buttons, so the API must enforce the same
// working-hours rule as the public booking UI. Multiple schedule rows are
// allowed for split shifts; one matching row is enough.
export function fitsSchedule(
  start_time: string,
  end_time: string,
  schedules: BookingSchedule[]
): boolean {
  return schedules.some((schedule) => {
    if (schedule.is_off || start_time < schedule.start_time || end_time > schedule.end_time) return false;
    if (schedule.break_start && schedule.break_end && intervalsOverlap(start_time, end_time, schedule.break_start, schedule.break_end)) {
      return false;
    }
    return true;
  });
}

// An empty service-link list means the staff member can perform every service.
// Once links exist, the requested service must be explicitly included.
export function canStaffBookService(linkedServiceIds: string[], serviceId: string): boolean {
  return linkedServiceIds.length === 0 || linkedServiceIds.includes(serviceId);
}

export type BookingTimeOff = { memberId: string; date: string };

export function isStaffUnavailable(memberId: string, date: string, timeOff: BookingTimeOff[]): boolean {
  return timeOff.some((entry) => entry.memberId === memberId && entry.date === date);
}

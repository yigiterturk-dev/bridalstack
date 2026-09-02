// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Takvim olayları — SAF KOD (veritabanı erişimi yok)                      ║
// ║                                                                          ║
// ║  Randevu bir ANdır, kiralama bir ARALIKtır. Aralığı takvime olduğu gibi  ║
// ║  dökersek on günlük bir kiralama on günü doldurur ve randevular kaybolur.║
// ║  Bu yüzden kiralama üç role ayrılır: çıkış günü, dönüş günü, arası.      ║
// ╚══════════════════════════════════════════════════════════════════════════╝

export type RentalRole = "pickup" | "due" | "out";

export type RentalSpan = {
  id: string;
  start_date: string; // "2026-09-10"
  due_date: string;
  status: string;
};

/** Ayın kaç günü var. month 1-12. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function dayNumber(date: string): number {
  return Math.floor(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) / 86_400_000);
}

function isoDay(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** İptal ve dönmüş kiralama takvimde yer kaplamaz. */
export function occupiesCalendar(status: string): boolean {
  return status === "reserved" || status === "out";
}

/**
 * Kiralamanın bu ay içindeki günleri ve her günün rolü.
 * Aralık ayı taşıyorsa yalnız aya düşen kısım döner; çıkış veya dönüş başka
 * aydaysa o gün bu ayda görünmez ve arada kalan günler "out" olur.
 */
export function rentalDaysInMonth(
  rental: RentalSpan,
  year: number,
  month: number
): { day: number; role: RentalRole }[] {
  if (!occupiesCalendar(rental.status)) return [];

  const start = dayNumber(rental.start_date);
  const due = dayNumber(rental.due_date);
  if (due < start) return [];

  const out: { day: number; role: RentalRole }[] = [];
  for (let day = 1; day <= daysInMonth(year, month); day++) {
    const n = dayNumber(isoDay(year, month, day));
    if (n < start || n > due) continue;
    out.push({ day, role: n === start ? "pickup" : n === due ? "due" : "out" });
  }
  return out;
}

/** Dışarıda ve dönüş günü geçmiş mi? Takvimde kırmızı görünür. */
export function isLate(rental: RentalSpan, today: string): boolean {
  return rental.status === "out" && dayNumber(rental.due_date) < dayNumber(today);
}

export type CalendarEvent = {
  id: string;
  kind: "appointment" | "rental";
  title: string;
  customerName: string;
  /** Randevuda ISO zaman damgası, kiralamada boş. */
  date: string;
  status: string;
  role?: RentalRole;
  late?: boolean;
};

/**
 * Bir günün gösterilecek olayları, önem sırasına göre.
 * Çıkış ve dönüş günleri en başta: o günler eyleme geçilecek günlerdir.
 * "Sadece dışarıda" satırları en sonda; hiçbiri o gün bir iş gerektirmez.
 */
export function sortDayEvents(events: CalendarEvent[]): CalendarEvent[] {
  const rank = (e: CalendarEvent) => {
    if (e.kind === "appointment") return 1;
    if (e.role === "due") return 0;
    if (e.role === "pickup") return 0;
    return 2;
  };
  return [...events].sort((a, b) => rank(a) - rank(b) || a.date.localeCompare(b.date));
}

/** Bir günde kaç kiralama sadece "dışarıda" — tek satırda özetlenir. */
export function countOut(events: CalendarEvent[]): number {
  return events.filter((e) => e.kind === "rental" && e.role === "out").length;
}

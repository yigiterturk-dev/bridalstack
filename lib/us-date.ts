const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-10" -> "Nov 10, 2026". Saf metin işi: saat dilimi kayması olmaz. Tanınmayan girdi olduğu gibi döner. */
export function usDay(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const mon = MONTHS[Number(m[2]) - 1];
  if (!mon) return iso;
  return `${mon} ${Number(m[3])}, ${m[1]}`;
}

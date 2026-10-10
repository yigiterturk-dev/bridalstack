export const DEFAULT_TIME_ZONE = "UTC";

export const TIME_ZONE_OPTIONS = [
  { value: "America/New_York", label: "Eastern Time (US & Canada)" },
  { value: "America/Chicago", label: "Central Time (US & Canada)" },
  { value: "America/Denver", label: "Mountain Time (US & Canada)" },
  { value: "America/Los_Angeles", label: "Pacific Time (US & Canada)" },
  { value: "Europe/London", label: "London" },
  { value: "Europe/Paris", label: "Central European Time" },
  { value: "Europe/Istanbul", label: "Istanbul" },
  { value: "Australia/Sydney", label: "Sydney" },
  { value: DEFAULT_TIME_ZONE, label: "UTC" },
] as const;

export function isValidTimeZone(value: unknown): value is string {
  const candidate = String(value ?? "").trim();
  if (!candidate) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format();
    return true;
  } catch {
    return false;
  }
}

export function normalizeTimeZone(value: unknown): string {
  return isValidTimeZone(value) ? String(value).trim() : DEFAULT_TIME_ZONE;
}

export function timeZoneLabel(value: unknown): string {
  const normalized = normalizeTimeZone(value);
  return TIME_ZONE_OPTIONS.find((option) => option.value === normalized)?.label ?? normalized.replaceAll("_", " ");
}

export function dateInTimeZone(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: normalizeTimeZone(timeZone), year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function addCalendarDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

/** Convert a local calendar midnight to the corresponding UTC instant. */
export function startOfDayInTimeZone(date: string, timeZone: string): Date {
  return dateTimeInTimeZone(date, "00:00", timeZone);
}

/** Convert a local shop date/time to the corresponding UTC instant. */
export function dateTimeInTimeZone(date: string, time: string, timeZone: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute, second = 0] = time.split(":").map(Number);
  let candidate = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  for (let i = 0; i < 2; i++) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: normalizeTimeZone(timeZone), year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).formatToParts(candidate);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const displayedAsUtc = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second));
    const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
    candidate = new Date(candidate.getTime() + targetAsUtc - displayedAsUtc);
  }
  return candidate;
}

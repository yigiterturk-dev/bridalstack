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

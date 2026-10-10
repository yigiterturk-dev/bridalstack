/** Parse user-controlled numeric input without allowing NaN or Infinity into persistence. */
export function nonNegativeFloat(raw: unknown, fallback = 0): number {
  const value = parseFloat(String(raw ?? "").trim());
  return Number.isFinite(value) ? Math.max(0, value) : fallback;
}

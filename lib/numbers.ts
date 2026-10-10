/** Parse user-controlled numeric input without allowing NaN or Infinity into persistence. */
export function finiteFloat(raw: unknown, fallback = 0): number {
  const value = parseFloat(String(raw ?? "").trim());
  return Number.isFinite(value) ? value : fallback;
}

export function nonNegativeFloat(raw: unknown, fallback = 0): number {
  return Math.max(0, finiteFloat(raw, fallback));
}

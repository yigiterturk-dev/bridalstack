/** Parse user-controlled numeric input without allowing NaN or Infinity into persistence. */
export function finiteFloat(raw: unknown, fallback = 0): number {
  const value = parseFloat(String(raw ?? "").trim());
  return Number.isFinite(value) ? value : fallback;
}

export function nonNegativeFloat(raw: unknown, fallback = 0): number {
  return Math.max(0, finiteFloat(raw, fallback));
}

/** Parse an integer input and keep it inside the domain accepted by the model. */
export function boundedInt(raw: unknown, min: number, max: number, fallback: number): number {
  const text = String(raw ?? "").trim();
  if (!text) return fallback;
  const value = Number.parseInt(text, 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

/** Keep an optional displayed upper price from falling below the base price. */
export function normalizedUpperPrice(raw: unknown, lowerPrice: number): number | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  return Math.max(lowerPrice, nonNegativeFloat(text));
}

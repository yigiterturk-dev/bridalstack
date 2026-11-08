/**
 * Gelin yolculuğu — saklanmaz, her okumada mevcut kayıtlardan türetilir.
 *
 * Gerçek durum değerleri (2026-11-08 kodu):
 *  - Order: draft, confirmed, in_progress, delivered, completed, cancelled.
 *    "completed" = sipariş tamamlandı / elbise mağazada; "delivered" = geline teslim.
 *  - Alteration: lib/alterations.ts (requested, in_progress, ready, delivered, cancelled).
 *  - Appointment: pending, confirmed, completed, cancelled.
 *  - Installment: pending, due, overdue, paid, cancelled.
 */
import { isOpen, isOverdue, kindLabel } from "./alterations.ts";

export type StepKey = "chosen" | "arrived" | "fittings" | "final" | "picked_up";
export type Risk = "late" | "behind" | "on_track" | "married";
export type JourneyStep = { key: StepKey; label: string; done: boolean; idealDate: string | null };
export type Journey = {
  steps: JourneyStep[];
  /** İlk bitmemiş adımın sırası; hepsi bittiyse 5. */
  currentStep: number;
  daysToWedding: number | null;
  risk: Risk;
  reasons: string[];
};
export type JourneyInput = {
  eventDate: string | null;
  today: string;
  orders: { status: string }[];
  appointments: { status: string; date: string }[];
  alterations: { kind: string; status: string; promised_date: string | null }[];
  installments: { status: string }[];
};

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function normalizeEventDate(value: unknown): string | null {
  const s = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && iso(d) === s ? s : null;
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);
}

function daysBefore(date: string, days: number): string {
  return iso(new Date(Date.parse(`${date}T00:00:00Z`) - days * DAY));
}

/** Ay sonu taşmasın: 31 Ağustos − 6 ay = 28 Şubat. */
function monthsBefore(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 - months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return iso(target);
}

const STEP_DEFS: { key: StepKey; label: string; behind: string; ideal: (wedding: string) => string }[] = [
  { key: "chosen", label: "Dress chosen", behind: "Dress not chosen yet", ideal: (w) => monthsBefore(w, 6) },
  { key: "arrived", label: "Dress arrived", behind: "Dress hasn't arrived yet", ideal: (w) => monthsBefore(w, 3) },
  { key: "fittings", label: "Fittings", behind: "No fitting yet", ideal: (w) => daysBefore(w, 56) },
  { key: "final", label: "Final fitting", behind: "Final fitting not done yet", ideal: (w) => daysBefore(w, 14) },
  { key: "picked_up", label: "Picked up", behind: "Dress not picked up yet", ideal: (w) => w },
];

const ORDER_CHOSEN = new Set(["confirmed", "in_progress", "delivered", "completed"]);
const ORDER_IN_SHOP = new Set(["delivered", "completed"]);

export function buildJourney(input: JourneyInput): Journey {
  const { eventDate, today, orders, appointments, alterations, installments } = input;
  const live = alterations.filter((a) => a.status !== "cancelled");

  const raw: Record<StepKey, boolean> = {
    chosen: orders.some((o) => ORDER_CHOSEN.has(o.status)),
    arrived: orders.some((o) => ORDER_IN_SHOP.has(o.status)) || live.length > 0,
    fittings: live.length > 0 || appointments.some((a) => a.status === "completed" && a.date <= today),
    final: live.length > 0 && live.every((a) => a.status === "ready" || a.status === "delivered"),
    picked_up: orders.some((o) => o.status === "delivered") && !live.some((a) => isOpen(a.status)),
  };
  // Sonraki adım bittiyse öncekiler de bitmiştir (tadilatsız gelin teslim alınmış olabilir).
  const done = STEP_DEFS.map((s) => raw[s.key]);
  for (let i = done.length - 2; i >= 0; i--) done[i] = done[i] || done[i + 1];

  const steps: JourneyStep[] = STEP_DEFS.map((s, i) => ({
    key: s.key, label: s.label, done: done[i], idealDate: eventDate ? s.ideal(eventDate) : null,
  }));
  const firstOpen = done.indexOf(false);
  const currentStep = firstOpen === -1 ? 5 : firstOpen;
  const daysToWedding = eventDate ? daysBetween(today, eventDate) : null;

  if (eventDate && eventDate < today) return { steps, currentStep, daysToWedding, risk: "married", reasons: [] };

  const reasons: string[] = [];
  for (const a of alterations) {
    if (!isOverdue(a, today)) continue;
    const n = daysBetween(a.promised_date as string, today);
    reasons.push(`${kindLabel(a.kind)} alteration is ${n} day${n === 1 ? "" : "s"} late`);
  }
  const overdue = installments.filter((i) => i.status === "overdue").length;
  if (overdue) reasons.push(overdue === 1 ? "A payment is overdue" : `${overdue} payments are overdue`);
  if (reasons.length) return { steps, currentStep, daysToWedding, risk: "late", reasons };

  const current = steps[currentStep];
  if (current && current.idealDate && current.idealDate < today) {
    return { steps, currentStep, daysToWedding, risk: "behind", reasons: [STEP_DEFS[currentStep].behind] };
  }
  return { steps, currentStep, daysToWedding, risk: "on_track", reasons: [] };
}

const RISK_RANK: Record<Risk, number> = { late: 0, behind: 1, on_track: 2, married: 3 };

/** Kırmızı → sarı → yolunda; aynı grupta düğünü en yakın olan önde, tarihsiz en sonda. */
export function sortForAttention<T extends { journey: Journey }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const r = RISK_RANK[a.journey.risk] - RISK_RANK[b.journey.risk];
    if (r) return r;
    return (a.journey.daysToWedding ?? Infinity) - (b.journey.daysToWedding ?? Infinity);
  });
}

// Patron, ekibindeki her kişi için hangi bölümleri açacağını seçer.
// SAF KOD: veritabanı yok. Saklanan şey kapatılan modül kimlikleri (+ "analytics").
// Boş liste = her şey açık. Sahip (owner) hiçbir zaman kısıtlanmaz.

import type { ModuleId } from "../config/modules.ts";

export type AccessKey = "numbers" | "clients" | "sales" | "styling" | "money" | "stock" | "team";

/** Menüdeki bölümlerle birebir: patron menüde ne görüyorsa onu açıp kapatır. */
export const ACCESS_SECTIONS: { key: AccessKey; label: string; hint: string; hides: string[] }[] = [
  { key: "clients", label: "Brides & calendar", hint: "brides, appointments, calendar", hides: ["crm", "appointments"] },
  { key: "sales", label: "Sales", hint: "orders, contracts, invoices", hides: ["sales", "invoices"] },
  { key: "styling", label: "Styling", hint: "bookings, services, staff hours", hides: ["booking", "services"] },
  { key: "stock", label: "Stock", hint: "gowns, buying, suppliers", hides: ["inventory"] },
  { key: "money", label: "Money", hint: "cash, payment plans, ledger, checks", hides: ["finance"] },
  { key: "numbers", label: "Numbers", hint: "analytics and reports", hides: ["reports", "analytics"] },
  { key: "team", label: "Team pay", hint: "commissions", hides: ["commissions"] },
];

const KNOWN = new Set(ACCESS_SECTIONS.flatMap((s) => s.hides));

/** Veritabanından gelen listeyi temizler: bilinmeyen değer yok, tekrar yok. */
export function cleanHidden(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((v): v is string => typeof v === "string" && KNOWN.has(v)))];
}

export function isSectionOpen(hidden: string[], key: AccessKey): boolean {
  const section = ACCESS_SECTIONS.find((s) => s.key === key);
  if (!section) return true;
  return !section.hides.some((m) => hidden.includes(m));
}

/** Bölümü aç/kapa: kapalıysa açar, açıksa kapatır. */
export function toggleSection(hidden: string[], key: AccessKey): string[] {
  const section = ACCESS_SECTIONS.find((s) => s.key === key);
  if (!section) return cleanHidden(hidden);
  const current = cleanHidden(hidden);
  if (isSectionOpen(current, key)) return [...current, ...section.hides.filter((m) => !current.includes(m))];
  return current.filter((m) => !section.hides.includes(m));
}

/** Bu kişinin göreceği modüller: plandaki modüllerden patronun kapattıkları çıkar. */
export function visibleModules(enabled: ModuleId[], hidden: string[], role: string): ModuleId[] {
  if (role === "owner") return enabled;
  const h = cleanHidden(hidden);
  return enabled.filter((m) => !h.includes(m));
}

export function canSeeAnalytics(hidden: string[], role: string): boolean {
  return role === "owner" || !cleanHidden(hidden).includes("analytics");
}

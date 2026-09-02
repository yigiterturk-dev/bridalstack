// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Günlük brifing — SAF KOD (veritabanı erişimi yok)                       ║
// ║  Yapay zekâ anahtarı olmadan da çalışır: sayılardan eyleme dönük öneri   ║
// ║  üretir. Amaç, kullanıcının soru sormasını beklemeden ne yapması         ║
// ║  gerektiğini söylemek.                                                   ║
// ╚══════════════════════════════════════════════════════════════════════════╝

export type BriefingInput = {
  followUpCount: number;
  followUpValue: number;
  oldestFollowUpDays: number | null;
  overdueInstallments: number;
  overdueAmount: number;
  pendingBookings: number;
  appointmentsToday: number;
  unconfirmedAppointments: number;
  outOfStock: number;
  lowStock: number;
  deadStock: number;
  unsignedContracts: number;
};

export type BriefingItem = {
  id: string;
  /** urgent: bugün yapılmalı. opportunity: para kazandırır. watch: gözden kaçmasın. */
  tone: "urgent" | "opportunity" | "watch";
  title: string;
  detail: string;
  href: string;
  /** Sıralama ağırlığı; büyük olan üste çıkar. */
  weight: number;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Girdiden sıralı bir yapılacaklar listesi üretir.
 * Sıfır olan sinyaller hiç gösterilmez: boş satır gürültüdür.
 */
export function buildBriefing(input: BriefingInput): BriefingItem[] {
  const items: BriefingItem[] = [];

  if (input.pendingBookings > 0) {
    items.push({
      id: "pending-bookings",
      tone: "urgent",
      title: `${plural(input.pendingBookings, "booking", "bookings")} awaiting approval`,
      detail: "Brides booked online and are waiting to hear back from you.",
      href: "/bookings",
      weight: 100 + input.pendingBookings,
    });
  }

  if (input.overdueInstallments > 0) {
    items.push({
      id: "overdue-installments",
      tone: "urgent",
      title: `${plural(input.overdueInstallments, "payment is", "payments are")} overdue`,
      detail:
        input.overdueAmount > 0
          ? `${Math.round(input.overdueAmount).toLocaleString()} outstanding across those installments.`
          : "Reminder emails have gone out, but nobody has paid yet.",
      href: "/orders",
      weight: 95 + input.overdueInstallments,
    });
  }

  if (input.unconfirmedAppointments > 0) {
    items.push({
      id: "unconfirmed-appointments",
      tone: "urgent",
      title: `${plural(input.unconfirmedAppointments, "appointment", "appointments")} still unconfirmed`,
      detail: "Confirm them so the bride knows her fitting is booked.",
      href: "/appointments",
      weight: 80,
    });
  }

  if (input.followUpCount > 0) {
    items.push({
      id: "follow-ups",
      tone: "opportunity",
      title: `${plural(input.followUpCount, "bride", "brides")} loved a gown but have not ordered`,
      detail:
        input.oldestFollowUpDays !== null
          ? `Roughly ${Math.round(input.followUpValue).toLocaleString()} in play. The longest has been waiting ${input.oldestFollowUpDays} days.`
          : `Roughly ${Math.round(input.followUpValue).toLocaleString()} in play.`,
      href: "/follow-ups",
      weight: 90 + Math.min(input.followUpCount, 20),
    });
  }

  if (input.unsignedContracts > 0) {
    items.push({
      id: "unsigned-contracts",
      tone: "opportunity",
      title: `${plural(input.unsignedContracts, "contract is", "contracts are")} waiting for a signature`,
      detail: "Send the signing link again; unsigned contracts stall production.",
      href: "/contracts",
      weight: 70,
    });
  }

  if (input.appointmentsToday > 0) {
    items.push({
      id: "today",
      tone: "watch",
      title: `${plural(input.appointmentsToday, "appointment", "appointments")} today`,
      detail: "Pull the gowns before each bride arrives.",
      href: "/calendar",
      weight: 60,
    });
  }

  if (input.outOfStock > 0) {
    items.push({
      id: "out-of-stock",
      tone: "watch",
      title: `${plural(input.outOfStock, "gown is", "gowns are")} out of stock`,
      detail: "They still show in your catalogue and can be tried on.",
      href: "/products",
      weight: 50,
    });
  } else if (input.lowStock > 0) {
    items.push({
      id: "low-stock",
      tone: "watch",
      title: `${plural(input.lowStock, "gown is", "gowns are")} running low`,
      detail: "Three or fewer left in stock.",
      href: "/products",
      weight: 40,
    });
  }

  if (input.deadStock > 0) {
    items.push({
      id: "dead-stock",
      tone: "watch",
      title: `${plural(input.deadStock, "gown has", "gowns have")} never been tried on`,
      detail: "Move them to the front of the floor or feature them at your next trunk show.",
      href: "/products",
      weight: 30,
    });
  }

  return items.sort((a, b) => b.weight - a.weight);
}

/** Brifingi yapay zekâya verilecek kısa bir metne çevirir. */
export function briefingToPrompt(items: BriefingItem[]): string {
  if (items.length === 0) return "Nothing needs attention today.";
  return items.map((i) => `- [${i.tone}] ${i.title}. ${i.detail}`).join("\n");
}

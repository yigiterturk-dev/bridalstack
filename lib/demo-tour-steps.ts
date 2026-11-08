/**
 * Tanıtım turunun adımları. Saf veri — testten okunabilsin diye bileşenden
 * ayrı duruyor: bir rota yeniden adlandırıldığında tur sessizce ölmesin.
 */

export type Step = {
  href: string;
  title: string;
  body: string;
};

export const STEPS: Step[] = [
  {
    href: "/dashboard",
    title: "Today: who needs you",
    body: "Every bride with her wedding countdown. Red means something is late, amber means she's falling behind. Click a name to see her whole journey. Everything here is made up — nothing can break.",
  },
  {
    href: "/rentals",
    title: "One gown is out with a bride",
    body: "Elena picked hers up two days ago. Note when it left stock: on pickup, not on booking. The calendar held the dates; the rack held the dress.",
  },
  {
    href: "/cleaning",
    title: "The returned one didn't go back on the rack",
    body: "It went to the cleaner first. A dress in cleaning is out of stock — so nobody sells or rents it while it's hanging in a van.",
  },
  {
    href: "/alterations",
    title: "Rosa's fitting queue",
    body: "Hem, bust, bustle — each with a promised date and a price. Late jobs rise to the top. The fee hits the till on delivery, once.",
  },
  {
    href: "/commissions",
    title: "What each consultant earned",
    body: "Per line, not per invoice — so a veil and a gown on the same order can pay different rates. This is usually the spreadsheet nobody wants to maintain.",
  },
];


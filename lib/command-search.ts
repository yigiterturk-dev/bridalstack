// ⌘K paletinin saf mantığı: eşleşme puanı, sıralama ve komut listesi.
// Prisma/React yok — node test koşucusu doğrudan çalıştırır.

export type NavItem = { href: string; label: string; icon: string };
export type NavGroup = { section?: string; items: NavItem[] };
export type Command = { href: string; label: string; icon: string; section?: string; keywords?: string[] };

function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** 3 = baştan eşleşir, 2 = bir kelimenin başı, 1 = içinde geçer, 0 = yok. */
export function scoreMatch(query: string, text: string): number {
  const q = fold(query);
  const t = fold(text);
  if (!q) return 3;
  if (t.startsWith(q)) return 3;
  if (t.split(/[\s\-/]+/).some((w) => w.startsWith(q))) return 2;
  if (t.includes(q)) return 1;
  return 0;
}

export function filterCommands<T extends { label: string; keywords?: string[] }>(query: string, items: T[]): T[] {
  if (!fold(query)) return items;
  return items
    .map((item, i) => ({
      item,
      i,
      s: Math.max(scoreMatch(query, item.label), ...(item.keywords ?? []).map((k) => scoreMatch(query, k))),
    }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.item);
}

// Hızlı işler: hedef modül menüde yoksa (paket kapalı) gösterilmez.
const QUICK_ACTIONS: (Command & { needs: string })[] = [
  { href: "/customers/new", label: "New bride", icon: "person_add", needs: "/customers", keywords: ["customer", "client", "add"] },
  { href: "/orders/new", label: "New order", icon: "add_shopping_cart", needs: "/orders", keywords: ["sale", "dress"] },
  { href: "/appointments", label: "Book a fitting", icon: "event_available", needs: "/appointments", keywords: ["appointment", "fitting"] },
  { href: "/alterations", label: "Open an alteration", icon: "content_cut", needs: "/alterations", keywords: ["tailor", "hem"] },
];

// Sade adı verilen sayfalar eski/sektör adıyla da bulunur.
const PAGE_KEYWORDS: Record<string, string[]> = {
  "/purchase-orders": ["purchase orders", "po", "stock"],
  "/ledger": ["ledger", "accounting", "expenses"],
  "/installments": ["installments", "layaway"],
  "/invoices": ["invoices", "owed", "unpaid"],
};

export function buildCommands(groups: NavGroup[]): { actions: Command[]; pages: Command[] } {
  const seen = new Set<string>();
  const pages: Command[] = [];
  for (const g of groups) {
    for (const item of g.items) {
      if (seen.has(item.href)) continue;
      seen.add(item.href);
      pages.push({ ...item, section: g.section, keywords: PAGE_KEYWORDS[item.href] });
    }
  }
  const actions = QUICK_ACTIONS.filter((a) => seen.has(a.needs)).map(({ needs: _needs, ...a }) => a);
  return { actions, pages };
}

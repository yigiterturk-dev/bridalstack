export type ModuleId =
  | "crm"
  | "appointments"
  | "sales"
  | "invoices"
  | "finance"
  | "inventory"
  | "reports"
  | "commissions"
  | "booking"
  | "services";

/** Menü girdisi. `soon: true` ise sayfa henüz yok; menüde gösterilmez. */
export type NavItem = { href: string; label: string; icon: string; soon?: true };

export type ModuleDefinition = {
  id: ModuleId;
  name: string;
  description: string;
  icon: string;
  pack: PackId;
  routes: string[];
  navItems: NavItem[];
  dependencies?: ModuleId[];
};

export type PackId = "base" | "sales" | "finance" | "inventory" | "pro" | "salon";

export type PackDefinition = {
  id: PackId;
  name: string;
  description: string;
  modules: ModuleId[];
  monthlyPrice: number;
  color: string;
};

export const MODULES: Record<ModuleId, ModuleDefinition> = {
  crm: {
    id: "crm",
    name: "Customer Management",
    description: "Customer profiles, notes, status tracking",
    icon: "groups",
    pack: "base",
    routes: ["/customers", "/customers/new", "/customers/[id]", "/follow-ups"],
    navItems: [
      { href: "/customers", label: "Customers", icon: "groups" },
      { href: "/follow-ups", label: "Follow-ups", icon: "notifications_active" },
    ],
  },
  appointments: {
    id: "appointments",
    name: "Appointments & Calendar",
    description: "Scheduling, calendar view, reminders",
    icon: "event",
    pack: "base",
    routes: ["/appointments", "/calendar"],
    navItems: [
      { href: "/appointments", label: "Appointments", icon: "event" },
      { href: "/calendar", label: "Calendar", icon: "calendar_month" },
    ],
  },
  sales: {
    id: "sales",
    name: "Sales & Contracts",
    description: "Orders, contracts, installment plans",
    icon: "receipt_long",
    pack: "sales",
    routes: ["/orders", "/orders/new", "/orders/[id]", "/contracts"],
    navItems: [
      { href: "/orders", label: "Orders", icon: "receipt_long" },
      { href: "/contracts", label: "Contracts", icon: "draw" },
    ],
    dependencies: ["crm"],
  },
  invoices: {
    id: "invoices",
    name: "Invoicing",
    description: "Outstanding balances, ageing and printable invoices",
    icon: "description",
    pack: "sales",
    routes: ["/invoices", "/invoices/new", "/invoices/[id]"],
    navItems: [
      { href: "/invoices", label: "Balances due", icon: "description" },
    ],
    dependencies: ["sales"],
  },
  reports: {
    id: "reports",
    name: "Reports",
    description: "Exportable order, stylist and category detail",
    icon: "analytics",
    pack: "sales",
    routes: ["/reports"],
    navItems: [
      { href: "/reports", label: "Reports", icon: "analytics" },
    ],
    dependencies: ["sales"],
  },
  finance: {
    id: "finance",
    name: "Finance",
    description: "Cash register, installments, ledger, checks",
    icon: "account_balance",
    pack: "finance",
    routes: ["/cash", "/installments", "/ledger", "/checks"],
    navItems: [
      { href: "/cash", label: "Cash", icon: "account_balance" },
      { href: "/installments", label: "Payment plans", icon: "receipt" },
      { href: "/ledger", label: "Money in & out", icon: "account_balance_wallet" },
      { href: "/checks", label: "Checks", icon: "request_quote" },
    ],
    dependencies: ["sales"],
  },
  inventory: {
    id: "inventory",
    name: "Inventory",
    description: "Products, stock, suppliers, counts, returns",
    icon: "checkroom",
    pack: "inventory",
    routes: [
      "/products", "/products/new", "/products/[id]",
      "/suppliers", "/purchase-orders", "/purchase-orders/new", "/purchase-orders/[id]",
      "/inventory-count", "/returns",
      "/rentals", "/cleaning", "/alterations",
      "/try-ons", "/trunk-shows",
    ],
    navItems: [
      { href: "/products", label: "Products", icon: "checkroom" },
      { href: "/try-ons", label: "Try-ons", icon: "favorite" },
      { href: "/trunk-shows", label: "Trunk shows", icon: "event_note" },
      { href: "/suppliers", label: "Suppliers", icon: "local_shipping" },
      { href: "/purchase-orders", label: "Buying", icon: "inbox" },
      { href: "/inventory-count", label: "Stock count", icon: "inventory" },
      { href: "/returns", label: "Returns", icon: "swap_horiz" },
      { href: "/rentals", label: "Rentals", icon: "event_available" },
      { href: "/alterations", label: "Alterations", icon: "content_cut" },
      { href: "/cleaning", label: "Cleaning", icon: "local_laundry_service" },
    ],
  },
  commissions: {
    id: "commissions",
    name: "Commissions & Staff",
    description: "Commission tracking, staff performance, AI stylist",
    icon: "payments",
    pack: "pro",
    routes: ["/commissions", "/commissions/rules", "/staff", "/workflows", "/ai-stylist"],
    navItems: [
      { href: "/commissions", label: "Commissions", icon: "payments" },
      { href: "/staff", label: "Team", icon: "badge" },
      { href: "/workflows", label: "Automations", icon: "bolt" },
      { href: "/ai-stylist", label: "AI Stylist", icon: "auto_awesome" },
    ],
    dependencies: ["sales"],
  },
  booking: {
    id: "booking",
    name: "Online Booking",
    description: "Public booking page, availability, confirmations",
    icon: "calendar_month",
    pack: "base",
    routes: ["/bookings", "/schedule"],
    navItems: [
      { href: "/bookings", label: "Bookings", icon: "calendar_month" },
      { href: "/schedule", label: "Staff hours", icon: "date_range" },
    ],
  },
  services: {
    id: "services",
    name: "Services & Staff",
    description: "Service menu, pricing, staff management",
    icon: "content_cut",
    pack: "base",
    routes: ["/services"],
    navItems: [
      { href: "/services", label: "Services", icon: "content_cut" },
    ],
  },
};

export const PACKS: Record<PackId, PackDefinition> = {
  base: {
    id: "base",
    name: "Base",
    description: "Customer management & appointments",
    modules: ["crm", "appointments"],
    monthlyPrice: 0,
    color: "#6b7280",
  },
  sales: {
    id: "sales",
    name: "Sales",
    description: "Orders, contracts, invoices and reports",
    modules: ["sales", "invoices", "reports"],
    monthlyPrice: 39,
    color: "#2563eb",
  },
  finance: {
    id: "finance",
    name: "Finance",
    description: "Cash register, installments, ledger and checks",
    modules: ["finance"],
    monthlyPrice: 19,
    color: "#047857",
  },
  inventory: {
    id: "inventory",
    name: "Inventory",
    description: "Products, stock, try-ons and trunk shows",
    modules: ["inventory"],
    monthlyPrice: 29,
    color: "#7c3aed",
  },
  pro: {
    id: "pro",
    name: "Pro",
    description: "Team, automations and the AI stylist",
    modules: ["commissions"],
    monthlyPrice: 29,
    color: "#d97706",
  },
  salon: {
    id: "salon",
    name: "Salon & Booking",
    description: "Online booking, services, staff scheduling",
    modules: ["booking", "services"],
    monthlyPrice: 0,
    color: "#e11d48",
  },
};

export const ALL_MODULE_IDS = Object.keys(MODULES) as ModuleId[];
export const ALL_PACK_IDS = Object.keys(PACKS) as PackId[];

export function getModulesForPacks(packIds: PackId[]): ModuleId[] {
  const modules = new Set<ModuleId>();
  for (const packId of packIds) {
    const pack = PACKS[packId];
    if (!pack) continue;
    for (const moduleId of pack.modules) {
      modules.add(moduleId);
      const mod = MODULES[moduleId];
      if (mod.dependencies) {
        for (const dep of mod.dependencies) modules.add(dep);
      }
    }
  }
  return Array.from(modules);
}

export function calculateMonthlyPrice(packIds: PackId[]): number {
  return packIds.reduce((sum, id) => sum + (PACKS[id]?.monthlyPrice ?? 0), 0);
}

/**
 * Yıllık plan: 12 ayın bedeli 10 ay. İki ay bedava (%17 indirim) — rakiplerin
 * yıllık indirim bandına denk gelir ve nakit akışını öne çeker.
 */
export const ANNUAL_BILLING_MONTHS = 10;

export function annualPrice(monthlyPrice: number): number {
  return monthlyPrice * ANNUAL_BILLING_MONTHS;
}

export function calculateAnnualPrice(packIds: PackId[]): number {
  return packIds.reduce((sum, id) => sum + annualPrice(PACKS[id]?.monthlyPrice ?? 0), 0);
}

/**
 * Menü: üstte butiğin kendi seçtiği ekranlar (WordPress gibi), gerisi kapalı
 * gruplarda. Seçim yoksa her butiğin her gün açtığı 5 ekran varsayılan.
 */
export const DEFAULT_NAV_PINS = ["/customers", "/appointments", "/orders", "/products", "/invoices"];
export const MAX_NAV_PINS = 10;
const NAV_LABELS: Record<string, string> = { "/customers": "Brides", "/products": "Stock" };
const ANALYTICS_ITEM: NavItem = { href: "/analytics", label: "Analytics", icon: "insights" };

/** Gelen listeyi temizler: tekrar yok, Today yok, en fazla MAX_NAV_PINS. */
export function normalizeNavPins(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const out: string[] = [];
  for (const v of value) {
    if (typeof v !== "string" || !v.startsWith("/") || v === "/dashboard" || out.includes(v)) continue;
    out.push(v);
    if (out.length >= MAX_NAV_PINS) break;
  }
  return out;
}

export function getNavForModules(enabledModules: ModuleId[], pins?: string[] | null) {
  const label = (n: NavItem): NavItem => ({ ...n, label: NAV_LABELS[n.href] ?? n.label });
  const available: NavItem[] = [ANALYTICS_ITEM];
  for (const id of enabledModules) {
    available.push(...(MODULES[id]?.navItems ?? []).filter((n) => !n.soon));
  }

  const primary: NavItem[] = [{ href: "/dashboard", label: "Today", icon: "today" }];
  for (const href of pins ?? DEFAULT_NAV_PINS) {
    const item = available.find((n) => n.href === href);
    if (item && !primary.some((p) => p.href === href)) primary.push(label(item));
  }
  const taken = new Set(primary.map((n) => n.href));

  const groups: { section?: string; items: NavItem[] }[] = [{ items: primary }];

  const sectionMap: { section: string; moduleIds: ModuleId[]; extra?: NavItem[] }[] = [
    { section: "Numbers", moduleIds: ["reports"], extra: [ANALYTICS_ITEM] },
    { section: "Clients & calendar", moduleIds: ["crm", "appointments"] },
    { section: "Sales", moduleIds: ["sales", "invoices"] },
    { section: "Styling", moduleIds: ["booking", "services"] },
    { section: "Money", moduleIds: ["finance"] },
    { section: "Stock", moduleIds: ["inventory"] },
    { section: "Team", moduleIds: ["commissions"] },
  ];

  for (const group of sectionMap) {
    const items: NavItem[] = (group.extra ?? []).filter((n) => !taken.has(n.href));
    for (const moduleId of group.moduleIds) {
      if (!enabledModules.includes(moduleId)) continue;
      // Sayfası olmayan girdiler menüye girmez; 404'e götüren bağlantı olmasın.
      items.push(...MODULES[moduleId].navItems.filter((n) => !n.soon && !taken.has(n.href)).map(label));
    }
    if (items.length > 0) groups.push({ section: group.section, items });
  }

  return groups;
}

export function isRouteAllowed(path: string, enabledModules: ModuleId[]): boolean {
  if (path === "/dashboard" || path === "/settings" || path === "/login" || path.startsWith("/analytics")) return true;

  for (const moduleId of enabledModules) {
    const mod = MODULES[moduleId];
    for (const route of mod.routes) {
      const routeParts = route.split("/").filter(Boolean);
      const pathParts = path.split("/").filter(Boolean);
      if (pathParts.length < routeParts.length) continue;
      const matches = routeParts.every((part, index) => part.startsWith("[") && part.endsWith("]") || part === pathParts[index]);
      if (matches) return true;
    }
  }
  return false;
}


// ─── Hazırlık durumu ───────────────────────────────────────────────────────
// Bir modül, en az bir menü girdisinin gerçek bir sayfası varsa "canlı"dır.
// Hiçbir sayfası olmayan paket satılamaz: parasını alıp boş ekran vermeyelim.

export function isModuleLive(moduleId: ModuleId): boolean {
  return MODULES[moduleId]?.navItems.some((n) => !n.soon) ?? false;
}

export function packLiveModules(packId: PackId): ModuleId[] {
  return (PACKS[packId]?.modules ?? []).filter(isModuleLive);
}

export function packUpcomingModules(packId: PackId): ModuleId[] {
  return (PACKS[packId]?.modules ?? []).filter((m) => !isModuleLive(m));
}

/**
 * Ücretsiz paketler her kiracıda açık gelir. Tanıtım sayfası online randevu
 * sayfasını ve müşteri portalını ücretsiz katmanın parçası olarak vaat ediyor;
 * yeni kayıtlara bunları vermezsek vaat tutmaz.
 */
export const FREE_PACK_IDS: PackId[] = ALL_PACK_IDS.filter(
  (id) => PACKS[id].monthlyPrice === 0
);

/** Satın alınabilir mi? Hiç çalışan modülü olmayan paket satışa kapalıdır. */
export function isPackSellable(packId: PackId): boolean {
  if (PACKS[packId]?.monthlyPrice === 0) return false; // ücretsiz, zaten herkeste
  return packLiveModules(packId).length > 0;
}

export const SELLABLE_PACK_IDS: PackId[] = ALL_PACK_IDS.filter(isPackSellable);

// ─── Para birimi ───────────────────────────────────────────────────────────
// Fiyatlar tek yerden biçimlendirilir. Hedef pazar değişirse burası değişir.
export const CURRENCY_SYMBOL = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL ?? "$";

export function formatPrice(amount: number): string {
  // Eksi işareti para biriminin önüne gelir: "$-250" değil "−$250".
  const sign = amount < 0 ? "−" : "";
  // Tam sayıda kuruş yok ("$2,740"); kesirliyse hep iki hane ("$2,971.50", "$2,971.5" değil).
  const abs = Math.abs(amount);
  const cents = Math.round(abs * 100) % 100 !== 0;
  const text = abs.toLocaleString("en-US", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
  return `${sign}${CURRENCY_SYMBOL}${text}`;
}

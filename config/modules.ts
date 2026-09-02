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
      { href: "/invoices", label: "Invoices", icon: "description" },
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
      { href: "/cash", label: "Cash", icon: "account_balance", soon: true },
      { href: "/installments", label: "Installments", icon: "receipt", soon: true },
      { href: "/ledger", label: "Ledger", icon: "account_balance_wallet", soon: true },
      { href: "/checks", label: "Checks", icon: "request_quote", soon: true },
    ],
    dependencies: ["sales"],
  },
  inventory: {
    id: "inventory",
    name: "Inventory",
    description: "Products, stock, suppliers, counts, returns",
    icon: "checkroom",
    pack: "inventory",
    routes: ["/products", "/products/new", "/products/[id]", "/suppliers", "/inventory-count", "/returns", "/rentals", "/cleaning", "/alterations", "/try-ons"],
    navItems: [
      { href: "/products", label: "Products", icon: "checkroom" },
      { href: "/try-ons", label: "Try-Ons", icon: "favorite" },
      { href: "/trunk-shows", label: "Trunk Shows", icon: "event_note" },
      { href: "/suppliers", label: "Suppliers", icon: "local_shipping" },
      { href: "/inventory-count", label: "Stock Count", icon: "inventory" },
      { href: "/returns", label: "Returns", icon: "swap_horiz" },
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
      { href: "/commissions", label: "Commissions", icon: "payments", soon: true },
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
      { href: "/schedule", label: "Schedule", icon: "date_range" },
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
    monthlyPrice: 29,
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

export function getNavForModules(enabledModules: ModuleId[]) {
  const groups: { section?: string; items: NavItem[] }[] = [
    { items: [
      { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
      { href: "/analytics", label: "Analytics", icon: "insights" },
    ] },
  ];

  const sectionMap: Record<string, { section: string; moduleIds: ModuleId[] }> = {
    salon: { section: "Booking", moduleIds: ["booking", "services"] },
    base: { section: "Clients", moduleIds: ["crm", "appointments"] },
    sales: { section: "Sales", moduleIds: ["sales", "invoices", "reports"] },
    finance: { section: "Finance", moduleIds: ["finance"] },
    inventory: { section: "Inventory", moduleIds: ["inventory"] },
    pro: { section: "Management", moduleIds: ["commissions"] },
  };

  for (const group of Object.values(sectionMap)) {
    const items: NavItem[] = [];
    for (const moduleId of group.moduleIds) {
      if (!enabledModules.includes(moduleId)) continue;
      // Sayfası olmayan girdiler menüye girmez; 404'e götüren bağlantı olmasın.
      items.push(...MODULES[moduleId].navItems.filter((n) => !n.soon));
    }
    if (items.length > 0) {
      groups.push({ section: group.section, items });
    }
  }

  return groups;
}

export function isRouteAllowed(path: string, enabledModules: ModuleId[]): boolean {
  if (path === "/dashboard" || path === "/settings" || path === "/login" || path.startsWith("/analytics")) return true;

  for (const moduleId of enabledModules) {
    const mod = MODULES[moduleId];
    for (const route of mod.routes) {
      const pattern = route.replace(/\[.*?\]/g, "[^/]+");
      const regex = new RegExp(`^${pattern}(/|$)`);
      if (regex.test(path)) return true;
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
  return `${CURRENCY_SYMBOL}${amount.toLocaleString()}`;
}

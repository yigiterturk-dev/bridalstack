// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  RBAC — Rol tabanlı erişim kontrolü                                        ║
// ║  Roller: owner > admin > stylist > viewer                                  ║
// ╚══════════════════════════════════════════════════════════════════════════╝

export type Role = "owner" | "admin" | "stylist" | "viewer";

// Eski kayıtlarla uyumluluk: "member" -> "stylist"
export function normalizeRole(role: string | null | undefined): Role {
  switch (role) {
    case "owner":
      return "owner";
    case "admin":
      return "admin";
    case "stylist":
    case "member":
      return "stylist";
    case "viewer":
      return "viewer";
    default:
      return "viewer";
  }
}

// İzin türleri — modül düzeyinde
export type Permission =
  | "customers.view"
  | "customers.manage"
  | "orders.view"
  | "orders.manage"
  | "products.view"
  | "products.manage"
  | "appointments.view"
  | "appointments.manage"
  | "staff.manage"
  | "billing.manage"
  | "settings.manage"
  | "import.run";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: [
    "customers.view", "customers.manage",
    "orders.view", "orders.manage",
    "products.view", "products.manage",
    "appointments.view", "appointments.manage",
    "staff.manage", "billing.manage", "settings.manage", "import.run",
  ],
  admin: [
    "customers.view", "customers.manage",
    "orders.view", "orders.manage",
    "products.view", "products.manage",
    "appointments.view", "appointments.manage",
    "staff.manage", "settings.manage", "import.run",
    // admin faturalandırmayı yönetemez (billing.manage yok)
  ],
  stylist: [
    "customers.view", "customers.manage",
    "orders.view", "orders.manage",
    "products.view",
    "appointments.view", "appointments.manage",
  ],
  viewer: [
    "customers.view",
    "orders.view",
    "products.view",
    "appointments.view",
  ],
};

const ROLE_RANK: Record<Role, number> = { owner: 3, admin: 2, stylist: 1, viewer: 0 };

export function hasPermission(role: string | null | undefined, permission: Permission): boolean {
  const r = normalizeRole(role);
  return ROLE_PERMISSIONS[r].includes(permission);
}

// Belirtilen rolün, hedef rolden en az o kadar yetkili olup olmadığı
export function roleAtLeast(role: string | null | undefined, min: Role): boolean {
  return ROLE_RANK[normalizeRole(role)] >= ROLE_RANK[min];
}

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Administrator",
  stylist: "Stylist",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: "Full access + billing",
  admin: "Full access except billing",
  stylist: "Manage customers, appointments, and orders",
  viewer: "Read-only access",
};

export const ASSIGNABLE_ROLES: Role[] = ["admin", "stylist", "viewer"];

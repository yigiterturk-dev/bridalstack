"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant, getCurrentMember } from "@/lib/tenant";
import { hasPermission } from "@/lib/rbac";
import { isDemoTenant } from "@/lib/demo-identity";
import { normalizeNavPins } from "@/config/modules";

const NAV_PINS_COOKIE = "bs_nav_pins"; // layout.tsx aynı adı okur

/**
 * Ana menüye eklenen sayfaları kaydeder. Ayar yetkisi olan kullanıcıda butiğin
 * ayarına yazılır (tüm ekip aynı menüyü görür); demoda ve yetkisi olmayanda
 * yalnız o tarayıcıda (çerez) kalır.
 */
export async function saveNavPins(pins: string[]) {
  const tenant = await getCurrentTenant();
  if (!tenant) return;
  const clean = normalizeNavPins(pins) ?? [];
  const jar = await cookies();
  const member = await getCurrentMember();

  if (isDemoTenant(tenant) || !hasPermission(member?.role, "settings.manage")) {
    jar.set(NAV_PINS_COOKIE, JSON.stringify(clean), { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true });
  } else {
    const settings = (tenant.settings as Record<string, unknown> | null) ?? {};
    await prisma.tenant.update({ where: { id: tenant.id }, data: { settings: { ...settings, nav_pins: clean } } });
    jar.delete(NAV_PINS_COOKIE);
  }
  revalidatePath("/", "layout");
}

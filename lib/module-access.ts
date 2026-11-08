import { redirect } from "next/navigation";
import { getCurrentTenant } from "@/lib/tenant";
import type { ModuleId } from "@/config/modules";

/**
 * Server action kapısı: sayfası kapalı olan bölüme elle istek atılsa bile yazılmaz.
 * Plan içermiyorsa ya da patron bu kişiye kapattıysa reddeder (getCurrentTenant tek kapı).
 */
export async function assertModule(moduleId: ModuleId): Promise<void> {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/login");
  if (!tenant.enabled_modules.includes(moduleId)) redirect("/dashboard?error=closed");
}

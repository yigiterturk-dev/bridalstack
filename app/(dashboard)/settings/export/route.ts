import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { exportTenantData } from "@/lib/account";

export const dynamic = "force-dynamic";

/** Kiracının işletme verisini JSON olarak indirir (veri taşınabilirliği). */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  const tenant = await getCurrentTenant();
  if (!tenant) {
    return new Response("No workspace", { status: 400 });
  }

  const data = await exportTenantData(tenant.id);

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="bridalstack-${tenant.slug}-export.json"`,
      "Cache-Control": "no-store",
    },
  });
}

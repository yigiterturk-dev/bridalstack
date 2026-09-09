import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import BookingsTable from "./bookings-table";
import ModuleGuard from "@/components/module-guard";

export const dynamic = "force-dynamic";

export default async function BookingsPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");
  // Modül kapısı: bu sayfa ücretsiz "salon" paketine ait, ama kapı yine de
  // uygulanmalı — paketi olmayan kiracı sayfayı doğrudan URL ile açabiliyordu.
  if (!tenant.enabled_modules.includes("booking")) {
    return <ModuleGuard moduleId="booking" enabledModules={tenant.enabled_modules}>{null}</ModuleGuard>;
  }

  const rows = await prisma.booking.findMany({
    where: { tenant_id: tenant.id },
    orderBy: [{ booking_date: "desc" }, { start_time: "desc" }],
    select: {
      id: true, customer_name: true, customer_phone: true, customer_email: true,
      booking_date: true, start_time: true, end_time: true, status: true,
      notes: true, amount: true,
      service: { select: { name: true } },
      member: { select: { display_name: true } },
    },
  });

  // Şablon Supabase'in `services` / `tenant_members` adlarını bekliyor.
  const bookings = rows.map(({ service, member, ...b }) => ({
    ...b,
    services: service,
    tenant_members: member,
  }));

  return <BookingsTable bookings={bookings as never} />;
}

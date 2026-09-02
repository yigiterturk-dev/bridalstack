import { NextRequest } from "next/server";
import { getCurrentTenant } from "@/lib/tenant";
import { toCsv, csvResponse } from "@/lib/csv";
import { loadReports, resolveRange } from "../data";

const REPORTS = ["orders", "staff", "categories"] as const;
type ReportName = (typeof REPORTS)[number];

/** Rapor tablolarını CSV olarak indirir. Kiracı filtresi loadReports içinde. */
export async function GET(req: NextRequest) {
  const tenant = await getCurrentTenant();
  if (!tenant) return new Response("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const requested = url.searchParams.get("report") ?? "orders";
  if (!(REPORTS as readonly string[]).includes(requested)) {
    return new Response("Unknown report", { status: 400 });
  }
  const report = requested as ReportName;

  const range = resolveRange(url.searchParams.get("range") ?? undefined);
  const data = await loadReports(tenant.id, range);
  const stamp = new Date().toISOString().split("T")[0];
  const iso = (d: Date) => d.toISOString().split("T")[0];

  if (report === "staff") {
    return csvResponse(
      `staff-${stamp}.csv`,
      toCsv(["Stylist", "Orders", "Revenue"], data.staff.map((s) => [s.name, s.orders, s.revenue]))
    );
  }

  if (report === "categories") {
    return csvResponse(
      `categories-${stamp}.csv`,
      toCsv(
        ["Category", "Try-ons", "Units in stock", "Stock value"],
        data.categories.map((c) => [c.category, c.tryOns, c.units, c.revenue])
      )
    );
  }

  return csvResponse(
    `orders-${stamp}.csv`,
    toCsv(
      ["Reference", "Date", "Customer", "Type", "Status", "Total", "Collected", "Outstanding", "Stylist"],
      data.orderRows.map((o) => [
        o.ref_no, iso(o.date), o.customerName, o.order_type, o.status,
        o.total, o.collected, o.outstanding, o.salesPerson ?? "",
      ])
    )
  );
}

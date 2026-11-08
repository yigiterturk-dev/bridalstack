import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant, getCurrentUserId } from "@/lib/tenant";
import { createPublicToken } from "@/lib/tokens";

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenant = await getCurrentTenant();
  if (!tenant) return NextResponse.json({ error: "No tenant" }, { status: 400 });
  if (!tenant.enabled_modules.includes("crm")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const customer_id = body && typeof body === "object" && typeof (body as Record<string, unknown>).customer_id === "string"
    ? (body as Record<string, unknown>).customer_id as string
    : "";
  if (!customer_id.trim() || customer_id.length > 64) {
    return NextResponse.json({ error: "customer_id required" }, { status: 400 });
  }

  // Müşteri gerçekten bu kiracıya mı ait? RLS yok, elle doğruluyoruz.
  const customer = await prisma.customer.findFirst({
    where: { id: customer_id.trim(), tenant_id: tenant.id },
    select: { id: true },
  });
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const token = createPublicToken();

  try {
    await prisma.portalToken.create({
      data: { tenant_id: tenant.id, customer_id: customer.id, token },
    });
  } catch {
    return NextResponse.json({ error: "Could not create portal link" }, { status: 500 });
  }

  const url = `${req.nextUrl.origin}/portal/${token}`;
  return NextResponse.json({ url, token });
}

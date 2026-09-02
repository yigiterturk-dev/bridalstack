import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant, getCurrentUserId } from "@/lib/tenant";

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenant = await getCurrentTenant();
  if (!tenant) return NextResponse.json({ error: "No tenant" }, { status: 400 });

  const { customer_id } = await req.json();
  if (!customer_id) return NextResponse.json({ error: "customer_id required" }, { status: 400 });

  // Müşteri gerçekten bu kiracıya mı ait? RLS yok, elle doğruluyoruz.
  const customer = await prisma.customer.findFirst({
    where: { id: customer_id, tenant_id: tenant.id },
    select: { id: true },
  });
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 16);

  try {
    await prisma.portalToken.create({
      data: { tenant_id: tenant.id, customer_id, token },
    });
  } catch (e) {
    return NextResponse.json({ error: "Could not create portal link" }, { status: 500 });
  }

  const url = `${req.nextUrl.origin}/portal/${token}`;
  return NextResponse.json({ url, token });
}

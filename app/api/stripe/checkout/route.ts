import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { stripe, STRIPE_PRICE_IDS } from "@/lib/stripe";
import { getCurrentTenant } from "@/lib/tenant";
import { PackId, PACKS, calculateMonthlyPrice } from "@/config/modules";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  if (!user?.id || !user.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenant = await getCurrentTenant();
  if (!tenant) return NextResponse.json({ error: "No tenant" }, { status: 400 });

  const { packs } = (await req.json()) as { packs: PackId[] };
  if (!packs || !Array.isArray(packs)) return NextResponse.json({ error: "Invalid packs" }, { status: 400 });

  const newPacks = packs.filter((p) => p !== "base" && PACKS[p]);
  const lineItems = newPacks
    .map((packId) => {
      const priceId = STRIPE_PRICE_IDS[packId];
      if (!priceId) return null;
      return { price: priceId, quantity: 1 };
    })
    .filter(Boolean) as { price: string; quantity: number }[];

  if (lineItems.length === 0) {
    await prisma.tenant.update({ where: { id: tenant.id }, data: { packs: ["base"], plan: "free" } });
    return NextResponse.json({ url: "/settings?success=updated" });
  }

  const checkout = await stripe.checkout.sessions.create({
    customer_email: user.email,
    mode: "subscription",
    line_items: lineItems,
    success_url: `${req.nextUrl.origin}/settings?success=subscribed`,
    cancel_url: `${req.nextUrl.origin}/settings?cancelled=1`,
    metadata: {
      tenant_id: tenant.id,
      packs: JSON.stringify(["base", ...newPacks]),
    },
  });

  return NextResponse.json({ url: checkout.url });
}

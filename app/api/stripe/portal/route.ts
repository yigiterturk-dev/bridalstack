import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getCurrentTenant, getCurrentUserId } from "@/lib/tenant";

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenant = await getCurrentTenant();
  if (!tenant) return NextResponse.json({ error: "No tenant" }, { status: 400 });

  const customerId = (tenant.settings as Record<string, string>)?.stripe_customer_id;
  if (!customerId) return NextResponse.json({ error: "No subscription" }, { status: 400 });
  if (!stripe) {
    return NextResponse.json(
      { error: "Billing is not configured yet. Please contact support." },
      { status: 503 }
    );
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${req.nextUrl.origin}/settings`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Could not open Stripe billing portal:", error);
    return NextResponse.json(
      { error: "We couldn't open billing right now. Please try again." },
      { status: 502 }
    );
  }
}

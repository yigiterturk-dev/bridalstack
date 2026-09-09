import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { PackId, PACKS, FREE_PACK_IDS } from "@/config/modules";

async function findTenantByStripeCustomer(customerId: string) {
  return prisma.tenant.findFirst({
    where: { settings: { path: ["stripe_customer_id"], equals: customerId } },
    select: { id: true, settings: true },
  });
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const tenantId = session.metadata?.tenant_id;
    const packs = JSON.parse(
      session.metadata?.packs || JSON.stringify(FREE_PACK_IDS)
    ) as PackId[];

    if (tenantId) {
      // Ücretsiz paketler artık plana dahil geldiği için "base dışı" ölçüsü
      // yanıltıcıydı: ücretsiz salon paketi kiracıyı ödeyen gibi gösterirdi.
      const paidPacks = packs.filter((p) => (PACKS[p]?.monthlyPrice ?? 0) > 0);
      const existing = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
      const prevSettings = (existing?.settings ?? {}) as Record<string, unknown>;

      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          packs,
          plan: paidPacks.length > 0 ? "starter" : "free",
          // Trial → paid funnel: dönüşüm zamanını cohort analitiği için işaretle
          converted_at: paidPacks.length > 0 ? new Date() : null,
          // Mevcut ayarları ezmeden Stripe alanlarını ekle
          settings: {
            ...prevSettings,
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
          } as object,
        },
      });

      if (paidPacks.length > 0) {
        await prisma.funnelEvent.create({
          data: { tenant_id: tenantId, event: "trial_converted", metadata: { packs: paidPacks } },
        });
      }
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object;
    const tenant = await findTenantByStripeCustomer(subscription.customer as string);
    if (tenant) {
      // İptal ücretsiz katmana döndürür — kiracı online booking/hizmetleri
      // kaybetmez, tanıtım sayfası bunları ücretsiz vaat ediyor.
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { packs: [...FREE_PACK_IDS], plan: "free" },
      });
    }
  }

  if (event.type === "customer.subscription.updated") {
    const subscription = event.data.object;
    if (subscription.status === "past_due" || subscription.status === "unpaid") {
      const tenant = await findTenantByStripeCustomer(subscription.customer as string);
      if (tenant) {
        await prisma.tenant.update({ where: { id: tenant.id }, data: { plan: "free" } });
      }
    }
  }

  return NextResponse.json({ received: true });
}

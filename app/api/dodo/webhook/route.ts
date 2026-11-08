import { NextRequest, NextResponse } from "next/server";
import { verifyDodoWebhook } from "@/lib/dodo-webhook";
import { dodoWebhookKey, packForProductId } from "@/lib/dodo";
import { applyActiveSubscription, isPaidPack, removeSubscription } from "@/lib/dodo-state";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Dodo webhook.
 *
 * İmza Standard Webhooks şartnamesine göre doğrulanır (`webhook-id`,
 * `webhook-timestamp`, `webhook-signature`). Doğrulanmamış gövdeye göre
 * plan açmak, herkesin kendine ücretli modül verebildiği bir uç olurdu.
 *
 * Erişim kararı `product_id` + abonelik kimliğinden türetilir:
 *   - active / renewed  → o paketin aboneliğini bağla,
 *   - cancelled (hemen) / expired / on_hold / paused / failed → düşür,
 *   - cancelled (dönem sonunda) / past_due → erişimi koru.
 *
 * Aynı olay birkaç kez gelse de sonuç değişmez: ekleme kimlikle üzerine
 * yazar, çıkarma yalnız KİMLİĞİ eşleşen aboneliği siler.
 */

type DodoEvent = {
  type?: string;
  data?: {
    subscription_id?: string;
    product_id?: string;
    status?: string;
    cancel_at_next_billing_date?: boolean;
    metadata?: Record<string, unknown>;
    customer?: { customer_id?: string; email?: string };
  };
};

const MAX_BODY_BYTES = 512_000;

export async function POST(req: NextRequest) {
  const secret = dodoWebhookKey();
  if (!secret) {
    return NextResponse.json({ error: "Webhooks are not configured." }, { status: 503 });
  }

  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > MAX_BODY_BYTES) return NextResponse.json({ error: "Body too large." }, { status: 413 });

  const rawBody = await req.text();
  if (rawBody.length > MAX_BODY_BYTES) return NextResponse.json({ error: "Body too large." }, { status: 413 });

  try {
    verifyDodoWebhook(
      rawBody,
      {
        "webhook-id": req.headers.get("webhook-id") || "",
        "webhook-signature": req.headers.get("webhook-signature") || "",
        "webhook-timestamp": req.headers.get("webhook-timestamp") || "",
      },
      secret,
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: DodoEvent;
  try {
    event = JSON.parse(rawBody) as DodoEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const type = typeof event.type === "string" ? event.type : "";
  const data = event.data || {};
  const subscriptionId = typeof data.subscription_id === "string" ? data.subscription_id : "";
  const customerId = typeof data.customer?.customer_id === "string" ? data.customer.customer_id : null;
  const metadata = data.metadata && typeof data.metadata === "object" ? data.metadata : {};
  const metadataTenantId = typeof metadata.tenant_id === "string" ? metadata.tenant_id : null;
  const metadataInterval =
    metadata.interval === "annual" ? "annual" : metadata.interval === "monthly" ? "monthly" : undefined;
  const pack = typeof data.product_id === "string" ? packForProductId(data.product_id) : null;

  if (!subscriptionId || !pack) {
    // Bizim ürünümüz olmayan bir olay (veya farklı bir ortam). 200 dön ki
    // sağlayıcı sonsuza kadar yeniden denemesin.
    return NextResponse.json({ received: true, ignored: true });
  }

  const tenant = metadataTenantId
    ? await prisma.tenant.findUnique({ where: { id: metadataTenantId }, select: { id: true, settings: true } })
    : customerId
      ? await prisma.tenant.findFirst({
          where: { settings: { path: ["dodo", "customer_id"], equals: customerId } },
          select: { id: true, settings: true },
        })
      : null;

  if (!tenant) {
    console.warn("Dodo webhook for an unknown tenant", { type, pack, customerId });
    return NextResponse.json({ received: true, ignored: true });
  }

  if (type === "subscription.active" || type === "subscription.renewed" || type === "subscription.unpaused") {
    if (!isPaidPack(pack)) return NextResponse.json({ received: true });
    // Aynı ödemede birden çok paket alınınca Dodo abonelik olaylarını aynı anda
    // gönderir. Satır kilitlenmeden okunup yazılırsa her olay eski hâli görür ve
    // son yazan diğerlerinin paketini siler. Kilit + işlem içinde yeniden okuma.
    await prisma.$transaction(async (tx) => {
      const current = await lockTenantSettings(tx, tenant.id);
      const change = applyActiveSubscription(current, {
        pack,
        subscriptionId,
        customerId,
        interval: metadataInterval,
      });
      await tx.tenant.update({
        where: { id: tenant.id },
        data: {
          settings: change.settings as object,
          packs: change.packs,
          plan: change.plan,
          ...(change.converted ? { converted_at: new Date() } : {}),
        },
      });
      if (change.converted) {
        await tx.funnelEvent.create({
          data: { tenant_id: tenant.id, event: "trial_converted", metadata: { packs: change.packs, provider: "dodo" } },
        });
      }
    });
    return NextResponse.json({ received: true });
  }

  if (
    type === "subscription.expired" ||
    type === "subscription.on_hold" ||
    type === "subscription.paused" ||
    type === "subscription.failed" ||
    (type === "subscription.cancelled" && data.cancel_at_next_billing_date !== true)
  ) {
    await prisma.$transaction(async (tx) => {
      const current = await lockTenantSettings(tx, tenant.id);
      const change = removeSubscription(current, subscriptionId);
      // Eski/yinelenen olay ya da dönem-sonu iptali; erişim zaten doğru.
      if (!change.removedPack) return;
      await tx.tenant.update({
        where: { id: tenant.id },
        data: {
          settings: change.settings as object,
          packs: change.packs,
          plan: change.plan,
        },
      });
    });
    return NextResponse.json({ received: true });
  }

  // past_due: grace period boyunca erişim korunur. payment.* olayları
  // erişimi değiştirmez; abonelik olayları tek karar kaynağıdır.
  return NextResponse.json({ received: true });
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** Kiracı satırını işlem sonuna kadar kilitler ve güncel settings'i döner. */
async function lockTenantSettings(tx: Tx, tenantId: string): Promise<Record<string, unknown>> {
  const rows = await tx.$queryRaw<{ settings: unknown }[]>`SELECT settings FROM tenants WHERE id = ${tenantId}::uuid FOR UPDATE`;
  return ((rows[0]?.settings ?? {}) as Record<string, unknown>);
}

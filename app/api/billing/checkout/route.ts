import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import { FREE_PACK_IDS, PackId, PACKS, isPackSellable } from "@/config/modules";
import { resolveCheckoutPlan } from "@/lib/billing";
import {
  billingConfiguredFor,
  DODO_ANNUAL_PRODUCT_IDS,
  DODO_PRODUCT_IDS,
  cancelDodoSubscription,
  createDodoCheckout,
  DodoError,
} from "@/lib/dodo";
import { PAID_PACK_IDS, readDodoState, removeSubscription, subscriptionDiff } from "@/lib/dodo-state";
import { clientIp, rateLimit } from "@/lib/ratelimit";

/**
 * Dodo checkout.
 *
 * Her ücretli paket AYRI bir aboneliktir (Dodo multi-subscription cart).
 * Bu yüzden yükseltme "yeni abonelik aç", modül kaldırma "o aboneliği iptal
 * et" demektir; tek bir aboneliğin satırlarını değiştirmek değil.
 *
 * Fail-closed kurallar:
 *   - bilinmeyen paket adı 400 (sessizce ücretsize düşürmek yok),
 *   - satılamayan paket 400,
 *   - ürün kimliği eksikse 503 ve plana DOKUNULMAZ,
 *   - iptal API'de başarısız olursa 502 ve yerel plan değişmez.
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const session = await getServerSession(authOptions);
  const user = session?.user;
  if (!user?.id || !user.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = await rateLimit(`checkout:${user.id}:${clientIp(req)}`, 10, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many checkout attempts. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  const tenant = await getCurrentTenant();
  if (!tenant) return NextResponse.json({ error: "No tenant" }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = body && typeof body === "object" ? body as { packs?: unknown; interval?: unknown } : {};
  const packs = parsed.packs;
  if (!packs || !Array.isArray(packs)) return NextResponse.json({ error: "Invalid packs" }, { status: 400 });
  const requestedPacks = packs as PackId[];
  // Yıllık plan ayrı Dodo ürünleriyle satılır; kimlikler ve yapılandırma
  // kontrolü seçilen aralığa göre yapılır.
  const interval = parsed.interval === "annual" ? "annual" : "monthly";

  const unknown = packs.filter((p) => typeof p !== "string" || !(p in PACKS));
  if (unknown.length > 0) {
    return NextResponse.json({ error: `Unknown plan: ${unknown.join(", ")}` }, { status: 400 });
  }

  const rejected = requestedPacks.filter((p) => p !== "base" && PACKS[p] && !isPackSellable(p));
  if (rejected.length > 0) {
    return NextResponse.json(
      { error: `These plans are not available for purchase yet: ${rejected.join(", ")}` },
      { status: 400 },
    );
  }

  const requestedPaid = Array.from(new Set(requestedPacks)).filter((p): p is (typeof PAID_PACK_IDS)[number] =>
    (PAID_PACK_IDS as string[]).includes(p)
  );
  const state = readDodoState(tenant.settings as Record<string, unknown>);
  // Aralık değişikliği (aylık ↔ yıllık) eski aboneliğin iptalini ve yeni
  // aralıkta yeniden satın almayı gerektirir; aynı paket "değişmedi" sayılmaz.
  const { toCancel, toBuy } = subscriptionDiff(state, requestedPaid, interval);

  // 1) Kaldırılan modüller: önce sağlayıcıda iptal, sonra yerel plan.
  if (toCancel.length > 0) {
    try {
      for (const pack of toCancel) {
        const subscriptionId = state.subscriptions[pack];
        if (subscriptionId) await cancelDodoSubscription(subscriptionId);
      }
    } catch (error) {
      console.error("Dodo cancellation failed:", error instanceof DodoError ? error.code : "unknown");
      return NextResponse.json(
        { error: "We couldn't update your plan right now. Please try again." },
        { status: 502 },
      );
    }

    let nextSettings = tenant.settings as Record<string, unknown>;
    for (const pack of toCancel) {
      const subscriptionId = state.subscriptions[pack];
      if (subscriptionId) nextSettings = removeSubscription(nextSettings, subscriptionId).settings;
    }
    // İptal edilen (kaldırılan veya aralığı değişen) paket, yeni ödeme
    // onaylanana kadar AÇIK KALMAZ — aksi hâlde checkout'u yarıda bırakan
    // kiracı ücretli modülü bedava kullanmaya devam ederdi.
    const remainingPaid = requestedPaid.filter(
      (pack) => Boolean(state.subscriptions[pack]) && !toCancel.includes(pack),
    );
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        settings: nextSettings as object,
        packs: [...FREE_PACK_IDS, ...remainingPaid],
        plan: remainingPaid.length > 0 ? "starter" : "free",
      },
    });
  }

  // 2) Eklenecek paket yoksa iş bitti (saf indirgeme veya değişiklik yok).
  if (toBuy.length === 0) {
    return NextResponse.json({ url: "/settings?success=updated" });
  }

  // 3) Yalnız SATIN ALINACAK paketler için sağlayıcı yapılandırması gerekir.
  //    Kaldırma işlemi ürün kimliklerine ihtiyaç duymaz; bu yüzden yukarıda
  //    iptaller yapılandırma kapısından ÖNCE çalıştı.
  if (!billingConfiguredFor(interval)) {
    return NextResponse.json(
      { error: "Billing is not configured yet. Please contact support." },
      { status: 503 },
    );
  }

  const configuredIds = interval === "annual" ? DODO_ANNUAL_PRODUCT_IDS : DODO_PRODUCT_IDS;
  const plan = resolveCheckoutPlan([...FREE_PACK_IDS, ...toBuy], configuredIds);
  if (plan.kind !== "checkout") {
    return NextResponse.json(
      { error: "Billing is not configured for this plan yet. Please contact support." },
      { status: 503 },
    );
  }

  try {
    const checkout = await createDodoCheckout({
      productIds: plan.productIds,
      email: user.email,
      name: user.name ?? null,
      customerId: state.customerId,
      tenantId: tenant.id,
      packs: [...FREE_PACK_IDS, ...requestedPaid],
      interval,
      returnUrl: `${req.nextUrl.origin}/settings?success=subscribed`,
      cancelUrl: `${req.nextUrl.origin}/settings?cancelled=1`,
    });
    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    console.error("Could not create Dodo checkout:", error instanceof DodoError ? error.code : "unknown");
    return NextResponse.json(
      { error: "We couldn't start checkout right now. Please try again." },
      { status: error instanceof DodoError && error.code === "NOT_CONFIGURED" ? 503 : 502 },
    );
  }
}

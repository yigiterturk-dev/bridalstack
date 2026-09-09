import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { stripe, STRIPE_PRICE_IDS } from "@/lib/stripe";
import { getCurrentTenant } from "@/lib/tenant";
import { PackId, PACKS, calculateMonthlyPrice, isPackSellable } from "@/config/modules";
import { resolveCheckoutPlan } from "@/lib/billing";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  if (!user?.id || !user.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenant = await getCurrentTenant();
  if (!tenant) return NextResponse.json({ error: "No tenant" }, { status: 400 });

  const { packs } = (await req.json()) as { packs: PackId[] };
  if (!packs || !Array.isArray(packs)) return NextResponse.json({ error: "Invalid packs" }, { status: 400 });

  // Bilinmeyen paket adı sessizce yok sayılmamalı: yok sayarsak istemci
  // hatası veya eski bir paket adı, müşterinin planını farkında olmadan
  // ücretsize düşürür. Fail-closed reddediyoruz.
  const unknown = packs.filter((p) => typeof p !== "string" || !PACKS[p]);
  if (unknown.length > 0) {
    return NextResponse.json(
      { error: `Unknown plan: ${unknown.join(", ")}` },
      { status: 400 }
    );
  }

  // Fail-closed: henüz hiçbir sayfası olmayan paket satılamaz. İstemci gizlese
  // de sunucu tekrar doğrular, aksi halde müşteri boş bir pakete para öder.
  const rejected = packs.filter((p) => p !== "base" && PACKS[p] && !isPackSellable(p));
  if (rejected.length > 0) {
    return NextResponse.json(
      { error: `These plans are not available for purchase yet: ${rejected.join(", ")}` },
      { status: 400 }
    );
  }

  const plan = resolveCheckoutPlan(packs, STRIPE_PRICE_IDS);

  // Fiyat yapılandırması eksikse plana DOKUNMAYIZ. Eskiden bu durum boş bir
  // satır listesine düşüyor ve iptal sanılıyordu: yükseltmeye çalışan kiracı
  // "başarılı" mesajıyla ücretsize indiriliyordu.
  if (plan.kind === "misconfigured") {
    return NextResponse.json(
      { error: "Billing is not configured for this plan yet. Please contact support." },
      { status: 503 }
    );
  }

  if (plan.kind === "downgrade") {
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { packs: plan.packs, plan: "free" },
    });
    return NextResponse.json({ url: "/settings?success=updated" });
  }

  if (!stripe) {
    return NextResponse.json(
      { error: "Billing is not configured yet. Please contact support." },
      { status: 503 }
    );
  }

  const checkout = await stripe.checkout.sessions.create({
    customer_email: user.email,
    mode: "subscription",
    line_items: plan.lineItems,
    success_url: `${req.nextUrl.origin}/settings?success=subscribed`,
    cancel_url: `${req.nextUrl.origin}/settings?cancelled=1`,
    metadata: {
      tenant_id: tenant.id,
      packs: JSON.stringify(plan.packs),
    },
  });

  return NextResponse.json({ url: checkout.url });
}

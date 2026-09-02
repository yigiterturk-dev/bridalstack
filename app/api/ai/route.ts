import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant, getCurrentUserId } from "@/lib/tenant";

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenant = await getCurrentTenant();
  if (!tenant) return NextResponse.json({ error: "No tenant" }, { status: 400 });

  const { query } = await req.json();
  if (!query) return NextResponse.json({ error: "No query" }, { status: 400 });

  const scope = { tenant_id: tenant.id };
  const [products, customers, tryOnRows, orders] = await Promise.all([
    prisma.product.findMany({ where: scope, select: { name: true, category: true, price: true, cost: true, stock_quantity: true, lifecycle_stage: true }, take: 50 }),
    prisma.customer.findMany({ where: scope, select: { name: true, status: true, metadata: true }, take: 50 }),
    prisma.tryOn.findMany({
      where: scope,
      select: { reaction: true, rating: true, notes: true, product: { select: { name: true, category: true, price: true } }, customer: { select: { name: true } } },
      take: 100,
    }),
    prisma.order.findMany({ where: scope, select: { ref_no: true, order_type: true, status: true, discounted_total: true, created_at: true }, take: 50 }),
  ]);
  const tryOns = tryOnRows.map(({ product, customer, ...t }) => ({ ...t, products: product, customers: customer }));

  const context = `
You are an AI Stylist assistant for a bridal shop called "${tenant.name}".
You help shop owners with gown recommendations, sales insights, and customer advice.
Be specific, data-driven, and actionable. Use the shop's actual data below.

INVENTORY (${(products ?? []).length} items):
${(products ?? []).map(p => `- ${p.name} | ${p.category ?? "N/A"} | $${p.price} | Cost $${p.cost} | Stock: ${p.stock_quantity} | ${p.lifecycle_stage}`).join("\n")}

RECENT TRY-ONS (${(tryOns ?? []).length}):
${(tryOns ?? []).map(t => {
  const prod = (Array.isArray(t.products) ? t.products[0] : t.products) as { name: string; price: number } | null;
  const cust = (Array.isArray(t.customers) ? t.customers[0] : t.customers) as { name: string } | null;
  return `- ${cust?.name ?? "?"} tried ${prod?.name ?? "?"} → ${t.reaction ?? "no reaction"} (${t.rating ?? "no rating"}/5) ${t.notes ?? ""}`;
}).join("\n")}

RECENT ORDERS (${(orders ?? []).length}):
${(orders ?? []).map(o => `- ${o.ref_no} | ${o.order_type} | $${o.discounted_total} | ${o.status} | ${new Date(o.created_at).toLocaleDateString()}`).join("\n")}

CUSTOMERS (${(customers ?? []).length}):
${(customers ?? []).map(c => `- ${c.name} | ${c.status}`).join("\n")}
`;

  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const lovedGowns = (tryOns ?? []).filter(t => t.reaction === "loved").length;
    const totalRevenue = (orders ?? []).reduce((s, o) => s + Number(o.discounted_total ?? 0), 0);
    return NextResponse.json({
      answer: `Based on your shop data:\n\n📊 ${(products ?? []).length} products in inventory\n👰 ${(customers ?? []).length} customers\n💍 ${(tryOns ?? []).length} try-ons recorded (${lovedGowns} loved)\n💰 $${totalRevenue.toLocaleString()} total revenue from ${(orders ?? []).length} orders\n\n(Connect an AI API key for personalized recommendations — add ANTHROPIC_API_KEY or OPENAI_API_KEY to your environment variables)`,
    });
  }

  try {
    if (process.env.ANTHROPIC_API_KEY) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-opus-5",
          max_tokens: 4096,
          // Dükkan verisi üzerinde kısa soru-cevap; düşük çaba yeterli ve daha ucuz.
          output_config: { effort: "low" },
          system: context,
          messages: [{ role: "user", content: query }],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return NextResponse.json({ error: data?.error?.message ?? "AI request failed" }, { status: 502 });
      }
      // Yanıt metni ilk blokta olmayabilir (ör. düşünme bloğu önce gelir).
      const text = Array.isArray(data.content)
        ? data.content.find((b: { type?: string }) => b?.type === "text")?.text
        : null;
      return NextResponse.json({ answer: text ?? "No response" });
    }

    if (process.env.OPENAI_API_KEY) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "system", content: context }, { role: "user", content: query }],
          max_tokens: 1024,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return NextResponse.json({ error: data?.error?.message ?? "AI request failed" }, { status: 502 });
      }
      return NextResponse.json({ answer: data.choices?.[0]?.message?.content ?? "No response" });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  return NextResponse.json({ error: "No AI provider configured" }, { status: 500 });
}

#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Stripe kurulum betiği — BridalStack ücretli paketleri.                    ║
// ║  Kullanım:                                                                 ║
// ║    STRIPE_SECRET_KEY=sk_live_... node scripts/stripe-setup.mjs             ║
// ║    STRIPE_SECRET_KEY=sk_live_... node scripts/stripe-setup.mjs --webhook \ ║
// ║        https://bridalstack.com                                             ║
// ║  Çıktı: Vercel'e girmen gereken STRIPE_PRICE_* ve STRIPE_WEBHOOK_SECRET    ║
// ║  satırları. lookup_key eşleşirse mevcut fiyat yeniden kullanılır.          ║
// ╚══════════════════════════════════════════════════════════════════════════╝

const key = process.env.STRIPE_SECRET_KEY || process.argv[2];
if (!key || !key.startsWith("sk_")) {
  console.error("STRIPE_SECRET_KEY gerekli (sk_test_... veya sk_live_...)");
  process.exit(1);
}

const PACKS = [
  { id: "sales",     name: "BridalStack Sales",     amount: 3900 },
  { id: "finance",   name: "BridalStack Finance",   amount: 1900 },
  { id: "inventory", name: "BridalStack Inventory", amount: 2900 },
  { id: "pro",       name: "BridalStack Pro",       amount: 2900 },
];

const auth = { Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}` };
const enc = (p) => new URLSearchParams(p).toString();

async function api(path, params, rawBody) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: params || rawBody ? "POST" : "GET",
    headers: { ...auth, ...(params || rawBody ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: rawBody ?? (params ? enc(params) : undefined),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`${path}: ${body.error?.message ?? res.status}`);
  return body;
}

const out = {};
for (const pack of PACKS) {
  const existing = await api(`prices?lookup_keys[]=${pack.id}&active=true&limit=1&expand[]=data.product`);
  if (existing.data.length > 0) {
    out[pack.id] = existing.data[0].id;
    console.log(`= ${pack.id}: mevcut fiyat kullanılıyor (${out[pack.id]})`);
    continue;
  }
  const product = await api("products", { name: pack.name, "metadata[pack]": pack.id });
  const price = await api("prices", {
    product: product.id,
    currency: "usd",
    unit_amount: pack.amount,
    recurring: { interval: "month" },
    lookup_key: pack.id,
    transfer_lookup_key: "true",
  });
  out[pack.id] = price.id;
  console.log(`+ ${pack.id}: ürün+fiyat oluşturuldu (${price.id})`);
}

console.log("\n# Vercel > bridalstack > Production ortam değişkenlerine ekle:");
for (const [k, v] of Object.entries(out)) console.log(`STRIPE_PRICE_${k.toUpperCase()}=${v}`);

const webhookFlag = process.argv.indexOf("--webhook");
if (webhookFlag !== -1 && process.argv[webhookFlag + 1]) {
  const origin = process.argv[webhookFlag + 1].replace(/\/+$/, "");
  // Aynı anahtarın tekrarı Stripe'ta çoklu değer anlamına gelir; object
  // literal kullanırsak son değer öncekileri ezer. Bu yüzden ham gövde.
  const body = new URLSearchParams();
  body.set("url", `${origin}/api/stripe/webhook`);
  body.set("description", "BridalStack subscriptions");
  for (const ev of ["checkout.session.completed", "customer.subscription.updated", "customer.subscription.deleted"]) {
    body.append("enabled_events[]", ev);
  }
  const wh = await api("webhook_endpoints", null, body.toString());
  console.log(`\nSTRIPE_WEBHOOK_SECRET=${wh.secret}`);
  console.log("# Bu satır yalnız bir kez gösterilir — hemen kaydet.");
}

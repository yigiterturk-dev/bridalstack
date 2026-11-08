/**
 * Dodo kurulumu — test ya da canlı modda 8 abonelik ürünü + webhook.
 *
 * Fiyatlar config/modules.ts'ten okunur (tek kaynak). Tekrar çalıştırmak
 * güvenli: aynı adlı ürün / aynı URL'li webhook varsa yeniden açılmaz.
 *
 *   DODO_PAYMENTS_API_KEY=... DODO_PAYMENTS_ENVIRONMENT=live \
 *     node scripts/dodo-setup.ts                 # yalnız ne yapılacağını yazar
 *     node scripts/dodo-setup.ts --apply --out /yol/dodo-live.env
 *
 * --out dosyasına prod .env'e eklenecek satırlar yazılır (webhook sırrı dahil,
 * bu yüzden ekrana basılmaz). Dosya 0600 izinle açılır.
 */
import { writeFileSync } from "node:fs";
import { PACKS, ANNUAL_BILLING_MONTHS, type PackId } from "../config/modules.ts";

const WEBHOOK_URL = process.env.DODO_WEBHOOK_URL ?? "https://bridalstack.com/api/dodo/webhook";
const key = process.env.DODO_PAYMENTS_API_KEY;
// Uygulama (lib/dodo.ts) yalnız tam "live" değerini canlı sayar; "live_mode" yazılsa
// sessizce test API'sine giderdi. Burada ikisi de kabul edilir, .env'e "live" yazılır.
const rawEnv = (process.env.DODO_PAYMENTS_ENVIRONMENT ?? "test").trim();
const live = rawEnv === "live" || rawEnv === "live_mode";
const env = live ? "live" : "test_mode";
const apply = process.argv.includes("--apply");
const outIdx = process.argv.indexOf("--out");
const out = outIdx > 0 ? process.argv[outIdx + 1] : undefined;

if (!key) throw new Error("DODO_PAYMENTS_API_KEY yok");
if (!live && !["test", "test_mode"].includes(rawEnv)) throw new Error(`Bilinmeyen ortam: ${rawEnv}`);
if (apply && !out) throw new Error("--apply ile --out <dosya> zorunlu (webhook sırrı oraya yazılır)");

const base = live ? "https://live.dodopayments.com" : "https://test.dodopayments.com";

async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(base + path, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

type Product = { product_id: string; name: string; price?: number };
type Plan = { envKey: string; name: string; description: string; cents: number; interval: "Month" | "Year"; periodYears: number };

const plans: Plan[] = [];
for (const id of Object.keys(PACKS) as PackId[]) {
  const pack = PACKS[id];
  if (pack.monthlyPrice <= 0) continue; // ücretsiz paketler Dodo'da ürün değil
  const envBase = `DODO_PRODUCT_${id.toUpperCase()}`;
  plans.push({ envKey: envBase, name: `BridalStack ${pack.name} (Monthly)`, description: pack.description, cents: pack.monthlyPrice * 100, interval: "Month", periodYears: 10 });
  plans.push({ envKey: `${envBase}_ANNUAL`, name: `BridalStack ${pack.name} (Annual)`, description: pack.description, cents: pack.monthlyPrice * ANNUAL_BILLING_MONTHS * 100, interval: "Year", periodYears: 10 });
}

const existing: Product[] = [];
for (let page = 0; ; page++) {
  const r = await api<{ items: Product[] }>(`/products?page_size=100&page_number=${page}`);
  existing.push(...r.items);
  if (r.items.length < 100) break;
}

const lines: string[] = [`DODO_PAYMENTS_ENVIRONMENT=${env}`];
for (const p of plans) {
  const found = existing.find((e) => e.name === p.name);
  if (found) {
    const ok = found.price === undefined || found.price === p.cents;
    console.log(`${ok ? "var " : "FİYAT FARKLI"} ${p.name} ${found.product_id}${ok ? "" : ` (Dodo ${found.price}, kod ${p.cents})`}`);
    lines.push(`${p.envKey}=${found.product_id}`);
    continue;
  }
  if (!apply) {
    console.log(`açılacak ${p.name} $${p.cents / 100}/${p.interval}`);
    continue;
  }
  const created = await api<Product>("/products", {
    method: "POST",
    body: {
      name: p.name,
      description: p.description,
      tax_category: "saas",
      price: {
        type: "recurring_price",
        price: p.cents,
        currency: "USD",
        tax_inclusive: false,
        discount: 0,
        purchasing_power_parity: false,
        payment_frequency_count: 1,
        payment_frequency_interval: p.interval,
        subscription_period_count: p.periodYears,
        subscription_period_interval: "Year",
        trial_period_days: 0,
      },
    },
  });
  console.log(`açıldı ${p.name} ${created.product_id}`);
  lines.push(`${p.envKey}=${created.product_id}`);
}

type Endpoint = { id: string; url: string; disabled: boolean };
const hooks = await api<{ data: Endpoint[] }>("/webhooks");
let hook = hooks.data.find((h) => h.url === WEBHOOK_URL && !h.disabled);
if (hook) console.log(`var  webhook ${hook.id}`);
else if (!apply) console.log(`açılacak webhook → ${WEBHOOK_URL}`);
else {
  hook = await api<Endpoint>("/webhooks", {
    method: "POST",
    body: { url: WEBHOOK_URL, description: `BridalStack prod (${env})` },
  });
  console.log(`açıldı webhook ${hook.id}`);
}

if (apply && out && hook) {
  const { secret } = await api<{ secret: string }>(`/webhooks/${hook.id}/secret`);
  lines.push(`DODO_PAYMENTS_WEBHOOK_KEY=${secret}`);
  writeFileSync(out, lines.join("\n") + "\n", { mode: 0o600 });
  console.log(`env satırları → ${out} (${lines.length} satır)`);
}

import Stripe from "stripe";

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-05-27.dahlia" })
  : null as unknown as Stripe;

export const STRIPE_PRICE_IDS: Record<string, string> = {
  sales: process.env.STRIPE_PRICE_SALES || "",
  finance: process.env.STRIPE_PRICE_FINANCE || "",
  inventory: process.env.STRIPE_PRICE_INVENTORY || "",
  pro: process.env.STRIPE_PRICE_PRO || "",
};

// Ödeme hattı yalnızca hem anahtar hem dört fiyat da tanımlıysa AÇIK sayılır.
// Kısmi yapılandırma, müşteriyi yarım checkout'a sokar — o yüzden tek bayrak.
export const BILLING_CONFIGURED = Boolean(
  process.env.STRIPE_SECRET_KEY &&
    STRIPE_PRICE_IDS.sales &&
    STRIPE_PRICE_IDS.finance &&
    STRIPE_PRICE_IDS.inventory &&
    STRIPE_PRICE_IDS.pro
);

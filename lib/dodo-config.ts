import { PAID_PACK_IDS, type PaidPackId } from "./dodo-state.ts";

/**
 * Dodo yapılandırmasının saf kısmı.
 *
 * `lib/dodo.ts` `server-only` ve `@/` takma adı taşıdığı için node test
 * koşucusunda yüklenemiyor. Ürün kimliği eşlemesi ve "ödeme hattı açık mı"
 * kararı burada duruyor; ikisi de test edilebilir.
 *
 * Her paket AYRI bir aboneliktir. Aylık ve yıllık plan aynı paketi farklı bir
 * Dodo ürünüyle satar; webhook tarafında iki kimlik de aynı pakete çözülür.
 */

export type BillingInterval = "monthly" | "annual";

function fromEnv(env: Record<string, string | undefined>, key: string): string {
  return (env[key] || "").trim();
}

export function productIdsFrom(env: Record<string, string | undefined> = process.env): Record<PaidPackId, string> {
  return {
    sales: fromEnv(env, "DODO_PRODUCT_SALES"),
    finance: fromEnv(env, "DODO_PRODUCT_FINANCE"),
    inventory: fromEnv(env, "DODO_PRODUCT_INVENTORY"),
    pro: fromEnv(env, "DODO_PRODUCT_PRO"),
  };
}

export function annualProductIdsFrom(env: Record<string, string | undefined> = process.env): Record<PaidPackId, string> {
  return {
    sales: fromEnv(env, "DODO_PRODUCT_SALES_ANNUAL"),
    finance: fromEnv(env, "DODO_PRODUCT_FINANCE_ANNUAL"),
    inventory: fromEnv(env, "DODO_PRODUCT_INVENTORY_ANNUAL"),
    pro: fromEnv(env, "DODO_PRODUCT_PRO_ANNUAL"),
  };
}

export function productIdsForInterval(
  interval: BillingInterval,
  env: Record<string, string | undefined> = process.env,
): Record<PaidPackId, string> {
  return interval === "annual" ? annualProductIdsFrom(env) : productIdsFrom(env);
}

/**
 * Ödeme hattı yalnız anahtar + webhook sırrı + o aralığın DÖRT ürün kimliği
 * birlikte tanımlıysa açık. Kısmi yapılandırma, ürünü olmayan bir checkout'a
 * yönlendirirdi.
 */
export function billingConfiguredForInterval(
  interval: BillingInterval,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const apiKey = fromEnv(env, "DODO_PAYMENTS_API_KEY");
  const webhookKey = fromEnv(env, "DODO_PAYMENTS_WEBHOOK_KEY");
  const ids = productIdsForInterval(interval, env);
  return Boolean(apiKey && webhookKey && PAID_PACK_IDS.every((pack) => Boolean(ids[pack])));
}

export function billingConfiguredFrom(env: Record<string, string | undefined> = process.env): boolean {
  return billingConfiguredForInterval("monthly", env);
}

/** Aylık ya da yıllık ürün kimliğini tek bir pakete çözer (webhook için). */
export function packForProductIdFrom(
  productId: string,
  env: Record<string, string | undefined> = process.env,
): PaidPackId | null {
  if (!productId) return null;
  const monthly = productIdsFrom(env);
  const annual = annualProductIdsFrom(env);
  return (
    PAID_PACK_IDS.find(
      (pack) => (monthly[pack] && monthly[pack] === productId) || (annual[pack] && annual[pack] === productId),
    ) ?? null
  );
}

import { PAID_PACK_IDS, type PaidPackId } from "./dodo-state.ts";

/**
 * Dodo yapılandırmasının saf kısmı.
 *
 * `lib/dodo.ts` `server-only` ve `@/` takma adı taşıdığı için node test
 * koşucusunda yüklenemiyor. Ürün kimliği eşlemesi ve "ödeme hattı açık mı"
 * kararı burada duruyor; ikisi de test edilebilir.
 */

export function productIdsFrom(env: Record<string, string | undefined> = process.env): Record<PaidPackId, string> {
  return {
    sales: (env.DODO_PRODUCT_SALES || "").trim(),
    finance: (env.DODO_PRODUCT_FINANCE || "").trim(),
    inventory: (env.DODO_PRODUCT_INVENTORY || "").trim(),
    pro: (env.DODO_PRODUCT_PRO || "").trim(),
  };
}

/**
 * Ödeme hattı yalnız anahtar + webhook sırrı + DÖRT ürün kimliği birlikte
 * tanımlıysa açık. Kısmi yapılandırma, ürünü olmayan bir checkout'a
 * yönlendirirdi.
 */
export function billingConfiguredFrom(env: Record<string, string | undefined> = process.env): boolean {
  const apiKey = (env.DODO_PAYMENTS_API_KEY || "").trim();
  const webhookKey = (env.DODO_PAYMENTS_WEBHOOK_KEY || "").trim();
  const ids = productIdsFrom(env);
  return Boolean(apiKey && webhookKey && PAID_PACK_IDS.every((pack) => Boolean(ids[pack])));
}

export function packForProductIdFrom(
  productId: string,
  env: Record<string, string | undefined> = process.env,
): PaidPackId | null {
  if (!productId) return null;
  const ids = productIdsFrom(env);
  return PAID_PACK_IDS.find((pack) => ids[pack] && ids[pack] === productId) ?? null;
}

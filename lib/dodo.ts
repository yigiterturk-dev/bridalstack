import "server-only";

import type { PackId } from "@/config/modules";
import type { PaidPackId } from "./dodo-state";
import { billingConfiguredFrom, packForProductIdFrom, productIdsFrom } from "./dodo-config";

/**
 * Dodo Payments istemcisi.
 *
 * Neden SDK değil: ihtiyacımız üç uç (checkout, portal, iptal). Bunlar için
 * bir bağımlılık eklemek yerine `fetch` kullanılıyor; sağlayıcının API'si
 * küçük ve sözleşmesi açık. Webhook imzası ise resmî `standardwebhooks`
 * paketiyle doğrulanıyor — el yazımı bir imza doğrulayıcı, sessizce yanlış
 * hesaplayabilir.
 *
 * Ödeme hattı yalnız anahtar + webhook sırrı + DÖRT ürün kimliği birlikte
 * tanımlıysa AÇIK. Kısmi yapılandırma, müşteriyi ürünü olmayan bir checkout'a
 * sokardı.
 */

type DodoEnvironment = "test" | "live";

function environment(): DodoEnvironment {
  return (process.env.DODO_PAYMENTS_ENVIRONMENT || "test").trim() === "live" ? "live" : "test";
}

export function dodoOrigin(env: NodeJS.ProcessEnv = process.env): string {
  return (env.DODO_PAYMENTS_ENVIRONMENT || "test").trim() === "live"
    ? "https://live.dodopayments.com"
    : "https://test.dodopayments.com";
}

export const DODO_PRODUCT_IDS: Record<PaidPackId, string> = productIdsFrom();

export { billingConfiguredFrom };

export const BILLING_CONFIGURED = billingConfiguredFrom();

export class DodoError extends Error {
  readonly code: string | null;
  constructor(message: string, code: string | null = null) {
    super(message);
    this.name = "DodoError";
    this.code = code;
  }
}

export function productIdForPack(pack: PaidPackId): string {
  return DODO_PRODUCT_IDS[pack];
}

export function packForProductId(productId: string): PaidPackId | null {
  return packForProductIdFrom(productId, process.env);
}

export function dodoWebhookKey(env: NodeJS.ProcessEnv = process.env): string | null {
  const key = (env.DODO_PAYMENTS_WEBHOOK_KEY || "").trim();
  return key || null;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  query?: Record<string, string>;
};

async function dodoRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const apiKey = (process.env.DODO_PAYMENTS_API_KEY || "").trim();
  if (!apiKey) throw new DodoError("Billing is not configured yet.", "NOT_CONFIGURED");

  const url = new URL(`${dodoOrigin()}${path}`);
  for (const [key, value] of Object.entries(options.query || {})) url.searchParams.set(key, value);

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method || "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new DodoError("The payment provider could not be reached.", "NETWORK_ERROR");
  }

  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    const code = typeof payload?.code === "string" ? payload.code : null;
    // Sağlayıcının ham mesajı kullanıcıya gösterilmez; loglarda da sır yok.
    throw new DodoError("The payment provider rejected the request.", code);
  }
  return payload as T;
}

export async function createDodoCheckout(input: {
  productIds: string[];
  email: string;
  name?: string | null;
  customerId?: string | null;
  tenantId: string;
  packs: PackId[];
  returnUrl: string;
  cancelUrl: string;
}): Promise<{ url: string }> {
  if (input.productIds.length === 0) throw new DodoError("No products selected.", "EMPTY_CART");
  if (input.productIds.some((id) => !id)) throw new DodoError("Billing is not configured for this plan.", "MISSING_PRODUCT");

  const customer = input.customerId
    ? { customer_id: input.customerId }
    : { email: input.email, ...(input.name ? { name: input.name } : {}) };

  const session = await dodoRequest<{ checkout_url?: string | null; session_id?: string }>("/checkouts", {
    method: "POST",
    body: {
      product_cart: input.productIds.map((product_id) => ({ product_id, quantity: 1 })),
      customer,
      return_url: input.returnUrl,
      cancel_url: input.cancelUrl,
      billing_currency: "USD",
      metadata: {
        tenant_id: input.tenantId,
        packs: JSON.stringify(input.packs),
      },
    },
  });

  if (!session.checkout_url) throw new DodoError("The payment provider did not return a checkout link.", "NO_CHECKOUT_URL");
  return { url: session.checkout_url };
}

export async function createDodoPortalSession(customerId: string, returnUrl: string): Promise<{ url: string }> {
  const session = await dodoRequest<{ link?: string }>(
    `/customers/${encodeURIComponent(customerId)}/customer-portal/session`,
    { method: "POST", query: { return_url: returnUrl } },
  );
  if (!session.link) throw new DodoError("The payment provider did not return a portal link.", "NO_PORTAL_LINK");
  return { url: session.link };
}

/**
 * Tek bir paket aboneliğini hemen iptal eder.
 *
 * `cancel_at_next_billing_date` KAPALI: kullanıcı bir modülü kaldırdığında
 * erişim dönem sonuna kadar sürmemeli, çünkü ücretini de bir daha ödemiyor.
 * Dodo iptali webhook ile onaylar; çağıran yerel durumu ancak API başarılıysa
 * güncellemeli.
 */
export async function cancelDodoSubscription(subscriptionId: string): Promise<void> {
  await dodoRequest(`/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: "PATCH",
    body: { status: "cancelled", cancel_at_next_billing_date: false },
  });
}

export { environment as dodoEnvironment };

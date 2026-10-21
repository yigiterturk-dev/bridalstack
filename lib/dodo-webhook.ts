import { Webhook } from "standardwebhooks";

/**
 * Dodo webhook imza doğrulaması (Standard Webhooks şartnamesi).
 *
 * `standardwebhooks` resmî uygulaması kullanılıyor: zaman damgası toleransı,
 * imza karşılaştırması ve başlık biçimi kütüphanenin sınanmış sözleşmesi.
 * Burada yalnız hata sınıfını sadeleştiriyoruz; route doğrulamanın ayrıntısıyla
 * uğraşmasın.
 */
export class DodoWebhookError extends Error {
  constructor(message = "Invalid webhook signature.") {
    super(message);
    this.name = "DodoWebhookError";
  }
}

export function verifyDodoWebhook(
  rawBody: string,
  headers: { "webhook-id": string; "webhook-timestamp": string; "webhook-signature": string },
  secret: string,
): void {
  try {
    new Webhook(secret).verify(rawBody, headers);
  } catch {
    throw new DodoWebhookError();
  }
}

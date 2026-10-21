import assert from "node:assert/strict";
import test from "node:test";
import { Webhook } from "standardwebhooks";
import { DodoWebhookError, verifyDodoWebhook } from "../lib/dodo-webhook.ts";

/**
 * Dodo webhook imzası.
 *
 * Gerçek imza standardwebhooks'un kendi `sign` metoduyla üretiliyor; test
 * ağa çıkmıyor ama sözleşme gerçek. Kurcalanmış gövde ve eski zaman damgası
 * REDDEDİLMELİ — biri geçerse herkes kendine ücretli modül verebilir.
 */

const SECRET = `whsec_${Buffer.from("bridalstack-test-secret").toString("base64")}`;
const HEADERS = (id: string, timestamp: number) => ({
  "webhook-id": id,
  "webhook-timestamp": String(timestamp),
  "webhook-signature": "",
});

test("geçerli imza kabul ediliyor", () => {
  const webhook = new Webhook(SECRET);
  const body = JSON.stringify({ type: "subscription.active", data: { subscription_id: "sub_1" } });
  const id = "msg_123";
  const at = new Date();
  const signature = webhook.sign(id, at, body);
  const headers = { ...HEADERS(id, Math.floor(at.getTime() / 1000)), "webhook-signature": signature };
  assert.doesNotThrow(() => verifyDodoWebhook(body, headers, SECRET));
});

test("kurcalanmış gövde reddediliyor", () => {
  const webhook = new Webhook(SECRET);
  const body = JSON.stringify({ type: "subscription.active", data: { subscription_id: "sub_1" } });
  const id = "msg_123";
  const at = new Date();
  const signature = webhook.sign(id, at, body);
  const headers = { ...HEADERS(id, Math.floor(at.getTime() / 1000)), "webhook-signature": signature };
  assert.throws(() => verifyDodoWebhook(`${body} `, headers, SECRET), DodoWebhookError);
});

test("eski zaman damgası reddediliyor", () => {
  const webhook = new Webhook(SECRET);
  const body = JSON.stringify({ type: "subscription.active" });
  const id = "msg_old";
  const at = new Date(Date.now() - 10 * 60 * 1000);
  const signature = webhook.sign(id, at, body);
  const headers = { ...HEADERS(id, Math.floor(at.getTime() / 1000)), "webhook-signature": signature };
  assert.throws(() => verifyDodoWebhook(body, headers, SECRET), DodoWebhookError);
});

test("eksik başlık reddediliyor", () => {
  assert.throws(
    () => verifyDodoWebhook("{}", { "webhook-id": "", "webhook-timestamp": "", "webhook-signature": "" }, SECRET),
    DodoWebhookError,
  );
});

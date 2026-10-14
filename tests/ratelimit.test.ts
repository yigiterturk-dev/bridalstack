import { test } from "node:test";
import assert from "node:assert/strict";
import { rateLimit, decideFromIncr, __resetRateLimitForTests } from "../lib/ratelimit.ts";

test("decideFromIncr: limit aşımında reddeder ve kalan TTL'i saniyeye çevirir", () => {
  const denied = decideFromIncr(6, 5, 12_340);
  assert.equal(denied.allowed, false);
  assert.equal(denied.remaining, 0);
  assert.equal(denied.retryAfter, 13); // tavana yuvarlanır

  const allowed = decideFromIncr(3, 5, 12_340);
  assert.deepEqual(allowed, { allowed: true, remaining: 2, retryAfter: 0 });
});

test("decideFromIncr: sınır değeri tam dolduğunda hâlâ izinlidir (count <= limit)", () => {
  const atLimit = decideFromIncr(5, 5, 60_000);
  assert.equal(atLimit.allowed, true);
  assert.equal(atLimit.remaining, 0);
});

test("decideFromIncr: bozuk TTL (0/negatif) en az 1 saniye ceza üretir", () => {
  assert.equal(decideFromIncr(6, 5, 0).retryAfter >= 1, true);
  assert.equal(decideFromIncr(6, 5, -1).retryAfter >= 1, true);
});

test("rateLimit (in-memory): pencere içinde limit kadar izin, sonrası ret, resetle temiz", async () => {
  const savedUrl = process.env.UPSTASH_REDIS_REST_URL;
  const savedToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  __resetRateLimitForTests();
  try {
    for (let i = 0; i < 5; i++) {
      const r = await rateLimit("test-key", 5, 60_000);
      assert.equal(r.allowed, true, `#${i + 1} izinli olmalı`);
    }
    const denied = await rateLimit("test-key", 5, 60_000);
    assert.equal(denied.allowed, false);
    assert.equal(denied.remaining, 0);
    assert.ok(denied.retryAfter > 0);

    __resetRateLimitForTests();
    const fresh = await rateLimit("test-key", 5, 60_000);
    assert.equal(fresh.allowed, true);
  } finally {
    if (savedUrl !== undefined) process.env.UPSTASH_REDIS_REST_URL = savedUrl;
    if (savedToken !== undefined) process.env.UPSTASH_REDIS_REST_TOKEN = savedToken;
    __resetRateLimitForTests();
  }
});

test("rateLimit: RATE_LIMIT_DISABLED=1 yerelde sınırı kapatır", async () => {
  const savedDisabled = process.env.RATE_LIMIT_DISABLED;
  const savedNodeEnv = process.env.NODE_ENV;
  process.env.RATE_LIMIT_DISABLED = "1";
  (process.env as Record<string, string | undefined>).NODE_ENV = "development";
  __resetRateLimitForTests();
  try {
    for (let i = 0; i < 50; i++) {
      const r = await rateLimit("disabled-key", 1, 60_000);
      assert.equal(r.allowed, true, `#${i + 1} izinli olmalı`);
    }
  } finally {
    if (savedDisabled === undefined) delete process.env.RATE_LIMIT_DISABLED;
    else process.env.RATE_LIMIT_DISABLED = savedDisabled;
    (process.env as Record<string, string | undefined>).NODE_ENV = savedNodeEnv;
    __resetRateLimitForTests();
  }
});

test("rateLimit: bayrak üretimde yok sayılır (koruma kapanmaz)", async () => {
  const savedDisabled = process.env.RATE_LIMIT_DISABLED;
  const savedNodeEnv = process.env.NODE_ENV;
  process.env.RATE_LIMIT_DISABLED = "1";
  (process.env as Record<string, string | undefined>).NODE_ENV = "production";
  __resetRateLimitForTests();
  try {
    const first = await rateLimit("prod-key", 1, 60_000);
    assert.equal(first.allowed, true);
    const second = await rateLimit("prod-key", 1, 60_000);
    assert.equal(second.allowed, false, "üretimde sınır devrede olmalı");
  } finally {
    if (savedDisabled === undefined) delete process.env.RATE_LIMIT_DISABLED;
    else process.env.RATE_LIMIT_DISABLED = savedDisabled;
    (process.env as Record<string, string | undefined>).NODE_ENV = savedNodeEnv;
    __resetRateLimitForTests();
  }
});

test("rateLimit: anahtarlar farklıysa sayaçlar bağımsızdır", async () => {
  __resetRateLimitForTests();
  try {
    await rateLimit("a", 1, 60_000);
    const b = await rateLimit("b", 1, 60_000);
    assert.equal(b.allowed, true);
    const a2 = await rateLimit("a", 1, 60_000);
    assert.equal(a2.allowed, false);
  } finally {
    __resetRateLimitForTests();
  }
});

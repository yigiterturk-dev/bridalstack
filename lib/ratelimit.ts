// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Hız sınırlayıcı. Upstash Redis (REST) yapılandırılmışsa sayaç tüm         ║
// ║  instance'lar arasında paylaşılır; yapılandırılmamışsa in-memory sürer.    ║
// ║  Paylaşımlı store erişilemezse istekler geçici olarak reddedilir            ║
// ║  (fail-closed): abuse koruması sessizce devre dışı kalmaz.                 ║
// ╚══════════════════════════════════════════════════════════════════════════╝

type Hit = { count: number; resetAt: number };

const buckets = new Map<string, Hit>();
const KEY_PREFIX = "rl:";
const UPSTASH_TIMEOUT_MS = 3_000;

function upstashConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ""), token };
}

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfter: number };

/** INCR sonucundan karar. Saf: test edilebilir. */
export function decideFromIncr(count: number, limit: number, ttlMs: number): RateLimitResult {
  if (count > limit) {
    return { allowed: false, remaining: 0, retryAfter: Math.max(1, Math.ceil(ttlMs / 1000)) };
  }
  return { allowed: true, remaining: Math.max(0, limit - count), retryAfter: 0 };
}

// Bellek sızıntısını önlemek için süresi dolmuş kovaları periyodik temizle.
function sweep(now: number) {
  if (buckets.size < 5000) return;
  for (const [k, v] of buckets) {
    if (v.resetAt <= now) buckets.delete(k);
  }
}

function localRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);
  const hit = buckets.get(key);

  if (!hit || hit.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
  }

  if (hit.count >= limit) {
    return { allowed: false, remaining: 0, retryAfter: Math.ceil((hit.resetAt - now) / 1000) };
  }

  hit.count += 1;
  return { allowed: true, remaining: limit - hit.count, retryAfter: 0 };
}

async function sharedRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  cfg: { url: string; token: string }
): Promise<RateLimitResult> {
  const redisKey = `${KEY_PREFIX}${key}`;
  const auth = { Authorization: `Bearer ${cfg.token}`, "Upstash-Encoding": "plain" };

  const incr = await upstashFetch(`${cfg.url}/incr/${encodeURIComponent(redisKey)}`, {
    method: "POST",
    headers: auth,
  });
  if (!incr.ok) throw new Error(`upstash incr ${incr.status}`);
  const { result: count } = (await incr.json()) as { result: number };

  if (count === 1) {
    // İlk vuruş pencereyi başlatır; INCR atomik olduğundan yalnız bir istek
    // 1 görür, böylece her vuruşta pencere sıfırlanmaz (kayan pencere değil,
    // sabit pencere: basit ve yeterli).
    const expire = await upstashFetch(`${cfg.url}/pexpire/${encodeURIComponent(redisKey)}/${windowMs}`, {
      method: "POST",
      headers: auth,
    });
    if (!expire.ok) throw new Error(`upstash pexpire ${expire.status}`);
  }

  if (count > limit) {
    let ttlMs = windowMs;
    try {
      const ttl = await upstashFetch(`${cfg.url}/pttl/${encodeURIComponent(redisKey)}`, {
        method: "POST",
        headers: auth,
      });
      if (ttl.ok) {
        const { result } = (await ttl.json()) as { result: number };
        if (typeof result === "number" && result > 0) ttlMs = result;
      }
    } catch {
      // PTTL okunamazsa pencere süresi tahmin olarak kullanılır.
    }
    return decideFromIncr(count, limit, ttlMs);
  }

  return decideFromIncr(count, limit, windowMs);
}

async function upstashFetch(url: string, init: RequestInit): Promise<Response> {
  assertUpstashUrl(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTASH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function assertUpstashUrl(raw: string): void {
  const parsed = new URL(raw);
  const trustedHost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname.endsWith(".upstash.io");
  if (parsed.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(parsed.hostname)) {
    throw new Error("Upstash endpoint must use HTTPS");
  }
  if (!trustedHost) throw new Error("Upstash endpoint host is not allowed");
}

/**
 * Yalnızca yerel/geliştirme ortamında sınırlayıcıyı kapatır. Uçtan uca test
 * takımı tek bir dev sunucusuna karşı onlarca kayıt/rezervasyon yapar; in-memory
 * sayaç bunların bir kısmını 429'a çevirir ve testi ürün hatası gibi kırmızı
 * gösterir. Üretimde NODE_ENV="production" olduğundan bu bayrak yok sayılır —
 * abuse koruması canlıda asla sessizce kapanmaz.
 */
function rateLimitDisabled(): boolean {
  return process.env.RATE_LIMIT_DISABLED === "1" && process.env.NODE_ENV !== "production";
}

export async function rateLimit(key: string, limit = 5, windowMs = 60_000): Promise<RateLimitResult> {
  if (rateLimitDisabled()) return { allowed: true, remaining: limit, retryAfter: 0 };
  const cfg = upstashConfig();
  if (!cfg) return localRateLimit(key, limit, windowMs);
  try {
    return await sharedRateLimit(key, limit, windowMs, cfg);
  } catch (err) {
    console.error("[ratelimit] paylasimli store erisilemiyor, fail-closed:", err);
    return { allowed: false, remaining: 0, retryAfter: Math.max(1, Math.min(60, Math.ceil(windowMs / 1000))) };
  }
}

// Testler için in-memory kovaları boşaltır.
export function __resetRateLimitForTests() {
  buckets.clear();
}

// İstekten istemci IP'sini güvenilir proxy başlığından çıkarır. X-Forwarded-For
// istemcinin taşıyabileceği bir liste olduğu için rate-limit anahtarını onun
// ilk elemanına bağlamıyoruz; aksi halde saldırgan IP rotasyonu yapabilir.
export function clientIp(req: Request): string {
  const h = req.headers;
  return h.get("x-real-ip")?.trim() || "unknown";
}

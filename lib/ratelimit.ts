// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Hız sınırlayıcı. Upstash Redis (REST) yapılandırılmışsa sayaç tüm         ║
// ║  instance'lar arasında paylaşılır; yapılandırılmamışsa in-memory sürer.    ║
// ║  Paylaşımlı store erişilemezse istek engellenmez (fail-open): koruma       ║
// ║  bozulur ama ürün çalışmaya devam eder; hata loglanır.                     ║
// ╚══════════════════════════════════════════════════════════════════════════╝

type Hit = { count: number; resetAt: number };

const buckets = new Map<string, Hit>();
const KEY_PREFIX = "rl:";

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

  const incr = await fetch(`${cfg.url}/incr/${encodeURIComponent(redisKey)}`, {
    method: "POST",
    headers: auth,
  });
  if (!incr.ok) throw new Error(`upstash incr ${incr.status}`);
  const { result: count } = (await incr.json()) as { result: number };

  if (count === 1) {
    // İlk vuruş pencereyi başlatır; INCR atomik olduğundan yalnız bir istek
    // 1 görür, böylece her vuruşta pencere sıfırlanmaz (kayan pencere değil,
    // sabit pencere: basit ve yeterli).
    await fetch(`${cfg.url}/pexpire/${encodeURIComponent(redisKey)}/${windowMs}`, {
      method: "POST",
      headers: auth,
    });
  }

  if (count > limit) {
    let ttlMs = windowMs;
    try {
      const ttl = await fetch(`${cfg.url}/pttl/${encodeURIComponent(redisKey)}`, {
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

export async function rateLimit(key: string, limit = 5, windowMs = 60_000): Promise<RateLimitResult> {
  const cfg = upstashConfig();
  if (!cfg) return localRateLimit(key, limit, windowMs);
  try {
    return await sharedRateLimit(key, limit, windowMs, cfg);
  } catch (err) {
    console.error("[ratelimit] paylasimli store erisilemiyor, fail-open:", err);
    return { allowed: true, remaining: limit, retryAfter: 0 };
  }
}

// Testler için in-memory kovaları boşaltır.
export function __resetRateLimitForTests() {
  buckets.clear();
}

// İstekten istemci IP'sini en iyi çabayla çıkarır (proxy başlıkları dahil).
export function clientIp(req: Request): string {
  const h = req.headers;
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip") || "unknown";
}

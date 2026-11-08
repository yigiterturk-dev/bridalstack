import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { FREE_PACK_IDS, SELLABLE_PACK_IDS } from "@/config/modules";
import { startTrial } from "@/lib/trial";
import { validateRegistration, slugBase, pickUniqueSlug } from "@/lib/register";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { isValidTimeZone } from "@/lib/timezone";

export async function POST(req: Request) {
  try {
    // IP bazlı hız sınırı — public endpoint, spam'e karşı. 10 kayıt/saat.
    // Upstash yapılandırıldıysa sınır instance'lar arasında paylaşılır.
    const ip = clientIp(req);
    const rl = await rateLimit(`register:${ip}`, 10, 60 * 60 * 1000);
    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: "Too many attempts, try again later" }), {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfter) },
      });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400 });
    }
    const input = body && typeof body === "object" ? body as { email?: unknown; password?: unknown; shopName?: unknown } : {};
    const v = validateRegistration(input);
    if (!v.ok) {
      return new Response(JSON.stringify({ error: v.error }), { status: 400 });
    }
    const { email, password, shopName } = v;
    // Dükkânın saat dilimi kayıt olan tarayıcıdan: yoksa randevular UTC'ye göre kayar.
    const rawTz = (input as { timeZone?: unknown }).timeZone;
    const time_zone = isValidTimeZone(rawTz) ? String(rawTz).trim() : null;

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      return new Response(JSON.stringify({ error: "Email already exists" }), { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Slug çakışması: aynı addaki butikler numaralanır (elegance-bridal-2 ...).
    const base = slugBase(shopName);
    const taken = new Set(
      (await prisma.tenant.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } }))
        .map((t) => t.slug)
    );
    const slug = pickUniqueSlug(shopName, (s) => taken.has(s));

    // Üçü tek işlemde: yarıda kalırsa kullanıcı kiracısız kalıyordu. O kullanıcı
    // giriş yapabiliyor ama her sayfa onu /onboarding'e atıyor — yani kayıt
    // yarım kalmış bir hesap, kurulum ekranından geçmek zorunda kalıyordu.
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: email.toLowerCase(),
          password_hash: hashedPassword,
          name: shopName,
        }
      });

      // Kayıt yolu onboarding'den geçmiyor (paket seçimi yok): deneme burada
      // açılmazsa yeni kullanıcı ücretli modülleri hiç görmeden kilitli
      // ekranla karşılaşır. Deneme paketleri `packs`'e YAZILMAZ, süresi
      // dolunca kendiliğinden kapanır (bkz. lib/trial.ts).
      const trial = startTrial([...SELLABLE_PACK_IDS], new Date());

      const tenant = await tx.tenant.create({
        data: {
          name: shopName,
          slug,
          owner_id: user.id,
          // Ücretsiz paketler baştan açık: randevu sayfası ve hizmetler dahil.
          packs: FREE_PACK_IDS,
          settings: { ...(trial ? { trial_packs: trial.trialPacks } : {}), ...(time_zone ? { time_zone } : {}) },
          trial_started_at: trial?.trialStartedAt ?? null,
          trial_ends_at: trial?.trialEndsAt ?? null,
        }
      });

      await tx.tenantMember.create({
        data: {
          tenant_id: tenant.id,
          user_id: user.id,
          role: "owner",
          display_name: shopName,
        }
      });
    });

    return new Response(JSON.stringify({ success: true }), { status: 201 });
  } catch (error) {
    console.error("Registration error:", error);
    return new Response(JSON.stringify({ error: "Something went wrong" }), { status: 500 });
  }
}

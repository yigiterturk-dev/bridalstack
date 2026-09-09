import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { FREE_PACK_IDS, SELLABLE_PACK_IDS } from "@/config/modules";
import { startTrial } from "@/lib/trial";
import { validateRegistration, slugBase, pickUniqueSlug } from "@/lib/register";

// Basit IP bazlı hız sınırı — public endpoint, spam'e karşı. 10 kayıt/saat.
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 10;
const hits = new Map<string, number[]>();

function tooManyRequests(ip: string, now: number): boolean {
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= MAX_PER_WINDOW) return true;
  list.push(now);
  hits.set(ip, list);
  return false;
}

export async function POST(req: Request) {
  try {
    const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
    if (tooManyRequests(ip, Date.now())) {
      return new Response(JSON.stringify({ error: "Too many attempts, try again later" }), { status: 429 });
    }

    const body = await req.json();
    const v = validateRegistration(body);
    if (!v.ok) {
      return new Response(JSON.stringify({ error: v.error }), { status: 400 });
    }
    const { email, password, shopName } = v;

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
          settings: trial ? { trial_packs: trial.trialPacks } : {},
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

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { FREE_PACK_IDS } from "@/config/modules";
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

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password_hash: hashedPassword,
        name: shopName,
      }
    });

    // Slug çakışması: aynı adda butikler numaralanır (elegance-bridal-2 ...).
    const base = slugBase(shopName);
    const taken = new Set(
      (await prisma.tenant.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } }))
        .map((t) => t.slug)
    );
    const slug = pickUniqueSlug(shopName, (s) => taken.has(s));

    const tenant = await prisma.tenant.create({
      data: {
        name: shopName,
        slug,
        owner_id: user.id,
        // Ücretsiz paketler baştan açık: randevu sayfası ve hizmetler dahil.
        packs: FREE_PACK_IDS,
      }
    });

    await prisma.tenantMember.create({
      data: {
        tenant_id: tenant.id,
        user_id: user.id,
        role: "owner",
        display_name: shopName,
      }
    });

    return new Response(JSON.stringify({ success: true }), { status: 201 });
  } catch (error) {
    console.error("Registration error:", error);
    return new Response(JSON.stringify({ error: "Something went wrong" }), { status: 500 });
  }
}

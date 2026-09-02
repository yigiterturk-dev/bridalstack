import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { FREE_PACK_IDS } from "@/config/modules";

export async function POST(req: Request) {
  try {
    const { email, password, shopName } = await req.json();

    if (!email || !password || !shopName) {
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });
    }

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

    const slug = shopName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `shop-${Date.now()}`;

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

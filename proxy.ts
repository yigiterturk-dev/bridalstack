import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Next 16: middleware.ts -> proxy.ts, named export `proxy`, runtime nodejs.
// Korunan rotalara girişsiz erişimi kapatır; oturumsuz istekleri /login'e yollar.

const PROTECTED = [
  "/dashboard",
  "/customers",
  "/appointments",
  "/orders",
  "/products",
  "/analytics",
  "/calendar",
  "/bookings",
  "/contracts",
  "/services",
  "/staff",
  "/schedule",
  "/settings",
  "/trunk-shows",
  "/try-ons",
  "/workflows",
  "/onboarding",
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET || "super-secret-key-for-dev",
  });

  if (token) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("callbackUrl", pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    // Statik dosyalar ve /api dışındaki her şey
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { getAuthSecret } from "@/lib/auth-secret";

// Next 16: middleware.ts -> proxy.ts, named export `proxy`, runtime nodejs.
// Korunan rotalara girişsiz erişimi kapatır; oturumsuz istekleri /login'e yollar.

// Kendisi ve tüm alt yolları oturum ister.
const PROTECTED_PREFIX = [
  "/dashboard",
  "/customers",
  "/follow-ups",
  "/appointments",
  "/orders",
  "/products",
  "/analytics",
  "/calendar",
  "/bookings",
  "/services",
  "/staff",
  "/schedule",
  "/settings",
  "/trunk-shows",
  "/try-ons",
  "/workflows",
  "/onboarding",
];

// Sadece tam eşleşmede oturum ister; alt yolları herkese açıktır.
// /contracts panel listesidir, /contracts/<token> ise müşterinin imzaladığı
// herkese açık sayfadır — alt yolu korumak imza akışını tamamen kapatır.
const PROTECTED_EXACT = ["/contracts"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const needsAuth =
    PROTECTED_EXACT.includes(pathname) ||
    PROTECTED_PREFIX.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (!needsAuth) return NextResponse.next();

  const token = await getToken({
    req: request,
    secret: getAuthSecret(),
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

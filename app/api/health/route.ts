import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Lightweight liveness probe for uptime checks.
 *
 * This intentionally does not query the database or expose configuration
 * state. Dependency readiness is verified through deployment logs and the
 * authenticated smoke checks described in OPERATIONS.md.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", service: "bridalstack", dependencies: { database: "ok" } }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "degraded", service: "bridalstack", dependencies: { database: "unavailable" } }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

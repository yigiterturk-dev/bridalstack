import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Lightweight liveness probe for uptime checks.
 *
 * This intentionally does not query the database or expose configuration
 * state. Dependency readiness is verified through deployment logs and the
 * authenticated smoke checks described in OPERATIONS.md.
 */
export function GET() {
  return NextResponse.json(
    { status: "ok", service: "bridalstack" },
    { headers: { "Cache-Control": "no-store" } },
  );
}

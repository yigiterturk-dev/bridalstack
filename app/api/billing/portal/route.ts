import { NextRequest, NextResponse } from "next/server";
import { createDodoPortalSession, DodoError } from "@/lib/dodo";
import { readDodoState } from "@/lib/dodo-state";
import { getCurrentTenant, getCurrentUserId } from "@/lib/tenant";

/** Dodo Customer Portal oturumu — iptal, kart, fatura ve yenileme tek yerde. */
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenant = await getCurrentTenant();
  if (!tenant) return NextResponse.json({ error: "No tenant" }, { status: 400 });

  const state = readDodoState(tenant.settings as Record<string, unknown>);
  if (!state.customerId) return NextResponse.json({ error: "No subscription" }, { status: 400 });

  try {
    const session = await createDodoPortalSession(
      state.customerId,
      `${req.nextUrl.origin}/settings`,
    );
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Could not open Dodo customer portal:", error instanceof DodoError ? error.code : "unknown");
    return NextResponse.json(
      { error: "We couldn't open billing right now. Please try again." },
      { status: error instanceof DodoError && error.code === "NOT_CONFIGURED" ? 503 : 502 },
    );
  }
}

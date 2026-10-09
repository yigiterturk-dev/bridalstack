import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Request body is required" }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const token = typeof payload.token === "string" ? payload.token.trim() : "";
  const signature_data = typeof payload.signature_data === "string" ? payload.signature_data : "";
  const agreement_confirmed = payload.agreement_confirmed;

  if (!token || token.length > 256 || !signature_data || signature_data.length > 1_000_000 || agreement_confirmed !== true) {
    return NextResponse.json({ error: "Signature and agreement confirmation are required" }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";

  // Sadece "sent" durumundaki sözleşme imzalanabilir — çift imzayı ve
  // taslak/süresi geçmiş sözleşmenin imzalanmasını engeller.
  const result = await prisma.contract.updateMany({
    where: { token, status: "sent" },
    data: {
      status: "signed",
      signed_at: new Date(),
      signature_data,
      ip_address: ip,
    },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Contract not available for signing" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

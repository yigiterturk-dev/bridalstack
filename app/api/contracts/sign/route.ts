import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { token, signature_data, agreement_confirmed } = await req.json();
  if (!token || !signature_data || agreement_confirmed !== true) {
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

import { headers } from "next/headers";

/** E-posta bağlantılarında kullanılacak mutlak site adresi. */
export async function siteUrl(): Promise<string> {
  const env = process.env.NEXTAUTH_URL;
  if (env) return env.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

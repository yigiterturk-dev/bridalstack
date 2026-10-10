import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUserId } from "@/lib/tenant";
import { ensureDemoTenant, DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/demo-tenant";
import DemoSignIn from "./sign-in";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Live demo — Bridal Stack",
  description:
    "Open a working bridal shop inside Bridal Stack: gowns on the rack, a gown out on rental, alterations in progress and a dress at the cleaner. No sign-up, nothing to install.",
};

/**
 * Kayıtsız tanıtım girişi.
 *
 * Instagram'dan gelen butikçi kayıt duvarına çarpmasın diye var. Kiracı ve
 * verisi burada, isteğin içinde hazırlanır — kurulum adımı yok, bayatlarsa
 * kendi kendini tazeler (bkz. lib/demo-tenant.ts).
 */
export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ switch?: string }>;
}) {
  const userId = await getCurrentUserId();
  const wantsSwitch = (await searchParams).switch === "1";

  // Kendi hesabıyla gezen birini sessizce demo hesabına düşürmek, oturumunu
  // kapatmak demek olurdu. Kararı ona bırakıyoruz.
  if (userId && !wantsSwitch) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-6 text-center">
        <h1 className="text-2xl font-semibold text-neutral-900">You&rsquo;re already signed in</h1>
        <p className="text-neutral-600">
          The demo runs on a separate read-only account, so opening it would sign you out of your own
          shop. Your data stays where it is either way.
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href="/dashboard"
            className="rounded-lg bg-neutral-900 px-5 py-3 font-medium text-white hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2"
          >
            Back to my shop
          </Link>
          <Link href="/demo?switch=1" className="text-sm text-neutral-500 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 rounded">
            Sign out and open the demo
          </Link>
        </div>
      </main>
    );
  }

  await ensureDemoTenant();

  return <DemoSignIn email={DEMO_EMAIL} password={DEMO_PASSWORD} signOutFirst={wantsSwitch} />;
}

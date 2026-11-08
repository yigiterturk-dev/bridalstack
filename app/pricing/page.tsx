import Link from "next/link";
import type { Metadata } from "next";
import PricingSection from "@/components/pricing-section";
import { ANNUAL_BILLING_MONTHS } from "@/config/modules";
import { TRIAL_DAYS } from "@/lib/trial";
import { siteBase, siteMetadata } from "@/lib/seo";

// Ödeme hattı env'den okunur; Docker build'inde env yok → statik üretimde
// "ödeme kapalı" sürümü donardı. İstek anında render et.
export const dynamic = "force-dynamic";

export const metadata: Metadata = siteMetadata({
  base: siteBase(),
  path: "/pricing",
  title: "Pricing",
  description:
    "Bridal Stack pricing: a free plan for client management and appointments, plus paid modules billed monthly or yearly. Cancel any time.",
});

const DETAILS: { q: string; a: string }[] = [
  {
    q: "What is free?",
    a: "Customer management, appointments, the client portal and the online booking page are free for as long as you use Bridal Stack. No card is needed to sign up.",
  },
  {
    q: "How does the trial work?",
    a: `Every new account gets a ${TRIAL_DAYS}-day trial of the paid modules, with no card required. When it ends nothing is deleted: the paid modules lock and the free plan keeps running with your records intact. You subscribe only to the modules you want to keep.`,
  },
  {
    q: "How am I billed?",
    a: `Each paid module is a separate subscription, billed in US dollars either monthly or yearly. The yearly price is ${ANNUAL_BILLING_MONTHS} months of the monthly price. Payments are processed by Dodo Payments, our merchant of record, which also calculates any sales tax or VAT that applies to you at checkout and issues your invoices.`,
  },
  {
    q: "Can I add or remove modules later?",
    a: "Yes. Add a module from Settings at any time. When you cancel a module through the billing portal, it stays unlocked until the end of the period you have already paid for and is not renewed after that.",
  },
  {
    q: "Is there a contract or setup fee?",
    a: "No. There is no setup fee and no minimum term. You can cancel any time.",
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[#FDFCFB] text-stone-900">
      <div className="max-w-6xl mx-auto px-6 pt-10 pb-12 flex items-center justify-between gap-4">
        <Link href="/landing" className="text-sm text-stone-400 hover:text-stone-600 transition-colors">
          ← Bridal Stack
        </Link>
        <Link
          href="/signup"
          className="px-5 py-2 bg-stone-900 text-white rounded-full text-sm font-semibold hover:bg-stone-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-4"
        >
          Start free
        </Link>
      </div>

      <PricingSection headingLevel="h1" />

      <section className="max-w-2xl mx-auto px-6 py-24">
        <h2 className="text-3xl font-extrabold tracking-tight">Billing details</h2>
        <dl className="mt-10 grid gap-10">
          {DETAILS.map((d) => (
            <div key={d.q}>
              <dt className="text-lg font-bold tracking-tight">{d.q}</dt>
              <dd className="mt-3 text-stone-600 leading-[1.8]">{d.a}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-12 text-stone-600 leading-[1.8]">
          Read the{" "}
          <Link href="/refund" className="font-semibold text-stone-900 underline underline-offset-4">refund policy</Link>
          {" "}and the{" "}
          <Link href="/terms" className="font-semibold text-stone-900 underline underline-offset-4">terms of service</Link>
          . Questions about a plan?{" "}
          <a href="mailto:hello@bridalstack.com" className="font-semibold text-stone-900 underline underline-offset-4">hello@bridalstack.com</a>
        </p>
      </section>
    </main>
  );
}

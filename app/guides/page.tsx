import Link from "next/link";
import type { Metadata } from "next";
import { GUIDES } from "@/content/guides";
import { siteBase, siteMetadata } from "@/lib/seo";

export const metadata: Metadata = siteMetadata({
  base: siteBase(),
  path: "/guides",
  title: "Guides for bridal boutiques",
  description:
    "Practical guides on running a bridal shop: tracking gowns, structuring deposits and payment schedules, and counting stock that travels.",
});

export default function GuidesIndex() {
  return (
    <main className="min-h-screen bg-[#FDFCFB] text-stone-900">
      <header className="max-w-3xl mx-auto px-6 pt-20 pb-12">
        <Link href="/landing" className="text-sm text-stone-400 hover:text-stone-600 transition-colors">
          ← Bridal Stack
        </Link>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mt-6">
          Guides for bridal boutiques
        </h1>
        <p className="text-lg text-stone-500 mt-5 leading-relaxed font-light">
          Short, opinionated pieces on the parts of a bridal shop that are easy to get wrong:
          where a gown actually is, what a bride still owes, and what your stock really cost you.
        </p>
      </header>

      <div className="max-w-3xl mx-auto px-6 pb-24 grid gap-5">
        {GUIDES.map((g) => (
          <Link
            key={g.slug}
            href={`/guides/${g.slug}`}
            className="block rounded-2xl border border-stone-200 bg-white p-7 hover:border-stone-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all"
          >
            <h2 className="text-xl font-bold tracking-tight">{g.title}</h2>
            <p className="text-stone-500 mt-3 leading-relaxed">{g.summary}</p>
            <p className="text-xs uppercase tracking-[0.15em] text-stone-400 mt-5">
              {g.readMinutes} min read
            </p>
          </Link>
        ))}
      </div>

      <footer className="border-t border-stone-200/70">
        <div className="max-w-3xl mx-auto px-6 py-14 text-center">
          <p className="text-stone-500">
            Bridal Stack runs the day-to-day of a bridal shop — brides, fittings, orders,
            payments and stock — in one place.
          </p>
          <Link
            href="/signup"
            className="inline-block mt-6 px-8 py-3.5 bg-stone-900 text-white rounded-full font-medium hover:bg-stone-800 transition-colors"
          >
            Start free →
          </Link>
        </div>
      </footer>
    </main>
  );
}

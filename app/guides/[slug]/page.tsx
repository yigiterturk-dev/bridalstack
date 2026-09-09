import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GUIDES, guideBySlug } from "@/content/guides";
import { siteBase, siteMetadata, absoluteUrl, SITE_NAME } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

/** Yazılar sabit: her biri build'de üretilir, istek başına render edilmez. */
export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const guide = guideBySlug(slug);
  if (!guide) return { title: "Not found" };

  return siteMetadata({
    base: siteBase(),
    path: `/guides/${guide.slug}`,
    title: guide.title,
    description: guide.description,
    publishedAt: guide.publishedAt,
  });
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params;
  const guide = guideBySlug(slug);
  if (!guide) notFound();

  const base = siteBase();
  // Arama sonucunda yazı olarak görünsün diye yapısal veri; içerik sayfadakiyle
  // aynı kaynaktan okunur, ikisi ayrışamaz.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    datePublished: guide.publishedAt,
    dateModified: guide.publishedAt,
    mainEntityOfPage: absoluteUrl(base, `/guides/${guide.slug}`),
    publisher: { "@type": "Organization", name: SITE_NAME, url: absoluteUrl(base, "/landing") },
  };

  return (
    <main className="min-h-screen bg-[#FDFCFB] text-stone-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <article className="max-w-2xl mx-auto px-6 pt-20 pb-24">
        <Link href="/guides" className="text-sm text-stone-400 hover:text-stone-600 transition-colors">
          ← All guides
        </Link>

        <h1 className="text-4xl md:text-[2.75rem] font-extrabold tracking-tight leading-[1.1] mt-6">
          {guide.title}
        </h1>
        <p className="text-xs uppercase tracking-[0.15em] text-stone-400 mt-6">
          {guide.readMinutes} min read
        </p>
        <p className="text-xl text-stone-500 mt-6 leading-relaxed font-light">{guide.summary}</p>

        <div className="mt-14 grid gap-12">
          {guide.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-2xl font-bold tracking-tight">{section.heading}</h2>
              <div className="grid gap-5 mt-5">
                {section.body.map((paragraph, i) => (
                  <p key={i} className="text-stone-600 leading-[1.8]">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-16 rounded-2xl border border-stone-200 bg-white p-8 text-center">
          <p className="text-stone-600 leading-relaxed">
            Bridal Stack puts this into practice: every gown has one status, every order has one
            total, and every count records the difference instead of hiding it.
          </p>
          <Link
            href="/signup"
            className="inline-block mt-6 px-8 py-3.5 bg-stone-900 text-white rounded-full font-medium hover:bg-stone-800 transition-colors"
          >
            Start free →
          </Link>
        </div>
      </article>
    </main>
  );
}

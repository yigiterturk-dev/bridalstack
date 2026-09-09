import Link from "next/link";

export type LegalSection = { heading: string; body: string[] };

/** Hukuki sayfaların ortak kabuğu — iki sayfa da aynı biçimi paylaşsın. */
export default function LegalPage({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <main className="min-h-screen bg-[#FDFCFB] text-stone-900">
      <article className="max-w-2xl mx-auto px-6 pt-20 pb-24">
        <Link href="/landing" className="text-sm text-stone-400 hover:text-stone-600 transition-colors">
          ← Bridal Stack
        </Link>
        <h1 className="text-4xl font-extrabold tracking-tight mt-6">{title}</h1>
        <p className="text-xs uppercase tracking-[0.15em] text-stone-400 mt-5">Last updated {updated}</p>
        <p className="text-lg text-stone-500 mt-6 leading-relaxed font-light">{intro}</p>

        <div className="mt-12 grid gap-10">
          {sections.map((s) => (
            <section key={s.heading}>
              <h2 className="text-xl font-bold tracking-tight">{s.heading}</h2>
              <div className="grid gap-4 mt-4">
                {s.body.map((p, i) => (
                  <p key={i} className="text-stone-600 leading-[1.8]">
                    {p}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}

import Link from "next/link";

/**
 * Tanıtım kiracısının üst şeridi.
 *
 * İki işi var: ziyaretçi gördüğü verinin gerçek olmadığını bilsin (yoksa
 * "benim butiğim böyle değil" der) ve kayıt yolu ekranın en görünür yerinde
 * dursun — demo'nun tek amacı o tık.
 */
export default function DemoBanner() {
  return (
    <div className="mb-6 flex flex-col gap-3 rounded-xl border border-gold/30 bg-gold-soft px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-gold">
        <span className="font-semibold">Sample boutique.</span> Real screens, made-up gowns and
        brides. Nothing here can be changed or deleted.
      </p>
      <Link
        href="/signup"
        className="shrink-0 rounded-lg bg-gold px-4 py-2 text-center font-medium text-white hover:bg-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 focus-visible:ring-offset-2"
      >
        Start your own shop — free
      </Link>
    </div>
  );
}

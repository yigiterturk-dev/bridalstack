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
    <div className="mb-6 flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-rose-900">
        <span className="font-semibold">Sample boutique.</span> Real screens, made-up gowns and
        brides. Nothing here can be changed or deleted.
      </p>
      <Link
        href="/signup"
        className="shrink-0 rounded-lg bg-rose-900 px-4 py-2 text-center font-medium text-white hover:bg-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
      >
        Start your own shop — free
      </Link>
    </div>
  );
}

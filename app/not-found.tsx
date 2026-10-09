import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#fafafa] px-6 py-24 text-center text-gray-900">
      <div className="mx-auto max-w-md rounded-2xl border border-gray-200 bg-white p-10 shadow-sm">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
          <span aria-hidden="true" className="material-symbols-outlined text-3xl text-gray-500">search_off</span>
        </div>
        <h1 className="text-xl font-semibold">We couldn’t find that page</h1>
        <p className="mt-3 text-sm leading-6 text-gray-500">
          The link may be outdated, or this boutique page is no longer available.
        </p>
        <Link
          href="/"
          className="mt-7 inline-flex items-center justify-center rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2"
        >
          Go to BridalStack
        </Link>
      </div>
    </main>
  );
}

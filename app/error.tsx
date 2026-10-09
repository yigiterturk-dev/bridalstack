"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("BridalStack route error:", error);
  }, [error]);

  return (
    <main className="min-h-screen bg-[#fafafa] px-6 py-24 text-center text-gray-900">
      <div className="mx-auto max-w-md rounded-2xl border border-gray-200 bg-white p-10 shadow-sm">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-rose-50">
          <span aria-hidden="true" className="material-symbols-outlined text-3xl text-rose-500">error</span>
        </div>
        <h1 className="text-xl font-semibold">We hit a snag</h1>
        <p className="mt-3 text-sm leading-6 text-gray-500">
          Nothing was lost. Please try again, or return to the dashboard and continue where you left off.
        </p>
        <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex w-full items-center justify-center rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 sm:w-auto"
          >
            Try again
          </button>
          <a
            href="/dashboard"
            className="inline-flex w-full items-center justify-center rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 sm:w-auto"
          >
            Back to dashboard
          </a>
        </div>
      </div>
    </main>
  );
}

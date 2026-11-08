import Link from "next/link";

/** Patron bu bölümü bu kişiye açmadı: plan değil, izin meselesi. */
export default function ClosedByOwner({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <span aria-hidden="true" className="material-symbols-outlined mb-4 text-3xl text-[var(--muted)]">lock</span>
      <h2 className="mb-2 font-serif text-2xl font-normal text-[var(--ink)]">{title}</h2>
      <p className="mb-6 max-w-md text-[var(--muted)]">The shop owner has not opened this part for you. Ask them if you need it.</p>
      <Link href="/dashboard" className="rounded-xl bg-[var(--ink)] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90">Back to Today</Link>
    </div>
  );
}

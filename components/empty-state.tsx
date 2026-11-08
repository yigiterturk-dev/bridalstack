import Link from "next/link";

// Boş ekran kuralı: ne olduğunu söyle, ne yapılacağını söyle, tek buton.
// action.href "#new" ise aynı sayfadaki forma kaydırır.
export default function EmptyState({
  icon,
  title,
  action,
  children,
}: {
  icon?: string;
  title: React.ReactNode;
  action?: { href: string; label: string };
  children?: React.ReactNode;
}) {
  const button = action ? (
    action.href.startsWith("#") ? (
      <a href={action.href} className="bs-btn-dark mt-6">{action.label}</a>
    ) : (
      <Link href={action.href} className="bs-btn-dark mt-6">{action.label}</Link>
    )
  ) : null;

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white px-6 py-14 text-center">
      {icon && (
        <span aria-hidden="true" className="material-symbols-outlined mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gold-soft text-[26px] text-gold">
          {icon}
        </span>
      )}
      <h3 className="font-serif text-xl text-[var(--ink)]">{title}</h3>
      {children && <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">{children}</p>}
      {button}
    </div>
  );
}

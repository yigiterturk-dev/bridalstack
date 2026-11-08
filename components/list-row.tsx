import Link from "next/link";
import type { ReactNode } from "react";

export type Tone = "late" | "behind" | "ok" | "done" | "none";
const DOT: Record<Tone, string> = { late: "bg-late", behind: "bg-amber", ok: "bg-gold", done: "bg-[var(--line)]", none: "" };

/**
 * Today'deki gelin satırıyla aynı dil: solda ad + tek satır "ne durumda",
 * sağda tek büyük sayı + altında küçük açıklama. Tablo yok, sütun başlığı yok.
 */
export default function ListRow(props: {
  href?: string;
  lead?: ReactNode;
  title: string;
  sub?: ReactNode;
  tone?: Tone;
  value?: ReactNode;
  valueSub?: ReactNode;
  valueTone?: "ink" | "late" | "muted";
}) {
  const { href, lead, title, sub, tone = "none", value, valueSub, valueTone = "ink" } = props;
  const valueColor = valueTone === "late" ? "text-late" : valueTone === "muted" ? "text-[var(--muted)]" : "text-[var(--ink)]";
  const body = (
    <>
      {lead}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {tone !== "none" && <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${DOT[tone]}`} />}
          <span className="truncate font-medium text-[var(--ink)]">{title}</span>
        </div>
        {sub && <p className="mt-0.5 text-sm text-[var(--muted)] sm:truncate">{sub}</p>}
      </div>
      {(value || valueSub) && (
        <div className="shrink-0 text-right">
          {value && <div className={`font-serif text-lg tabular-nums ${valueColor}`}>{value}</div>}
          {valueSub && <div className="text-xs text-[var(--muted)] tabular-nums">{valueSub}</div>}
        </div>
      )}
    </>
  );
  const cls = "flex items-center gap-4 px-4 py-3";
  return href ? (
    <Link href={href} className={`${cls} transition-colors hover:bg-stone-50 focus-visible:bg-stone-50 focus-visible:outline-none`}>{body}</Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function ListBox({ children }: { children: ReactNode }) {
  return <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white divide-y divide-[var(--line)]">{children}</div>;
}

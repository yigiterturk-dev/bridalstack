import Link from "next/link";
import JourneyBar from "@/components/journey-bar";
import type { JourneyStep, Risk } from "@/lib/journey";

export function countdownLabel(days: number | null): string {
  if (days === null) return "No date";
  if (days === 0) return "Today";
  if (days < 0) return "Married";
  return `${days} day${days === 1 ? "" : "s"}`;
}

const DOT: Record<Risk, string> = { late: "bg-late", behind: "bg-amber", on_track: "bg-gold", married: "bg-[var(--line)]" };

export default function BrideRow(props: { id: string; name: string; reason: string | null; daysToWedding: number | null; steps: JourneyStep[]; risk: Risk }) {
  const { id, name, reason, daysToWedding, steps, risk } = props;
  return (
    <Link href={`/customers/${id}`} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_8rem_6rem] items-center gap-x-4 gap-y-2 px-4 py-3 hover:bg-stone-50 transition-colors">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${DOT[risk]}`} />
          <span className="truncate font-medium text-[var(--ink)]">{name}</span>
        </div>
        {reason && <p className="mt-0.5 truncate text-sm text-[var(--muted)]">{reason}</p>}
      </div>
      <div className="col-span-2 sm:col-span-1 sm:order-none order-last"><JourneyBar steps={steps} risk={risk} /></div>
      <span className="text-right font-serif text-lg tabular-nums text-[var(--ink)]">{countdownLabel(daysToWedding)}</span>
    </Link>
  );
}

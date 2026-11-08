import type { JourneyStep, Risk } from "@/lib/journey";

/** 5 parçalı ilerleme: biten = altın; sıradaki adım geride/gecikmişse sarı/kırmızı. */
export default function JourneyBar({ steps, risk, labels = false }: { steps: JourneyStep[]; risk: Risk; labels?: boolean }) {
  const current = steps.findIndex((s) => !s.done);
  return (
    <div className="w-full">
      <div className="flex gap-1" role="img" aria-label={`${steps.filter((s) => s.done).length} of ${steps.length} steps done`}>
        {steps.map((s, i) => {
          const color = s.done
            ? "bg-gold"
            : i === current && risk === "late"
              ? "bg-late"
              : i === current && risk === "behind"
                ? "bg-amber"
                : "bg-[var(--line)]";
          return <span key={s.key} className={`h-1.5 flex-1 rounded-full ${color}`} />;
        })}
      </div>
      {labels && (
        <div className="mt-2 grid grid-cols-5 gap-1 text-[11px] leading-tight text-[var(--muted)]">
          {steps.map((s) => (
            <span key={s.key} className={s.done ? "text-[var(--ink)]" : ""}>{s.label}</span>
          ))}
        </div>
      )}
    </div>
  );
}

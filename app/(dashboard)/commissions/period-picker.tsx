"use client";

import { useRouter } from "next/navigation";
import SelectField from "@/components/select-field";
import { formatPeriod } from "@/lib/commissions";

/** Ay seçimi — seçilince sayfayı o dönemle yeniden yükler. */
export default function PeriodPicker({ periods, active }: { periods: string[]; active: string }) {
  const router = useRouter();

  return (
    <div className="w-48">
      <SelectField
        name="period"
        defaultValue={active}
        searchable={periods.length > 8}
        options={periods.map((p) => ({ value: p, label: formatPeriod(p) }))}
        onChange={(value) => {
          if (value !== active) router.push(`/commissions?period=${value}`);
        }}
      />
    </div>
  );
}

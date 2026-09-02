"use client";

import { useRouter, useSearchParams } from "next/navigation";

const OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "180", label: "Son 6 ay" },
  { value: "365", label: "Son 12 ay" },
];

export default function RangeFilter({ current }: { current: string }) {
  const router = useRouter();
  const params = useSearchParams();

  function set(value: string) {
    const sp = new URLSearchParams(params.toString());
    sp.set("range", value);
    router.push(`/analytics?${sp.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => set(o.value)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
            current === o.value
              ? "bg-[var(--accent-soft)] border-[var(--accent-ring)] text-[var(--accent-hover)]"
              : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

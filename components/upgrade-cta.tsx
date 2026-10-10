"use client";

import Link from "next/link";
import { useState } from "react";
import { trackFunnelEvent } from "@/lib/funnel";

type Props = {
  daysLeft: number | null;
  expired: boolean;
};

// Deneme/ücretsiz kullanıcılar için yükseltme çağrısı (CTA). Tıklama olayını izler.
export default function UpgradeCta({ daysLeft, expired }: Props) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div
      className={`mb-6 rounded-2xl border p-4 flex items-center justify-between gap-4 ${
        expired
          ? "bg-red-50 border-red-200"
          : "bg-[var(--accent-soft)] border-[var(--accent-ring)]"
      }`}
    >
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 material-symbols-outlined ${expired ? "bg-red-100 text-red-600" : "bg-white text-[var(--accent)]"}`}>
          {expired ? "lock_clock" : "rocket_launch"}
        </span>
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {expired
              ? "Your trial has ended"
              : daysLeft !== null
              ? `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left in your trial`
                : "Unlock more modules"}
          </p>
          <p className="text-xs text-gray-600">
            Upgrade your plan to unlock sales, finance, and inventory modules.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href="/settings"
          onClick={() => {
            void trackFunnelEvent("upgrade_cta_clicked", { expired, daysLeft });
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-base">upgrade</span>
          Upgrade plan
        </Link>
        {!expired && (
          <button
            onClick={() => setDismissed(true)}
            className="text-gray-400 hover:text-gray-600 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2"
            aria-label="Dismiss trial banner"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-lg">close</span>
          </button>
        )}
      </div>
    </div>
  );
}

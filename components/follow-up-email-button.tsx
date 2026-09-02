"use client";

import { useState, useTransition } from "react";
import { sendFollowUpEmail } from "@/app/(dashboard)/follow-ups/actions";

function daysAgoLabel(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Emailed today";
  return `Emailed ${days}d ago`;
}

/**
 * Takip listesindeki tek tıklık hatırlatma butonu.
 * Zaten gönderilmişse buton yerine sessiz bir durum rozeti gösterilir.
 */
export default function FollowUpEmailButton({
  customerId,
  productId,
  hasEmail,
  lastSentAt,
}: {
  customerId: string;
  productId?: string | null;
  hasEmail: boolean;
  lastSentAt?: string | null;
}) {
  const [sentAt, setSentAt] = useState<string | null>(lastSentAt ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!hasEmail) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-400">
        <span className="material-symbols-outlined text-[16px]">mail_off</span>
        No email
      </span>
    );
  }

  if (sentAt) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 text-xs font-semibold text-emerald-700">
        <span className="material-symbols-outlined text-[16px]">mark_email_read</span>
        {daysAgoLabel(sentAt)}
      </span>
    );
  }

  function send() {
    setError(null);
    startTransition(async () => {
      const res = await sendFollowUpEmail(customerId, productId ?? null);
      if (res.ok) setSentAt(res.sentAt);
      else setError(res.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={send}
        disabled={pending}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-900 text-white text-xs font-semibold hover:bg-rose-600 transition-colors disabled:opacity-50"
      >
        <span className="material-symbols-outlined text-[16px]">send</span>
        {pending ? "Sending…" : "Send reminder"}
      </button>
      {error && <span className="text-[11px] text-rose-600 max-w-[180px] text-right">{error}</span>}
    </div>
  );
}

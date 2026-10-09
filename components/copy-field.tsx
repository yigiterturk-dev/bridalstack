"use client";

import { useState } from "react";

/** Salt okunur bir metni tek tıkla panoya kopyalar. */
export default function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        readOnly
        value={value}
        aria-label="Value to copy"
        onFocus={(e) => e.currentTarget.select()}
        className="flex-1 px-3 py-2 rounded-xl border border-gray-300 text-xs bg-gray-50 font-mono"
      />
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : "Copy value"}
        className="px-3 py-2 rounded-xl bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 whitespace-nowrap"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

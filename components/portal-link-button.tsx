"use client";

import { useState } from "react";

export default function PortalLinkButton({ customerId }: { customerId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: customerId }),
      });
      const data = await res.json();
      if (data.url) setUrl(data.url);
      else setError(data.error || "Failed to generate the portal link. Please try again.");
    } catch {
      setError("Failed to generate the portal link. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (url) {
    return (
      <div className="flex items-center gap-2">
        <input type="text" readOnly value={url} aria-label="Client portal link" className="flex-1 px-3 py-1.5 rounded-lg border border-gray-300 text-xs bg-gray-50 font-mono" />
        <button type="button" onClick={copy} aria-label={copied ? "Copied" : "Copy client portal link"} className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-medium hover:bg-gray-800">
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        onClick={generate}
        disabled={loading}
        type="button"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
      >
        <span className="material-symbols-outlined text-sm">link</span>
        {loading ? "Generating..." : "Client Portal"}
      </button>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

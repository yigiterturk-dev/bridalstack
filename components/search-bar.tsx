"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import BarcodeScanner from "./barcode-scanner";

export default function SearchBar({ placeholder = "Search...", basePath }: { placeholder?: string; basePath: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [showScanner, setShowScanner] = useState(false);

  function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (query.trim()) {
      params.set("q", query.trim());
    } else {
      params.delete("q");
    }
    router.push(`${basePath}?${params.toString()}`);
  }

  function handleScanSuccess(code: string) {
    setQuery(code);
    setShowScanner(false);
    
    // Automatically submit search with scanned code
    const params = new URLSearchParams(searchParams.toString());
    params.set("q", code);
    router.push(`${basePath}?${params.toString()}`);
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex gap-2 w-full">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">search</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            className="w-full pl-10 pr-12 py-2.5 rounded-xl border border-gray-200 bg-white text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-ring)]"
          />
          <button
            type="button"
            onClick={() => setShowScanner(true)}
            aria-label="Scan barcode with camera"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[var(--accent)] transition-colors flex items-center justify-center"
            title="Scan barcode with camera"
          >
            <span className="material-symbols-outlined text-lg">barcode_scanner</span>
          </button>
        </div>
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(""); router.push(basePath); }}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-900 shrink-0"
          >
            Clear
          </button>
        )}
      </form>

      {showScanner && (
        <BarcodeScanner
          onScanSuccess={handleScanSuccess}
          onClose={() => setShowScanner(false)}
        />
      )}
    </>
  );
}

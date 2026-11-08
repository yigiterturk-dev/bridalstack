"use client";

import { useState } from "react";
import { formatPrice } from "@/config/modules";

export default function StylistChat() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const presets = [
    `Recommend gowns under ${formatPrice(3000)} for a beach wedding`,
    "Which gowns have the highest try-on ratings?",
    "What should I suggest for a plus-size bride who likes lace?",
    "Show me our best-selling styles this month",
    "Find gowns that were loved but not purchased",
  ];

  async function handleAsk(q: string) {
    setQuery(q);
    setLoading(true);
    setResult("");
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      setResult(data.answer ?? data.error ?? "No response");
    } catch {
      setResult("Failed to get AI response");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-[var(--line)] p-6">
            <form onSubmit={(e) => { e.preventDefault(); handleAsk(query); }} className="flex gap-3 mb-6">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask anything about your shop..."
                className="flex-1 px-4 py-3 rounded-xl border border-stone-300 text-sm outline-none focus:ring-2 focus:ring-gold/40"
              />
              <button type="submit" disabled={loading || !query.trim()} className="px-6 py-3 bg-[var(--ink)] text-white rounded-xl text-sm font-medium hover:bg-stone-800 disabled:opacity-50">
                {loading ? "Thinking..." : "Ask AI"}
              </button>
            </form>

            {result && (
              <div className="p-6 rounded-xl bg-gold-soft border border-gold/30">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-gold">auto_awesome</span>
                  <span className="text-sm font-semibold text-[var(--ink)]">AI Stylist</span>
                </div>
                <div className="text-sm text-[var(--ink)] leading-relaxed whitespace-pre-wrap">{result}</div>
              </div>
            )}

            {!result && !loading && (
              <div className="text-center py-12">
                <span className="material-symbols-outlined text-5xl text-stone-200 mb-4 block">auto_awesome</span>
                <p className="text-[var(--muted)]">Ask a question to get started</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[var(--line)] p-6">
          <h2 className="font-serif font-normal text-[var(--ink)] mb-4">Quick Questions</h2>
          <div className="flex flex-col gap-2">
            {presets.map((p) => (
              <button
                key={p}
                onClick={() => handleAsk(p)}
                disabled={loading}
                className="text-left p-3 rounded-xl border border-[var(--line)] text-sm text-[var(--ink)] hover:border-stone-300 hover:bg-stone-50 transition-all disabled:opacity-50"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
  );
}

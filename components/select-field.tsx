"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type SelectOption = { value: string; label: string; hint?: string };

/**
 * Özel açılır liste. Native <select> kullanılmaz — tarayıcının gri kutusu
 * panele girmez. Seçim gizli input'a yazılır, böylece sunucu eylemleri
 * (FormData) hiçbir şey değiştirmeden çalışmaya devam eder.
 *
 * Seçenek sayısı eşiği aşınca arama kutusu kendiliğinden açılır.
 */
export default function SelectField({
  name,
  options,
  defaultValue = "",
  placeholder = "Select…",
  required = false,
  searchable,
  className = "",
  onChange,
}: {
  name: string;
  options: SelectOption[];
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  searchable?: boolean;
  className?: string;
  /** Seçim değiştiğinde haber ver — filtre gibi form dışı kullanımlar için. */
  onChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  const withSearch = searchable ?? options.length > 8;
  const selected = options.find((o) => o.value === value) ?? null;

  const visible = useMemo(() => {
    if (!withSearch || !query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || (o.hint ?? "").toLowerCase().includes(q)
    );
  }, [options, query, withSearch]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function choose(next: string) {
    setValue(next);
    setOpen(false);
    setQuery("");
    onChange?.(next);
  }

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      {/* Sunucu eylemi bu input'u okur; required doğrulaması da buradan gelir. */}
      <input type="hidden" name={name} value={value} required={required} />

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-sm text-left outline-none hover:border-stone-300 focus:border-stone-400 transition-colors"
      >
        <span className={`truncate ${selected ? "text-stone-900" : "text-stone-400"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <span className={`material-symbols-outlined text-[18px] text-stone-400 transition-transform ${open ? "rotate-180" : ""}`}>
          expand_more
        </span>
      </button>

      {open && (
        <div className="absolute z-30 mt-2 w-full rounded-xl border border-stone-200 bg-white shadow-lg overflow-hidden">
          {withSearch && (
            <div className="p-2 border-b border-stone-100">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm outline-none focus:border-stone-400"
              />
            </div>
          )}

          <div role="listbox" className="max-h-64 overflow-y-auto py-1">
            {visible.length === 0 ? (
              <div className="px-4 py-3 text-sm text-stone-400">No matches</div>
            ) : (
              visible.map((o) => {
                const isSelected = o.value === value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => choose(o.value)}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-stone-50 ${
                      isSelected ? "text-stone-900 font-semibold" : "text-stone-700"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{o.label}</span>
                      {o.hint && <span className="block text-xs text-stone-400 truncate">{o.hint}</span>}
                    </span>
                    {isSelected && <span className="material-symbols-outlined text-[18px] text-stone-900">check</span>}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

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
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const selectId = `${name.replace(/[^a-zA-Z0-9_-]/g, "-")}-select`;

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

  function openMenu() {
    const selectedIndex = visible.findIndex((option) => option.value === value);
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }

  function handleNavigationKeyDown(e: React.KeyboardEvent<HTMLElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      openMenu();
      return;
    }
    if (!open || visible.length === 0) return;

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((current) => {
        const delta = e.key === "ArrowDown" ? 1 : -1;
        return (current + delta + visible.length) % visible.length;
      });
      return;
    }

    if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      setHighlightedIndex(e.key === "Home" ? 0 : visible.length - 1);
      return;
    }

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(visible[highlightedIndex]?.value ?? visible[0].value);
    }
  }

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      {/* Sunucu eylemi bu input'u okur. type="hidden" tarayıcı doğrulamasının
          dışında kaldığı için zorunlu alanlarda görünmez ama gerçek bir input
          kullanılır — "bu alanı doldurun" balonu yine çıksın diye. Sunucu
          tarafındaki kontrol her hâlükârda son sözü söyler. */}
      <input
        name={name}
        value={value}
        required={required}
        onChange={(e) => setValue(e.target.value)}
        tabIndex={-1}
        aria-hidden="true"
        className="absolute left-4 bottom-1 w-px h-px opacity-0 p-0 border-0"
      />

      <button
        id={selectId}
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={handleNavigationKeyDown}
        role="combobox"
        aria-label={selected ? `${placeholder}: ${selected.label}` : placeholder}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${selectId}-listbox`}
        aria-activedescendant={open && visible[highlightedIndex] ? `${selectId}-option-${highlightedIndex}` : undefined}
        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-sm text-left outline-none hover:border-stone-300 focus:border-stone-400 focus-visible:ring-2 focus-visible:ring-gold/40 focus-visible:ring-offset-2 transition-colors"
      >
        <span className={`truncate ${selected ? "text-[var(--ink)]" : "text-stone-400"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <span aria-hidden="true" className={`material-symbols-outlined text-[18px] text-stone-400 transition-transform ${open ? "rotate-180" : ""}`}>
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
                onChange={(e) => {
                  setQuery(e.target.value);
                  setHighlightedIndex(0);
                }}
                onKeyDown={handleNavigationKeyDown}
                placeholder="Search…"
                aria-label={`${placeholder} search`}
                aria-activedescendant={visible[highlightedIndex] ? `${selectId}-option-${highlightedIndex}` : undefined}
                className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm outline-none focus:border-stone-400 focus-visible:ring-2 focus-visible:ring-gold/40"
              />
            </div>
          )}

          <div id={`${selectId}-listbox`} role="listbox" aria-label={`${placeholder} options`} className="max-h-64 overflow-y-auto py-1">
            {visible.length === 0 ? (
              <div className="px-4 py-3 text-sm text-stone-400">No matches</div>
            ) : (
              visible.map((o, index) => {
                const isSelected = o.value === value;
                return (
                  <button
                    key={o.value}
                    id={`${selectId}-option-${index}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => choose(o.value)}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold/40 ${
                      index === highlightedIndex ? "bg-stone-50" : ""
                    } ${
                      isSelected ? "text-[var(--ink)] font-semibold" : "text-stone-700"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{o.label}</span>
                      {o.hint && <span className="block text-xs text-stone-400 truncate">{o.hint}</span>}
                    </span>
                    {isSelected && <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-[var(--ink)]">check</span>}
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

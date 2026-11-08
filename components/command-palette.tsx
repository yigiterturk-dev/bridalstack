"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { buildCommands, filterCommands, type NavGroup } from "@/lib/command-search";
import { searchBrides, type BrideHit } from "@/app/(dashboard)/command-actions";

export const OPEN_PALETTE_EVENT = "bs:open-command-palette";

type Row = { key: string; href: string; label: string; icon: string; hint?: string; group: string };

function weddingHint(eventDate: string | null): string | undefined {
  if (!eventDate) return undefined;
  const days = Math.round((Date.parse(eventDate) - Date.parse(new Date().toISOString().slice(0, 10))) / 86400000);
  if (Number.isNaN(days)) return undefined;
  if (days === 0) return "Wedding today";
  if (days > 0) return `Wedding in ${days} day${days === 1 ? "" : "s"}`;
  return "Married";
}

export default function CommandPalette({ groups }: { groups: NavGroup[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [brides, setBrides] = useState<BrideHit[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { actions, pages } = useMemo(() => buildCommands(groups), [groups]);

  // Her açılış temiz başlar: boş sorgu, ilk satır seçili.
  function show() {
    setQuery("");
    setBrides([]);
    setActive(0);
    setOpen(true);
  }

  // ⌘K / Ctrl+K her yerden açar/kapatır; kenar çubuğundaki düğme olayla açar.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        // Açılışta da kapanışta da sıfırlamak zararsız; böylece ref gerekmez.
        setQuery("");
        setBrides([]);
        setActive(0);
        setOpen((v) => !v);
      }
    }
    const onOpen = () => show();
    document.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
    };
  }, []);

  // Gelin araması yazmayı bekler (200 ms); eski cevap yenisinin üstüne yazmaz.
  useEffect(() => {
    if (!open || query.trim().length < 2) return;
    let stale = false;
    const t = setTimeout(() => {
      searchBrides(query)
        .then((hits) => { if (!stale) setBrides(hits); })
        .catch(() => { if (!stale) setBrides([]); });
    }, 200);
    return () => { stale = true; clearTimeout(t); };
  }, [query, open]);

  const rows: Row[] = useMemo(() => {
    const visibleBrides = query.trim().length >= 2 ? brides : [];
    const brideRows: Row[] = visibleBrides.map((b) => ({
      key: `b-${b.id}`, href: `/customers/${b.id}`, label: b.name, icon: "favorite", hint: weddingHint(b.event_date), group: "Brides",
    }));
    const actionRows: Row[] = filterCommands(query, actions).map((a) => ({ key: `a-${a.href}`, href: a.href, label: a.label, icon: a.icon, group: "Do" }));
    const pageRows: Row[] = filterCommands(query, pages).map((p) => ({ key: `p-${p.href}`, href: p.href, label: p.label, icon: p.icon, hint: p.section, group: "Go to" }));
    return [...brideRows, ...actionRows, ...pageRows];
  }, [brides, actions, pages, query]);

  // Liste kısalınca seçim taşmasın: render sırasında sınırla, state'e yazma.
  const current = Math.min(active, Math.max(rows.length - 1, 0));

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${current}"]`)?.scrollIntoView({ block: "nearest" });
  }, [current]);

  function go(row: Row | undefined) {
    if (!row) return;
    setOpen(false);
    router.push(row.href);
  }

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(rows.length ? (current + 1) % rows.length : 0); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(rows.length ? (current - 1 + rows.length) % rows.length : 0); }
    else if (e.key === "Enter") { e.preventDefault(); go(rows[current]); }
    else if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
  }

  if (!open) return null;

  let lastGroup = "";
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]">
      <button aria-label="Close search" className="absolute inset-0 bg-[var(--ink)]/20 cursor-default" onClick={() => setOpen(false)} />
      <div role="dialog" aria-modal="true" aria-label="Search" className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-[0_24px_60px_-20px_rgba(28,26,35,0.35)]">
        <div className="flex items-center gap-3 border-b border-[var(--line)] px-4">
          <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-[var(--muted)]">search</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            onKeyDown={onInputKey}
            placeholder="Find a bride, or type what you want to do"
            aria-label="Search"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-list"
            aria-activedescendant={rows[current] ? `cmd-${current}` : undefined}
            autoFocus
            className="h-14 w-full bg-transparent text-[15px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
          />
          <kbd className="hidden sm:inline rounded-md border border-[var(--line)] px-1.5 py-0.5 text-[11px] text-[var(--muted)]">esc</kbd>
        </div>
        <div ref={listRef} id="command-list" role="listbox" className="max-h-[60vh] overflow-y-auto p-2">
          {rows.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-[var(--muted)]">
              Nothing found for “{query}”. Try a bride’s name or phone number.
            </p>
          ) : (
            rows.map((row, i) => {
              const header = row.group !== lastGroup ? row.group : null;
              lastGroup = row.group;
              const isActive = i === current;
              return (
                <div key={row.key}>
                  {header && <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">{header}</p>}
                  <button
                    id={`cmd-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={isActive}
                    onMouseMove={() => setActive(i)}
                    onClick={() => go(row)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm ${isActive ? "bg-gold-soft text-[var(--ink)]" : "text-[var(--ink-soft)]"}`}
                  >
                    <span aria-hidden="true" className={`material-symbols-outlined text-[18px] ${isActive ? "text-gold" : "text-[var(--muted)]"}`}>{row.icon}</span>
                    <span className="flex-1 truncate">{row.label}</span>
                    {row.hint && <span className="shrink-0 text-xs text-[var(--muted)]">{row.hint}</span>}
                  </button>
                </div>
              );
            })
          )}
        </div>
        <div className="hidden sm:flex items-center gap-4 border-t border-[var(--line)] px-4 py-2.5 text-[11px] text-[var(--muted)]">
          <span>↑↓ move</span><span>↵ open</span><span>⌘K anywhere</span>
        </div>
      </div>
    </div>
  );
}

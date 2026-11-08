"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { switchTenant } from "@/app/(dashboard)/locations/actions";
import { OPEN_PALETTE_EVENT } from "@/components/command-palette";
import { saveNavPins } from "@/app/(dashboard)/menu/actions";

type NavItem = { href: string; label: string; icon: string };
type NavGroup = { section?: string; items: NavItem[] };

function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-extrabold tracking-tight ${className}`}>
      Bridal<span className="text-transparent bg-clip-text bg-gradient-to-r from-gold to-gold">Stack</span>
    </span>
  );
}

export default function Sidebar({
  groups,
  tenantName,
  locations = [],
  activeTenantId,
  isDemo = false,
}: {
  groups: NavGroup[];
  tenantName: string;
  locations?: { id: string; name: string }[];
  activeTenantId?: string;
  isDemo?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<number, boolean>>({});
  const [editing, setEditing] = useState(false);
  const [saving, startSaving] = useTransition();
  // Ana listedeki sayfalar (Today sabit, sayılmaz).
  const pins = (groups[0]?.items ?? []).filter((n) => n.href !== "/dashboard").map((n) => n.href);

  function moveUp(href: string) {
    const i = pins.indexOf(href);
    if (i <= 0) return;
    const next = [...pins];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    startSaving(() => saveNavPins(next));
  }

  function togglePin(href: string) {
    const next = pins.includes(href) ? pins.filter((h) => h !== href) : [...pins, href];
    startSaving(() => saveNavPins(next));
  }

  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  function openPalette() {
    setOpen(false);
    window.dispatchEvent(new Event(OPEN_PALETTE_EVENT));
  }

  const nav = (
    <>
      <div className="px-6 py-6 border-b border-stone-100 flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="text-xl text-[var(--ink)]">
            <Wordmark />
          </h1>
          <p className="text-xs font-semibold tracking-wider text-stone-400 uppercase mt-1 truncate">{tenantName}</p>
          {locations.length > 1 ? (
            <form action={switchTenant} className="mt-2">
              <label htmlFor="tenant-switch" className="sr-only">Switch location</label>
              <select
                id="tenant-switch"
                name="tenantId"
                defaultValue={activeTenantId}
                onChange={(event) => event.currentTarget.form?.requestSubmit()}
                className="max-w-[190px] rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-xs font-medium text-stone-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
              >
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>{location.name}</option>
                ))}
              </select>
            </form>
          ) : null}
          <Link href="/locations" className="mt-1 inline-block text-[11px] font-medium text-stone-400 hover:text-gold">
            {isDemo ? "Locations" : locations.length > 1 ? "Manage locations" : "Add a location"}
          </Link>
        </div>
        <button onClick={() => setOpen(false)} className="lg:hidden text-stone-400 hover:text-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 focus-visible:ring-offset-2 rounded-lg" aria-label="Close menu">
          <span aria-hidden="true" className="material-symbols-outlined">close</span>
        </button>
      </div>

      <div className="px-4 pt-5">
        <button
          onClick={openPalette}
          className="flex w-full items-center gap-2.5 rounded-xl border border-[var(--line)] bg-white px-3.5 py-2 text-[13.5px] text-[var(--muted)] hover:border-stone-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">search</span>
          <span className="flex-1 text-left">Search</span>
          <kbd className="rounded-md border border-[var(--line)] px-1.5 text-[11px]">⌘K</kbd>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-6 px-4">
        {groups.map((group, gi) => {
          const groupHasActive = group.items.some((item) => pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href)));
          // Ana liste her zaman açık; diğer gruplar kapalı başlar, içindeki sayfadaysan açılır.
          const groupCollapsed = Boolean(group.section && !editing && !expandedGroups[gi] && !groupHasActive);
          return (
          <div key={gi} className={gi === 1 ? "mt-6 pt-5 border-t border-stone-100" : gi > 1 ? "mt-1" : ""}>
            {group.section && (
              <button
                type="button"
                onClick={() => setExpandedGroups((current) => ({ ...current, [gi]: groupCollapsed }))}
                aria-expanded={!groupCollapsed}
                aria-controls={`nav-group-${gi}`}
                className="w-full flex items-center justify-between px-3.5 py-2 text-[13px] font-medium text-stone-400 hover:text-stone-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 focus-visible:ring-offset-2 rounded"
              >
                {group.section}
                <span aria-hidden="true" className="material-symbols-outlined text-[16px]">{groupCollapsed ? "chevron_right" : "expand_more"}</span>
              </button>
            )}
            <div id={`nav-group-${gi}`} className={`flex flex-col gap-0.5 ${group.section ? "mb-2" : ""} ${groupCollapsed ? "hidden" : ""}`}>
              {group.items.map((item) => {
                const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                if (editing) {
                  const pinned = gi === 0;
                  const fixed = item.href === "/dashboard";
                  return (
                    <div key={item.href} className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-[13.5px] font-medium text-[var(--ink)]">
                      <span aria-hidden="true" className="material-symbols-outlined w-5 shrink-0 text-center text-[20px] leading-none text-stone-400">{item.icon}</span>
                      <span className="flex-1 truncate">{item.label}</span>
                      {pinned && !fixed && pins.indexOf(item.href) > 0 && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => moveUp(item.href)}
                          aria-label={`Move ${item.label} up`}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-[var(--ink)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
                        >
                          <span aria-hidden="true" className="material-symbols-outlined text-[18px] leading-none">arrow_upward</span>
                        </button>
                      )}
                      {!fixed && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => togglePin(item.href)}
                          aria-label={pinned ? `Remove ${item.label} from menu` : `Add ${item.label} to menu`}
                          className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 ${
                            pinned ? "border-stone-200 text-stone-500 hover:border-late hover:text-late" : "border-gold/40 bg-gold-soft text-gold hover:bg-gold hover:text-white"
                          }`}
                        >
                          <span aria-hidden="true" className="material-symbols-outlined text-[18px] leading-none">{pinned ? "remove" : "add"}</span>
                        </button>
                      )}
                    </div>
                  );
                }
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`group relative flex items-center gap-3 px-3.5 py-2 rounded-xl text-[13.5px] font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 focus-visible:ring-offset-2 ${
                      active
                        ? "bg-gold-soft text-[var(--ink)] border border-transparent"
                        : "text-[var(--muted)] hover:text-[var(--ink)] hover:bg-stone-50 border border-transparent"
                    }`}
                  >
                    {active && <span aria-hidden="true" className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-gold" />}
                    <span aria-hidden="true" className={`material-symbols-outlined w-5 shrink-0 text-center text-[20px] leading-none ${active ? "text-gold" : "text-stone-400 group-hover:text-stone-600"}`}>
                      {item.icon}
                    </span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
            {gi === 0 && (
              <button
                type="button"
                onClick={() => setEditing((v) => !v)}
                className={`mt-2 flex w-full items-center gap-3 px-3.5 py-2 rounded-xl text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 ${
                  editing ? "bg-[var(--ink)] text-white hover:bg-stone-800" : "text-stone-400 hover:text-[var(--ink)] hover:bg-stone-50"
                }`}
              >
                <span aria-hidden="true" className="material-symbols-outlined w-5 shrink-0 text-center text-[18px] leading-none">{editing ? "check" : "tune"}</span>
                {editing ? "Done" : "Edit menu"}
              </button>
            )}
            {gi === 0 && editing && (
              <p className="px-3.5 pt-3 text-[12px] leading-snug text-[var(--muted)]">Tap + to add a page, − to take it out, ↑ to move it up.</p>
            )}
          </div>
          );
        })}
      </nav>

      <div className="px-4 py-3 border-t border-stone-100">
        <Link
          href="/settings"
          onClick={() => setOpen(false)}
          className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-[13.5px] font-medium text-[var(--muted)] hover:text-[var(--ink)] hover:bg-stone-50 border border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 focus-visible:ring-offset-2"
        >
          <span aria-hidden="true" className="material-symbols-outlined w-5 shrink-0 text-center text-[20px] leading-none text-stone-400">settings</span>
          Settings
        </Link>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-stone-100 flex items-center justify-between px-5 z-50">
        <button onClick={() => setOpen(true)} aria-expanded={open} aria-controls="dashboard-sidebar" className="text-stone-700 -ml-1 p-2 hover:bg-stone-50 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 focus-visible:ring-offset-2" aria-label="Open menu">
          <span aria-hidden="true" className="material-symbols-outlined">menu</span>
        </button>
        <h1 className="text-lg text-[var(--ink)]"><Wordmark /></h1>
        <button onClick={openPalette} className="text-stone-700 -mr-1 p-2 hover:bg-stone-50 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40" aria-label="Search">
          <span aria-hidden="true" className="material-symbols-outlined">search</span>
        </button>
      </div>

      {/* Mobile overlay */}
      {open && (
        <button
          type="button"
          className="lg:hidden fixed inset-0 bg-stone-900/20 z-40 transition-opacity cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
        />
      )}

      {/* Sidebar */}
      <aside
        id="dashboard-sidebar"
        className={`fixed inset-y-0 left-0 w-[280px] bg-[#FDFCFB]/95 border-r border-stone-100 text-[var(--ink)] flex flex-col z-50 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] lg:translate-x-0 ${
          open ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        {nav}
      </aside>
    </>
  );
}

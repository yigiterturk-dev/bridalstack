"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { switchTenant } from "@/app/(dashboard)/locations/actions";

type NavItem = { href: string; label: string; icon: string };
type NavGroup = { section?: string; items: NavItem[] };

function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-extrabold tracking-tight ${className}`}>
      Bridal<span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-amber-500">Stack</span>
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
  const [collapsedGroups, setCollapsedGroups] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  const nav = (
    <>
      <div className="px-6 py-6 border-b border-stone-100 flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="text-xl text-stone-900">
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
                className="max-w-[190px] rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-xs font-medium text-stone-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              >
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>{location.name}</option>
                ))}
              </select>
            </form>
          ) : null}
          <Link href="/locations" className="mt-1 inline-block text-[11px] font-medium text-stone-400 hover:text-rose-600">
            {isDemo ? "Locations" : locations.length > 1 ? "Manage locations" : "Add a location"}
          </Link>
        </div>
        <button onClick={() => setOpen(false)} className="lg:hidden text-stone-400 hover:text-rose-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 rounded-lg" aria-label="Close menu">
          <span aria-hidden="true" className="material-symbols-outlined">close</span>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-6 px-4">
        {groups.map((group, gi) => {
          const groupHasActive = group.items.some((item) => pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href)));
          const groupCollapsed = Boolean(group.section && collapsedGroups[gi] && !groupHasActive);
          return (
          <div key={gi} className={gi > 0 ? "mt-8" : ""}>
            {group.section && (
              <button
                type="button"
                onClick={() => setCollapsedGroups((current) => ({ ...current, [gi]: !current[gi] }))}
                aria-expanded={!groupCollapsed}
                aria-controls={`nav-group-${gi}`}
                className="w-full flex items-center justify-between px-4 mb-3 text-[11px] font-bold uppercase tracking-[0.15em] text-stone-400 hover:text-stone-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 rounded"
              >
                {group.section}
                <span aria-hidden="true" className="material-symbols-outlined text-[16px]">{groupCollapsed ? "chevron_right" : "expand_more"}</span>
              </button>
            )}
            <div id={`nav-group-${gi}`} className={`flex flex-col gap-1 ${groupCollapsed ? "hidden" : ""}`}>
              {group.items.map((item) => {
                const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`group relative flex items-center gap-3.5 px-4 py-2.5 rounded-2xl text-[14px] font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 ${
                      active
                        ? "bg-rose-50/80 text-rose-700 shadow-sm border border-rose-100/50"
                        : "text-stone-500 hover:text-stone-900 hover:bg-stone-50 border border-transparent"
                    }`}
                  >
                    {active && <span aria-hidden="true" className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.8)]" />}
                    <span aria-hidden="true" className={`material-symbols-outlined text-[20px] transition-transform duration-300 ${active ? "text-rose-500 scale-110" : "text-stone-400 group-hover:text-stone-600 group-hover:scale-110"}`}>
                      {item.icon}
                    </span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-stone-100 bg-stone-50/50">
        <Link
          href="/settings"
          onClick={() => setOpen(false)}
          className="flex items-center gap-3.5 px-4 py-3 rounded-2xl text-[14px] font-medium text-stone-500 hover:text-stone-900 hover:bg-white hover:shadow-sm border border-transparent hover:border-stone-200 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-stone-400">settings</span>
          Settings
        </Link>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-xl border-b border-stone-100 flex items-center justify-between px-5 z-50">
        <button onClick={() => setOpen(true)} aria-expanded={open} aria-controls="dashboard-sidebar" className="text-stone-700 -ml-1 p-2 hover:bg-stone-50 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2" aria-label="Open menu">
          <span aria-hidden="true" className="material-symbols-outlined">menu</span>
        </button>
        <h1 className="text-lg text-stone-900"><Wordmark /></h1>
        <div className="w-8" />
      </div>

      {/* Mobile overlay */}
      {open && (
        <button
          type="button"
          className="lg:hidden fixed inset-0 bg-stone-900/20 backdrop-blur-sm z-40 transition-opacity cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
        />
      )}

      {/* Sidebar */}
      <aside
        id="dashboard-sidebar"
        className={`fixed inset-y-0 left-0 w-[280px] bg-[#FDFCFB]/95 backdrop-blur-2xl border-r border-stone-100 text-stone-900 flex flex-col z-50 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] lg:translate-x-0 ${
          open ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        {nav}
      </aside>
    </>
  );
}

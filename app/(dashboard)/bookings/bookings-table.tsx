"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateBookingStatus } from "./actions";
import { formatPrice } from "@/config/modules";
import PageHead from "@/components/page-head";

type Booking = {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
  notes: string | null;
  amount: number;
  services: { name: string } | null;
  tenant_members: { display_name: string } | null;
};

export default function BookingsTable({ bookings }: { bookings: Booking[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  async function updateStatus(id: string, newStatus: string) {
    setUpdatingId(id);
    setActionError("");
    try {
      const res = await updateBookingStatus(id, newStatus);
      if (!res.ok) throw new Error(res.error);
      // Sunucudan tazele; yerel kopyayı elle güncellemekten daha güvenilir.
      startTransition(() => router.refresh());
    } catch (err) {
      console.error("Error updating status:", err);
      setActionError(err instanceof Error ? err.message : "Could not update the booking. Please try again.");
    } finally {
      setUpdatingId(null);
    }
  }

  const filtered = bookings.filter((b) => {
    const matchesSearch =
      b.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      (b.customer_email && b.customer_email.toLowerCase().includes(search.toLowerCase())) ||
      (b.customer_phone && b.customer_phone.includes(search)) ||
      (b.services?.name && b.services.name.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = statusFilter === "all" || b.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: bookings.length,
    pending: bookings.filter((b) => b.status === "pending").length,
    confirmed: bookings.filter((b) => b.status === "confirmed").length,
    completed: bookings.filter((b) => b.status === "completed").length,
    cancelled: bookings.filter((b) => b.status === "cancelled").length,
  };

  const dot: Record<Booking["status"], string> = {
    pending: "bg-amber",
    confirmed: "bg-gold",
    completed: "bg-[var(--line)]",
    cancelled: "bg-[var(--line)]",
    no_show: "bg-late",
  };
  const label = (st: string) => {
    const t = st.replace("_", " ");
    return t.charAt(0).toUpperCase() + t.slice(1);
  };
  const busy = (id: string) => updatingId === id || pending;
  const BTN_SMALL_PRIMARY = "rounded-lg bg-[var(--ink)] px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50";
  const BTN_SMALL = "rounded-lg border border-[var(--line)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--ink)] hover:border-stone-300 disabled:opacity-50";

  return (
    <div>
      <PageHead
        title="Bookings"
        sub={
          stats.total === 0
            ? "Online bookings from your booking page land here"
            : `${stats.pending} waiting for you · ${stats.confirmed} confirmed · ${stats.completed} done${stats.cancelled ? ` · ${stats.cancelled} cancelled` : ""}`
        }
      />

      {actionError && (
        <div role="alert" aria-live="assertive" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-late">
          {actionError}
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <input
          type="text"
          aria-label="Search bookings"
          placeholder="Search by customer or service…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-[var(--ink)] outline-none transition-colors focus:border-stone-400 md:w-72"
        />
        <div className="flex flex-wrap gap-2">
          {["all", "pending", "confirmed", "completed", "cancelled", "no_show"].map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setStatusFilter(filter)}
              aria-pressed={statusFilter === filter}
              className={`rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === filter
                  ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                  : "border-[var(--line)] bg-white text-[var(--ink)] hover:border-stone-300"
              }`}
            >
              {label(filter)}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-[var(--line)] bg-white py-16 text-center text-sm text-[var(--muted)]">
          {bookings.length === 0 ? "No bookings yet." : "No bookings match this search."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white divide-y divide-[var(--line)]">
          {filtered.map((b) => {
            const day = new Date(b.booking_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
            const contact = [b.customer_phone, b.customer_email].filter(Boolean).join(" · ");
            return (
              <div key={b.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${dot[b.status]}`} />
                    <span className="truncate font-medium text-[var(--ink)]">{b.customer_name}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-[var(--muted)]">
                    {day}, {b.start_time.slice(0, 5)}–{b.end_time.slice(0, 5)} · {b.services?.name ?? "Custom service"} with{" "}
                    {b.tenant_members?.display_name ?? "anyone"} · {label(b.status)}
                  </p>
                  {(contact || b.notes) && (
                    <p className="mt-0.5 text-sm text-[var(--muted)]">
                      {contact}
                      {contact && b.notes ? " · " : ""}
                      {b.notes && <span className="italic">“{b.notes}”</span>}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="font-serif text-lg tabular-nums text-[var(--ink)]">{formatPrice(b.amount)}</div>
                  {b.status === "pending" && (
                    <>
                      <button type="button" disabled={busy(b.id)} onClick={() => updateStatus(b.id, "confirmed")} className={BTN_SMALL_PRIMARY}>Approve</button>
                      <button type="button" disabled={busy(b.id)} onClick={() => updateStatus(b.id, "cancelled")} className={BTN_SMALL}>Decline</button>
                    </>
                  )}
                  {b.status === "confirmed" && (
                    <>
                      <button type="button" disabled={busy(b.id)} onClick={() => updateStatus(b.id, "completed")} className={BTN_SMALL_PRIMARY}>Complete</button>
                      <button type="button" disabled={busy(b.id)} onClick={() => updateStatus(b.id, "cancelled")} className={BTN_SMALL}>Cancel</button>
                    </>
                  )}
                  {b.status === "cancelled" && (
                    <button type="button" disabled={busy(b.id)} onClick={() => updateStatus(b.id, "confirmed")} className={BTN_SMALL}>Reconfirm</button>
                  )}
                  {updatingId === b.id && <span className="text-sm text-[var(--muted)]">Saving…</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

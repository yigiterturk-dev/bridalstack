"use client";

import { useEffect, useState } from "react";
import { listBookings, updateBookingStatus } from "./actions";

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

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    fetchBookings();
  }, []);

  async function fetchBookings() {
    setLoading(true);
    try {
      const data = await listBookings();
      setBookings(data as Booking[]);
    } catch (err) {
      console.error("Error fetching bookings:", err);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: string, newStatus: string) {
    setUpdatingId(id);
    try {
      const res = await updateBookingStatus(id, newStatus);
      if (!res.ok) throw new Error(res.error);
      setBookings((prev) =>
        prev.map((b) => (b.id === id ? { ...b, status: newStatus as any } : b))
      );
    } catch (err) {
      console.error("Error updating status:", err);
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

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Bookings</h1>
          <p className="text-sm text-gray-500 mt-1">Manage client online appointment bookings and statuses.</p>
        </div>
      </div>

      {/* Stats Widget */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-200">
          <div className="text-xs font-semibold text-gray-400 uppercase">Total Bookings</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-200">
          <div className="text-xs font-semibold uppercase text-amber-600">Awaiting Approval</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">{stats.pending}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-200">
          <div className="text-xs font-semibold text-gray-400 uppercase text-rose-600">Confirmed</div>
          <div className="text-2xl font-bold text-rose-600 mt-1">{stats.confirmed}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-200">
          <div className="text-xs font-semibold text-gray-400 uppercase text-emerald-600">Completed</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{stats.completed}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-200">
          <div className="text-xs font-semibold text-gray-400 uppercase text-gray-500">Cancelled</div>
          <div className="text-2xl font-bold text-gray-500 mt-1">{stats.cancelled}</div>
        </div>
      </div>

      {/* Filters bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="w-full md:w-72 relative">
          <input
            type="text"
            placeholder="Search by customer or service..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 bg-gray-50 border border-gray-250 rounded-xl text-sm outline-none focus:border-rose-500 focus:bg-white transition-all"
          />
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          {["all", "pending", "confirmed", "completed", "cancelled", "no_show"].map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize border transition-all ${
                statusFilter === filter
                  ? "bg-rose-50 border-rose-200 text-rose-700"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {filter.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Bookings List */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-sm text-gray-400 flex items-center justify-center gap-2">
            <span className="animate-spin border-2 border-rose-500 border-t-transparent w-5 h-5 rounded-full" />
            Loading bookings...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-sm text-gray-400">
            No bookings found matching filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-400 uppercase">
                  <th className="p-4">Customer</th>
                  <th className="p-4">Service & Staff</th>
                  <th className="p-4">Date & Time</th>
                  <th className="p-4">Price</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-4">
                      <div className="font-semibold text-gray-900">{b.customer_name}</div>
                      <div className="text-xs text-gray-450 mt-0.5">
                        {b.customer_phone && <span>{b.customer_phone}</span>}
                        {b.customer_phone && b.customer_email && <span> · </span>}
                        {b.customer_email && <span>{b.customer_email}</span>}
                      </div>
                      {b.notes && (
                        <div className="text-xs text-amber-600 mt-1 bg-amber-50/60 border border-amber-100 rounded-lg px-2.5 py-1 inline-block">
                          📝 {b.notes}
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-gray-800">{b.services?.name ?? "Custom Service"}</div>
                      <div className="text-xs text-gray-400 mt-0.5">with {b.tenant_members?.display_name ?? "Anyone"}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-gray-800">
                        {new Date(b.booking_date + "T12:00:00").toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {b.start_time.slice(0, 5)} – {b.end_time.slice(0, 5)}
                      </div>
                    </td>
                    <td className="p-4 font-semibold text-gray-900">${b.amount}</td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase border ${
                          b.status === "pending"
                            ? "bg-amber-50 border-amber-100 text-amber-700"
                            : b.status === "confirmed"
                            ? "bg-rose-50 border-rose-100 text-rose-700"
                            : b.status === "completed"
                            ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                            : b.status === "cancelled"
                            ? "bg-gray-50 border-gray-200 text-gray-500"
                            : "bg-red-50 border-red-100 text-red-700"
                        }`}
                      >
                        {b.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      {updatingId === b.id ? (
                        <span className="text-xs text-gray-450 italic">Saving...</span>
                      ) : (
                        <div className="flex gap-2 justify-end">
                          {b.status === "pending" && (
                            <>
                              <button
                                onClick={() => updateStatus(b.id, "confirmed")}
                                className="px-2 py-1 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-xs font-semibold transition-colors"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => updateStatus(b.id, "cancelled")}
                                className="px-2 py-1 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-lg text-xs font-semibold transition-colors"
                              >
                                Decline
                              </button>
                            </>
                          )}
                          {b.status === "confirmed" && (
                            <>
                              <button
                                onClick={() => updateStatus(b.id, "completed")}
                                className="px-2 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold transition-colors"
                              >
                                Complete
                              </button>
                              <button
                                onClick={() => updateStatus(b.id, "cancelled")}
                                className="px-2 py-1 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-lg text-xs font-semibold transition-colors"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                          {b.status === "cancelled" && (
                            <button
                              onClick={() => updateStatus(b.id, "confirmed")}
                              className="px-2 py-1 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-xs font-semibold transition-colors"
                            >
                              Reconfirm
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

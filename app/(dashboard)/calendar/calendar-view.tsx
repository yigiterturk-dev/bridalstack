"use client";

import { useRouter } from "next/navigation";
import { countOut, sortDayEvents, type CalendarEvent } from "@/lib/calendar-events";

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-400", confirmed: "bg-blue-400", completed: "bg-emerald-400", cancelled: "bg-red-300",
};

// Çıkış aşağı ok değil yukarı: elbise dükkândan ÇIKIYOR. Dönüş tersi.
const ROLE_ICON: Record<string, string> = { pickup: "arrow_upward", due: "arrow_downward" };

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function CalendarView({
  events,
  rentalDays = {},
  year,
  month,
}: {
  events: CalendarEvent[];
  rentalDays?: Record<number, CalendarEvent[]>;
  year: number;
  month: number;
}) {
  const router = useRouter();

  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const daysInMonth = lastDay.getDate();
  const startDow = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

  const today = new Date();
  const isToday = (d: number) => today.getFullYear() === year && today.getMonth() === month - 1 && today.getDate() === d;

  const prevMonth = month === 1 ? `${year - 1}-12` : `${year}-${month - 1}`;
  const nextMonth = month === 12 ? `${year + 1}-1` : `${year}-${month + 1}`;

  const eventsByDay: Record<number, CalendarEvent[]> = {};
  for (const e of events) {
    const d = new Date(e.date).getDate();
    if (!eventsByDay[d]) eventsByDay[d] = [];
    eventsByDay[d].push(e);
  }
  for (const [day, rentals] of Object.entries(rentalDays)) {
    const d = Number(day);
    eventsByDay[d] = sortDayEvents([...(eventsByDay[d] ?? []), ...rentals]);
  }

  const hasRentals = Object.keys(rentalDays).length > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-serif font-normal text-gray-900">{MONTHS[month - 1]} {year}</h1>
        <div className="flex gap-2 items-center">
          <div className="flex rounded-xl border border-gray-200 overflow-hidden mr-1">
            <button className="px-3 h-9 text-sm font-semibold bg-gray-900 text-white">Month</button>
            <button
              onClick={() => router.push("/calendar?view=week")}
              className="px-3 h-9 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Week
            </button>
          </div>
          <button onClick={() => router.push(`/calendar?month=${prevMonth}`)} className="w-9 h-9 inline-flex items-center justify-center rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors" aria-label="Previous month"><span className="material-symbols-outlined text-lg">chevron_left</span></button>
          <button onClick={() => router.push(`/calendar?month=${today.getFullYear()}-${today.getMonth() + 1}`)} className="px-3.5 h-9 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Today</button>
          <button onClick={() => router.push(`/calendar?month=${nextMonth}`)} className="w-9 h-9 inline-flex items-center justify-center rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors" aria-label="Next month"><span className="material-symbols-outlined text-lg">chevron_right</span></button>
        </div>
      </div>

      {hasRentals && (
        <div className="flex items-center gap-4 mb-3 text-[11px] text-gray-400 flex-wrap">
          <span className="inline-flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px] text-violet-500">arrow_upward</span>
            gown picked up
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px] text-violet-500">arrow_downward</span>
            due back
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            overdue
          </span>
          <span>&ldquo;N out&rdquo; = gowns already with a bride that day</span>
        </div>
      )}

      <div className="bs-card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/50">
          {DAYS.map((d) => (
            <div key={d} className="px-2 py-3 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: startDow }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[104px] border-b border-r border-gray-50 bg-gray-50/40" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dayEvents = eventsByDay[day] ?? [];
            const outCount = countOut(dayEvents);
            const actionable = dayEvents.filter((e) => !(e.kind === "rental" && e.role === "out"));
            return (
              <div key={day} className={`min-h-[104px] border-b border-r border-gray-50 p-1.5 transition-colors ${isToday(day) ? "bg-[var(--accent-soft)]/60" : "hover:bg-gray-50/40"}`}>
                <div className={`text-xs mb-1 inline-flex items-center justify-center min-w-5 h-5 rounded-full px-1 ${isToday(day) ? "bg-[var(--accent)] text-white font-semibold" : "text-gray-500 font-medium"}`}>{day}</div>
                <div className="flex flex-col gap-0.5">
                  {/* "Sadece dışarıda" satırları hücreyi doldurmasın: tek sayıya iner. */}
                  {actionable.slice(0, 3).map((e) => {
                    if (e.kind === "rental") {
                      return (
                        <div
                          key={e.id}
                          className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] truncate ${
                            e.late ? "bg-red-50 text-red-700" : "bg-violet-50 text-violet-700"
                          }`}
                          title={`${e.role === "pickup" ? "Picks up" : "Due back"}: ${e.customerName} — ${e.title}`}
                        >
                          <span className="material-symbols-outlined text-[11px] leading-none flex-shrink-0">
                            {ROLE_ICON[e.role ?? "due"]}
                          </span>
                          <span className="truncate">{e.customerName || e.title}</span>
                        </div>
                      );
                    }
                    const time = new Date(e.date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
                    return (
                      <div key={e.id} className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] bg-gray-100/80 truncate" title={`${e.customerName} — ${e.title}`}>
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_COLOR[e.status] ?? STATUS_COLOR.pending}`} />
                        <span className="truncate text-gray-700">{time} {e.customerName}</span>
                      </div>
                    );
                  })}
                  {actionable.length > 3 && (
                    <div className="text-[10px] text-gray-400 px-1.5">+{actionable.length - 3} more</div>
                  )}
                  {outCount > 0 && (
                    <div className="text-[10px] text-violet-400 px-1.5" title={`${outCount} gown${outCount === 1 ? "" : "s"} out on loan`}>
                      {outCount} out
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

type Event = { id: string; title: string; customerName: string; date: string; status: string };

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-400", confirmed: "bg-blue-400", completed: "bg-emerald-400", cancelled: "bg-red-300",
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function CalendarView({ events, year, month }: { events: Event[]; year: number; month: number }) {
  const router = useRouter();

  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const daysInMonth = lastDay.getDate();
  const startDow = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

  const today = new Date();
  const isToday = (d: number) => today.getFullYear() === year && today.getMonth() === month - 1 && today.getDate() === d;

  const prevMonth = month === 1 ? `${year - 1}-12` : `${year}-${month - 1}`;
  const nextMonth = month === 12 ? `${year + 1}-1` : `${year}-${month + 1}`;

  const eventsByDay: Record<number, Event[]> = {};
  for (const e of events) {
    const d = new Date(e.date).getDate();
    if (!eventsByDay[d]) eventsByDay[d] = [];
    eventsByDay[d].push(e);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">{MONTHS[month - 1]} {year}</h1>
        <div className="flex gap-2">
          <button onClick={() => router.push(`/calendar?month=${prevMonth}`)} className="w-9 h-9 inline-flex items-center justify-center rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors" aria-label="Previous month"><span className="material-symbols-outlined text-lg">chevron_left</span></button>
          <button onClick={() => router.push(`/calendar?month=${today.getFullYear()}-${today.getMonth() + 1}`)} className="px-3.5 h-9 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Today</button>
          <button onClick={() => router.push(`/calendar?month=${nextMonth}`)} className="w-9 h-9 inline-flex items-center justify-center rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors" aria-label="Next month"><span className="material-symbols-outlined text-lg">chevron_right</span></button>
        </div>
      </div>

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
            return (
              <div key={day} className={`min-h-[104px] border-b border-r border-gray-50 p-1.5 transition-colors ${isToday(day) ? "bg-[var(--accent-soft)]/60" : "hover:bg-gray-50/40"}`}>
                <div className={`text-xs mb-1 inline-flex items-center justify-center min-w-5 h-5 rounded-full px-1 ${isToday(day) ? "bg-[var(--accent)] text-white font-semibold" : "text-gray-500 font-medium"}`}>{day}</div>
                <div className="flex flex-col gap-0.5">
                  {dayEvents.slice(0, 3).map((e) => {
                    const time = new Date(e.date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
                    return (
                      <div key={e.id} className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] bg-gray-100/80 truncate" title={`${e.customerName} — ${e.title}`}>
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_COLOR[e.status] ?? STATUS_COLOR.pending}`} />
                        <span className="truncate text-gray-700">{time} {e.customerName}</span>
                      </div>
                    );
                  })}
                  {dayEvents.length > 3 && (
                    <div className="text-[10px] text-gray-400 px-1.5">+{dayEvents.length - 3} daha</div>
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

"use client";

import { useRouter } from "next/navigation";
import {
  countOut,
  shiftWeek,
  sortDayEvents,
  weekDates,
  type CalendarEvent,
} from "@/lib/calendar-events";

/**
 * Haftalık görünüm.
 *
 * Ay görünümü hücreye üç satır sığdırıp gerisini "+2 more" diye saklıyor;
 * haftada yer var, o yüzden gün ne varsa TAMAMINI gösterir. Gelinlikçinin
 * "bu hafta ne çıkıyor, ne dönüyor" sorusu buradan cevaplanır.
 */

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-400", confirmed: "bg-blue-400", completed: "bg-emerald-400", cancelled: "bg-red-300",
};

const ROLE_ICON: Record<string, string> = { pickup: "arrow_upward", due: "arrow_downward" };
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Yerel tarihin ISO günü — randevu saatleri yerel okunur, UTC'ye kaydırmayız. */
function localDate(value: string): string {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CalendarWeekView({
  events,
  rentalDates = {},
  start,
  today,
}: {
  events: CalendarEvent[];
  rentalDates?: Record<string, CalendarEvent[]>;
  start: string;
  today: string;
}) {
  const router = useRouter();
  const dates = weekDates(start);

  const byDate: Record<string, CalendarEvent[]> = {};
  for (const e of events) {
    const key = localDate(e.date);
    (byDate[key] ??= []).push(e);
  }
  for (const [date, rentals] of Object.entries(rentalDates)) {
    byDate[date] = sortDayEvents([...(byDate[date] ?? []), ...rentals]);
  }

  const first = dates[0].split("-").map(Number);
  const last = dates[6].split("-").map(Number);
  const heading =
    first[1] === last[1]
      ? `${MONTHS[first[1] - 1]} ${first[2]}–${last[2]}, ${last[0]}`
      : `${MONTHS[first[1] - 1]} ${first[2]} – ${MONTHS[last[1] - 1]} ${last[2]}, ${last[0]}`;

  const go = (weekOf: string) => router.push(`/calendar?view=week&week=${weekOf}`);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h1 className="font-serif text-3xl font-normal text-[var(--ink)] lg:text-4xl">{heading}</h1>
        <div className="flex gap-2 items-center">
          <div className="flex rounded-xl border border-[var(--line)] overflow-hidden mr-1">
            <button
              onClick={() => router.push(`/calendar?month=${first[0]}-${first[1]}`)}
              className="px-3 h-9 text-sm font-medium text-[var(--muted)] hover:bg-stone-50 transition-colors"
            >
              Month
            </button>
            <button className="px-3 h-9 text-sm font-semibold bg-[var(--ink)] text-white">Week</button>
          </div>
          <button onClick={() => go(shiftWeek(start, -1))} className="w-9 h-9 inline-flex items-center justify-center rounded-xl border border-[var(--line)] text-[var(--muted)] hover:bg-stone-50 transition-colors" aria-label="Previous week"><span className="material-symbols-outlined text-lg">chevron_left</span></button>
          <button onClick={() => go(today)} className="px-3.5 h-9 rounded-xl border border-[var(--line)] text-sm font-medium text-[var(--ink)] hover:bg-stone-50 transition-colors">This week</button>
          <button onClick={() => go(shiftWeek(start, 1))} className="w-9 h-9 inline-flex items-center justify-center rounded-xl border border-[var(--line)] text-[var(--muted)] hover:bg-stone-50 transition-colors" aria-label="Next week"><span className="material-symbols-outlined text-lg">chevron_right</span></button>
        </div>
      </div>

      <div className="bs-card overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-7">
          {dates.map((date, i) => {
            const dayEvents = byDate[date] ?? [];
            const outCount = countOut(dayEvents);
            const actionable = dayEvents.filter((e) => !(e.kind === "rental" && e.role === "out"));
            const isToday = date === today;
            return (
              <div
                key={date}
                className={`min-h-[220px] border-b sm:border-r border-[var(--line)] p-2 ${isToday ? "bg-[var(--accent-soft)]/60" : ""}`}
              >
                <div className="flex items-baseline gap-1.5 mb-2">
                  <span className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider">{DAY_NAMES[i]}</span>
                  <span className={`text-xs inline-flex items-center justify-center min-w-5 h-5 rounded-full px-1 ${isToday ? "bg-[var(--accent)] text-white font-semibold" : "text-[var(--muted)] font-medium"}`}>
                    {Number(date.slice(8, 10))}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  {actionable.length === 0 && outCount === 0 && (
                    <span className="text-[11px] text-stone-300">—</span>
                  )}

                  {/* Haftada kırpma yok: günün işi tamamen görünür. */}
                  {actionable.map((e) => {
                    if (e.kind === "rental") {
                      return (
                        <div
                          key={e.id}
                          className={`flex items-start gap-1 px-1.5 py-1 rounded-md text-[11px] ${
                            e.late ? "bg-red-50 text-red-700" : "bg-violet-50 text-violet-700"
                          }`}
                          title={`${e.role === "pickup" ? "Picks up" : "Due back"}: ${e.customerName} — ${e.title}`}
                        >
                          <span className="material-symbols-outlined text-[12px] leading-4 flex-shrink-0">
                            {ROLE_ICON[e.role ?? "due"]}
                          </span>
                          <span className="leading-4 break-words">
                            {e.customerName || e.title}
                            <span className="block text-[10px] opacity-70">{e.title}</span>
                          </span>
                        </div>
                      );
                    }
                    const time = new Date(e.date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
                    return (
                      <div key={e.id} className="flex items-start gap-1 px-1.5 py-1 rounded-md text-[11px] bg-stone-100/80" title={`${e.customerName} — ${e.title}`}>
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${STATUS_COLOR[e.status] ?? STATUS_COLOR.pending}`} />
                        <span className="leading-4 text-[var(--ink)] break-words">
                          {time} {e.customerName}
                          <span className="block text-[10px] text-[var(--muted)]">{e.title}</span>
                        </span>
                      </div>
                    );
                  })}

                  {outCount > 0 && (
                    <div className="text-[11px] text-violet-400 px-1.5 pt-1" title={`${outCount} gown${outCount === 1 ? "" : "s"} out on loan`}>
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

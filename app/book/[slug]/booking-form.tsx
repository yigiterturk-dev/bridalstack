"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Image from "next/image";
import { formatPrice } from "@/config/modules";
import { isStaffUnavailable } from "@/lib/booking-validation";

type Service = { id: string; name: string; category: string | null; duration: number; price: number; price_max: number | null; description: string | null };
type Staff = { id: string; name: string; title: string | null; photo: string | null; serviceIds: string[] };
type Schedule = { memberId: string; dayOfWeek: number; startTime: string; endTime: string; breakStart: string | null; breakEnd: string | null; isOff: boolean };
type ExistingBooking = { memberId: string | null; bookingDate: string; startTime: string; endTime: string };
type TimeOff = { memberId: string; date: string };

type Props = {
  tenantId: string;
  accent: string;
  services: Service[];
  staff: Staff[];
  schedules: Schedule[];
  bookings: ExistingBooking[];
  timeOff: TimeOff[];
  minDate: string;
};

type Step = "service" | "staff" | "datetime" | "info" | "done";

function formatDuration(minutes: number) {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return `${hours}h${remainder ? ` ${remainder}m` : ""}`;
  }
  return `${minutes}m`;
}

export default function BookingForm({ tenantId, accent, services, staff, schedules, bookings, timeOff, minDate }: Props) {
  const [step, setStep] = useState<Step>("service");
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const selectedService = services.find((s) => s.id === serviceId);
  const selectedStaff = staff.find((s) => s.id === staffId);

  const availableStaff = useMemo(() => {
    if (!serviceId) return [];
    return staff.filter((s) => s.serviceIds.length === 0 || s.serviceIds.includes(serviceId));
  }, [serviceId, staff]);

  const availableSlots = useMemo(() => {
    if (!date || !selectedService) return [];
    const dayOfWeek = new Date(date + "T12:00:00").getDay();
    const eligibleStaffIds = new Set(availableStaff.map((member) => member.id));
    const memberSchedules = staffId
      ? schedules.filter((s) => s.memberId === staffId && !isStaffUnavailable(s.memberId, date, timeOff) && s.dayOfWeek === dayOfWeek && !s.isOff)
      : schedules.filter((s) => eligibleStaffIds.has(s.memberId) && !isStaffUnavailable(s.memberId, date, timeOff) && s.dayOfWeek === dayOfWeek && !s.isOff);

    if (memberSchedules.length === 0) return [];

    const slots: string[] = [];
    for (const sched of memberSchedules) {
      let [h, m] = sched.startTime.split(":").map(Number);
      const [endH, endM] = sched.endTime.split(":").map(Number);
      const endMinutes = endH * 60 + endM;
      const duration = selectedService.duration;

      while (h * 60 + m + duration <= endMinutes) {
        if (sched.breakStart && sched.breakEnd) {
          const [bh, bm] = sched.breakStart.split(":").map(Number);
          const [beh, bem] = sched.breakEnd.split(":").map(Number);
          const slotEnd = h * 60 + m + duration;
          const breakStart = bh * 60 + bm;
          const breakEnd = beh * 60 + bem;
          if (!(slotEnd <= breakStart || h * 60 + m >= breakEnd)) {
            m += 30;
            if (m >= 60) { h++; m -= 60; }
            continue;
          }
        }
        const label = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        const slotEnd = `${String(Math.floor((h * 60 + m + duration) / 60)).padStart(2, "0")}:${String((h * 60 + m + duration) % 60).padStart(2, "0")}`;
        // A booking without a preferred staff member occupies the time for
        // every eligible staff member. Keep the picker aligned with the API,
        // which rejects the same overlap at submission time.
        const isBooked = bookings.some((booking) =>
          booking.bookingDate === date &&
          (booking.memberId === sched.memberId || booking.memberId === null) &&
          booking.startTime < slotEnd && booking.endTime > label
        );
        if (!isBooked && !slots.includes(label)) slots.push(label);
        m += 30;
        if (m >= 60) { h++; m -= 60; }
      }
    }
    return slots.sort();
  }, [availableStaff, bookings, date, staffId, selectedService, schedules, timeOff]);

  const grouped = useMemo(() => {
    return services.reduce((acc, s) => {
      const cat = s.category || "Other";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(s);
      return acc;
    }, {} as Record<string, Service[]>);
  }, [services]);

  const hasPublishedAvailability = schedules.some((schedule) => !schedule.isOff);

  async function handleSubmit() {
    if (!serviceId || !date || !time) return;
    if (!name.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (!phone.trim() && !email.trim()) {
      setError("Please provide a phone number or email address.");
      return;
    }
    setSubmitting(true);
    setError("");

    const [h, m] = time.split(":").map(Number);
    const endMin = h * 60 + m + (selectedService?.duration ?? 30);
    const endTime = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;

    let res: Response;
    try {
      res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          service_id: serviceId,
          member_id: staffId,
          customer_name: name.trim(),
          customer_phone: phone.trim(),
          customer_email: email.trim(),
          booking_date: date,
          start_time: time,
          end_time: endTime,
          notes: notes.trim(),
          amount: selectedService?.price ?? 0,
        }),
      });
    } catch {
      setError("We couldn't reach the boutique. Check your connection and try again.");
      setSubmitting(false);
      return;
    }

    if (!res.ok) {
      let msg = "Something went wrong. Please try again.";
      try {
        const j = await res.json();
        if (j?.error) msg = j.error;
      } catch {}
      setError(msg);
      setSubmitting(false);
      return;
    }

    setStep("done");
    setSubmitting(false);
  }

  if (step === "done") {
    return (
      <div role="status" aria-live="polite" className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-12 text-center bs-animate-in">
        <div className="w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center" style={{ backgroundColor: accent + "18" }}>
          <span aria-hidden="true" className="material-symbols-outlined text-3xl" style={{ color: accent }}>check_circle</span>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Request received</h2>
        <p className="text-gray-600 mb-1">{selectedService?.name} — {new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" })}</p>
        <p className="text-gray-600">at {time}{selectedStaff ? ` · ${selectedStaff.name}` : ""}</p>
        <p className="text-sm text-gray-500 mt-6 max-w-sm mx-auto">Your appointment is <strong className="text-gray-700">awaiting confirmation</strong>. The boutique will contact you when it is confirmed.</p>
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <div role="status" className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-8 text-center bs-animate-in">
        <div className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: accent + "18" }}>
          <span aria-hidden="true" className="material-symbols-outlined text-2xl" style={{ color: accent }}>event_busy</span>
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Online booking is being set up</h2>
        <p className="text-sm text-gray-500 mt-2 max-w-sm mx-auto">This boutique has not published its appointment services yet. Please contact the boutique directly to arrange a visit.</p>
      </div>
    );
  }

  const STEP_LABELS: Record<Step, string> = { service: "Service", staff: "Stylist", datetime: "Date", info: "Details", done: "" };
  const stepOrder: Step[] = ["service", "staff", "datetime", "info"];

  return (
    <div className="flex flex-col gap-5">
      {/* Progress */}
      <div className="flex items-center justify-center">
        {stepOrder.map((s, i) => {
          const currentIdx = stepOrder.indexOf(step);
          const isCurrent = step === s;
          const isDone = i < currentIdx;
          return (
            <div key={s} className="flex items-center">
              <div className="flex flex-col items-center gap-1.5" aria-current={isCurrent ? "step" : undefined}>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                    isCurrent ? "text-white shadow-sm" : isDone ? "text-white" : "bg-gray-100 text-gray-400"
                  }`}
                  style={isCurrent ? { backgroundColor: accent } : isDone ? { backgroundColor: accent, opacity: 0.55 } : undefined}
                >
                  {isDone ? <span aria-hidden="true" className="material-symbols-outlined text-[16px]">check</span> : i + 1}
                </div>
                <span className={`text-[10px] font-medium ${isCurrent ? "text-gray-700" : "text-gray-400"}`}>{STEP_LABELS[s]}</span>
              </div>
              {i < 3 && <div className={`w-10 h-px mb-5 ${isDone ? "" : "bg-gray-200"}`} style={isDone ? { backgroundColor: accent, opacity: 0.4 } : undefined} />}
            </div>
          );
        })}
      </div>

      {/* Step: Service */}
      {step === "service" && (
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-6 bs-animate-in">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Choose a service</h2>
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat} className="mb-4 last:mb-0">
              <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{cat}</h3>
              <div className="flex flex-col gap-2">
                {items.map((s) => {
                  const sel = serviceId === s.id;
                  return (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => { setServiceId(s.id); setStep("staff"); }}
                      aria-pressed={sel}
                      className={`group text-left p-4 rounded-xl border transition-all hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${sel ? "ring-2" : "border-gray-200 hover:border-gray-300"}`}
                      style={sel ? { borderColor: accent, boxShadow: `0 0 0 2px ${accent}` } : undefined}
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 text-sm">{s.name}</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {formatDuration(s.duration)}
                            {s.description && ` · ${s.description}`}
                          </div>
                        </div>
                        <span className="font-semibold text-gray-900 text-sm whitespace-nowrap tabular-nums">
                            {formatPrice(Number(s.price))}{s.price_max ? `–${formatPrice(Number(s.price_max))}` : ""}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Step: Staff */}
      {step === "staff" && (
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-6 bs-animate-in">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Choose a stylist</h2>
          {availableStaff.length === 0 ? (
            <div role="status" className="rounded-xl bg-gray-50 border border-gray-100 p-5 text-center">
              <p className="text-sm text-gray-600">No stylist is available for this service yet.</p>
              <p className="text-xs text-gray-500 mt-1">Please contact the boutique directly to arrange your appointment.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => { setStaffId(null); setStep("datetime"); }}
                className="text-left p-4 rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: accent + "15" }}>
                  <span aria-hidden="true" className="material-symbols-outlined text-[20px]" style={{ color: accent }}>groups</span>
                </div>
                <div>
                  <div className="font-medium text-gray-900 text-sm">No preference</div>
                  <div className="text-xs text-gray-500">Any available stylist</div>
                </div>
              </button>
              {availableStaff.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => { setStaffId(s.id); setStep("datetime"); }}
                  className="text-left p-4 rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                >
                  {s.photo ? (
                    <Image unoptimized src={s.photo} alt={s.name} width={40} height={40} className="w-10 h-10 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                      <span aria-hidden="true" className="material-symbols-outlined text-gray-400 text-[20px]">person</span>
                    </div>
                  )}
                  <div>
                    <div className="font-medium text-gray-900 text-sm">{s.name}</div>
                    {s.title && <div className="text-xs text-gray-500">{s.title}</div>}
                  </div>
                </button>
              ))}
            </div>
          )}
          <button type="button" onClick={() => setStep("service")} className="mt-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 rounded"><span aria-hidden="true" className="material-symbols-outlined text-base">arrow_back</span>Back</button>
        </div>
      )}

      {/* Step: Date & Time */}
      {step === "datetime" && (
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-6 bs-animate-in">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Choose a date and time</h2>
          <div className="mb-5">
            <label htmlFor="appointment-date" className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
            <input
              id="appointment-date"
              type="date"
              min={minDate}
              value={date}
              onChange={(e) => { setDate(e.currentTarget.value); setTime(""); }}
              onInput={(e) => { setDate(e.currentTarget.value); setTime(""); }}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none transition focus:border-gray-400 focus:ring-2 focus-visible:outline-none"
              style={{ ["--tw-ring-color" as string]: accent + "33" }}
            />
          </div>
          {date && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Available times</label>
              {availableSlots.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {availableSlots.map((slot) => {
                    const sel = time === slot;
                    return (
                      <button
                        type="button"
                        key={slot}
                        onClick={() => setTime(slot)}
                        aria-pressed={sel}
                        className={`py-2 rounded-lg text-sm font-medium transition-all tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${sel ? "text-white shadow-sm" : "bg-gray-50 text-gray-700 border border-gray-100 hover:border-gray-300 hover:bg-gray-100"}`}
                        style={sel ? { backgroundColor: accent } : undefined}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div role="status" aria-live="polite" className="rounded-xl bg-gray-50 border border-gray-100 p-4 text-center">
                  <p className="text-sm text-gray-500">{hasPublishedAvailability ? "No times available on this date. Please try another day." : "The boutique has not published availability yet. Please contact them directly to arrange an appointment."}</p>
                </div>
              )}
            </div>
          )}
          <div className="flex items-center gap-3 mt-5">
            <button type="button" onClick={() => setStep("staff")} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 rounded"><span aria-hidden="true" className="material-symbols-outlined text-base">arrow_back</span>Back</button>
            {time && (
              <button
                onClick={() => setStep("info")}
                className="ml-auto py-2.5 px-6 text-white rounded-xl text-sm font-medium shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2"
                style={{ backgroundColor: accent }}
              >
                Continue
              </button>
            )}
          </div>
        </div>
      )}

      {/* Step: Contact Info */}
      {step === "info" && (
        <form onSubmit={(event) => { event.preventDefault(); void handleSubmit(); }} className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-6 bs-animate-in">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Your details</h2>
          <div className="flex flex-col gap-3.5">
            <div>
              <label htmlFor="booking-name" className="block text-sm font-medium text-gray-700 mb-1.5">Full name *</label>
              <input id="booking-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" aria-required="true" maxLength={120} className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none transition focus:border-gray-400 focus:ring-2 focus-visible:outline-none" style={{ ["--tw-ring-color" as string]: accent + "33" }} placeholder="Your name" />
            </div>
            <div>
              <label htmlFor="booking-phone" className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
              <input id="booking-phone" value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" autoComplete="tel" aria-describedby="booking-contact-help" maxLength={40} className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none transition focus:border-gray-400 focus:ring-2 focus-visible:outline-none" style={{ ["--tw-ring-color" as string]: accent + "33" }} placeholder="(555) 123-4567" />
            </div>
            <div>
              <label htmlFor="booking-email" className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input id="booking-email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" aria-describedby="booking-contact-help" maxLength={160} className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none transition focus:border-gray-400 focus:ring-2 focus-visible:outline-none" style={{ ["--tw-ring-color" as string]: accent + "33" }} placeholder="you@example.com" />
            </div>
            <div>
              <label htmlFor="booking-notes" className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
              <textarea id="booking-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none resize-y transition focus:border-gray-400 focus:ring-2 focus-visible:outline-none" style={{ ["--tw-ring-color" as string]: accent + "33" }} placeholder="Anything we should know..." />
            </div>
          </div>

          {/* Summary */}
          <div className="mt-5 p-4 rounded-xl border" style={{ backgroundColor: accent + "0a", borderColor: accent + "22" }}>
            <div className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: accent }}>Appointment summary</div>
            <div className="text-sm font-medium text-gray-900">{selectedService?.name}</div>
            <div className="text-xs text-gray-500 mt-1">
              {new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" })} · {time}
              {selectedStaff ? ` · ${selectedStaff.name}` : ""}
              {" · "}{selectedService ? formatDuration(selectedService.duration) : ""}
            </div>
            <div className="text-sm font-semibold text-gray-900 mt-1.5 tabular-nums">{formatPrice(Number(selectedService?.price ?? 0))}</div>
          </div>

          <p id="booking-contact-help" className="text-xs text-gray-400 mt-3">Please give us either a phone number or an email address.</p>
          {error && <p ref={errorRef} tabIndex={-1} role="alert" aria-live="assertive" className="text-sm text-red-500 mt-2 flex items-center gap-1 focus:outline-none"><span aria-hidden="true" className="material-symbols-outlined text-base">error</span>{error}</p>}

          <div className="flex items-center gap-3 mt-5">
            <button type="button" onClick={() => setStep("datetime")} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 rounded"><span aria-hidden="true" className="material-symbols-outlined text-base">arrow_back</span>Back</button>
            <button
              type="submit"
              disabled={!name.trim() || (!phone.trim() && !email.trim()) || submitting}
              aria-busy={submitting}
              className="ml-auto py-2.5 px-6 text-white rounded-xl text-sm font-medium shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: accent }}
            >
              {submitting ? "Sending..." : "Request appointment"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

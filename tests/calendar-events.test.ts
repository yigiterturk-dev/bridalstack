import { test } from "node:test";
import assert from "node:assert/strict";
import {
  countOut,
  daysInMonth,
  isLate,
  occupiesCalendar,
  rentalDaysInMonth,
  sortDayEvents,
  weekStart,
  weekDates,
  shiftWeek,
  rentalDaysInRange,
} from "../lib/calendar-events.ts";

const span = (start: string, due: string, status = "reserved") => ({ id: "r1", start_date: start, due_date: due, status });

test("ay uzunluğu artık yılı bilir", () => {
  assert.equal(daysInMonth(2026, 2), 28);
  assert.equal(daysInMonth(2028, 2), 29);
  assert.equal(daysInMonth(2026, 9), 30);
});

test("iptal ve dönmüş kiralama takvimde yer kaplamaz", () => {
  assert.equal(occupiesCalendar("reserved"), true);
  assert.equal(occupiesCalendar("out"), true);
  assert.equal(occupiesCalendar("returned"), false);
  assert.equal(occupiesCalendar("cancelled"), false);
  assert.deepEqual(rentalDaysInMonth(span("2026-09-10", "2026-09-12", "returned"), 2026, 9), []);
});

test("çıkış, ara ve dönüş günleri ayrı rollere düşer", () => {
  assert.deepEqual(rentalDaysInMonth(span("2026-09-10", "2026-09-13"), 2026, 9), [
    { day: 10, role: "pickup" },
    { day: 11, role: "out" },
    { day: 12, role: "out" },
    { day: 13, role: "due" },
  ]);
});

test("tek günlük kiralamada çıkış günü kazanır", () => {
  assert.deepEqual(rentalDaysInMonth(span("2026-09-10", "2026-09-10"), 2026, 9), [
    { day: 10, role: "pickup" },
  ]);
});

test("aya düşmeyen kiralama hiç görünmez", () => {
  assert.deepEqual(rentalDaysInMonth(span("2026-10-01", "2026-10-05"), 2026, 9), []);
});

test("ay taşan kiralamada yalnız aya düşen kısım görünür", () => {
  // Eylül'e sarkan kısım: 28, 29, 30 — çıkış ağustosta olduğu için hepsi "out".
  assert.deepEqual(rentalDaysInMonth(span("2026-08-28", "2026-09-30"), 2026, 9).slice(0, 3), [
    { day: 1, role: "out" },
    { day: 2, role: "out" },
    { day: 3, role: "out" },
  ]);
});

test("ay taşan kiralamanın dönüş günü doğru ayda işaretlenir", () => {
  const days = rentalDaysInMonth(span("2026-08-28", "2026-09-03"), 2026, 9);
  assert.deepEqual(days, [
    { day: 1, role: "out" },
    { day: 2, role: "out" },
    { day: 3, role: "due" },
  ]);
});

test("ters aralık hiç gün üretmez", () => {
  assert.deepEqual(rentalDaysInMonth(span("2026-09-14", "2026-09-10"), 2026, 9), []);
});

test("yalnız dışarıdaki kiralama gecikebilir", () => {
  assert.equal(isLate(span("2026-09-01", "2026-09-01", "out"), "2026-09-02"), true);
  assert.equal(isLate(span("2026-09-02", "2026-09-02", "out"), "2026-09-02"), false);
  assert.equal(isLate(span("2026-09-01", "2026-09-01", "reserved"), "2026-09-02"), false);
});

const ev = (kind: "appointment" | "rental", role?: "pickup" | "due" | "out", date = "") => ({
  id: `${kind}${role ?? ""}${date}`,
  kind,
  title: "",
  customerName: "",
  date,
  status: "",
  role,
});

test("eyleme geçilecek günler başa, sadece dışarıdakiler sona", () => {
  const sorted = sortDayEvents([ev("rental", "out"), ev("appointment"), ev("rental", "due"), ev("rental", "pickup")]);
  assert.deepEqual(sorted.map((e) => e.role ?? "appointment"), ["due", "pickup", "appointment", "out"]);
});

test("sadece dışarıdakiler sayılır", () => {
  assert.equal(countOut([ev("rental", "out"), ev("rental", "out"), ev("rental", "due"), ev("appointment")]), 2);
});


// ── Haftalık görünüm ─────────────────────────────────────────────────────────

test("hafta pazartesi başlar; pazar bir önceki haftaya aittir", () => {
  // 2026-09-09 çarşamba
  assert.equal(weekStart("2026-09-09"), "2026-09-07");
  assert.equal(weekStart("2026-09-07"), "2026-09-07"); // pazartesinin kendisi
  assert.equal(weekStart("2026-09-13"), "2026-09-07"); // pazar
  assert.equal(weekStart("2026-09-14"), "2026-09-14"); // sonraki pazartesi
});

test("hafta ay ve yıl sınırını aşabilir", () => {
  assert.equal(weekStart("2027-01-01"), "2026-12-28");
  assert.deepEqual(weekDates("2026-12-28").slice(4), ["2027-01-01", "2027-01-02", "2027-01-03"]);
});

test("hafta yedi ardışık gün verir", () => {
  assert.deepEqual(weekDates("2026-09-07"), [
    "2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10",
    "2026-09-11", "2026-09-12", "2026-09-13",
  ]);
});

test("ileri geri gezinme artık yıl şubatında da doğru", () => {
  assert.equal(shiftWeek("2028-02-28", 1), "2028-03-06"); // 2028 artık yıl, 29 Şubat var
  assert.equal(shiftWeek("2028-03-06", -1), "2028-02-28");
});

test("kiralama haftaya düşen günleri ve rolleriyle döner", () => {
  const days = rentalDaysInRange(span("2026-09-08", "2026-09-10"), "2026-09-07", "2026-09-13");
  assert.deepEqual(days, [
    { date: "2026-09-08", role: "pickup" },
    { date: "2026-09-09", role: "out" },
    { date: "2026-09-10", role: "due" },
  ]);
});

test("haftaya sarkan kiralamada yalnız aradaki günler görünür", () => {
  const days = rentalDaysInRange(span("2026-09-01", "2026-09-30"), "2026-09-07", "2026-09-13");
  assert.equal(days.length, 7);
  assert.ok(days.every((d) => d.role === "out"));
});

test("iptal ve dönmüş kiralama haftada da yer kaplamaz", () => {
  assert.deepEqual(rentalDaysInRange(span("2026-09-08", "2026-09-10", "returned"), "2026-09-07", "2026-09-13"), []);
});

test("haftaya hiç değmeyen kiralama boş döner", () => {
  assert.deepEqual(rentalDaysInRange(span("2026-10-01", "2026-10-05"), "2026-09-07", "2026-09-13"), []);
});

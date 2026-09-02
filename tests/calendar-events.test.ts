import { test } from "node:test";
import assert from "node:assert/strict";
import {
  countOut,
  daysInMonth,
  isLate,
  occupiesCalendar,
  rentalDaysInMonth,
  sortDayEvents,
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

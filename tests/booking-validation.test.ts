import { test } from "node:test";
import assert from "node:assert/strict";
import { validateBookingInput, intervalsOverlap, hasConflict, type BookingInput } from "../lib/booking-validation.ts";

const VALID: BookingInput = {
  tenant_id: "11111111-1111-1111-1111-111111111111",
  service_id: "22222222-2222-2222-2222-222222222222",
  customer_name: "Ayşe Yılmaz",
  customer_phone: "5551234567",
  customer_email: "ayse@example.com",
  booking_date: "2026-06-20",
  start_time: "10:00",
  end_time: "11:00",
};
const TODAY = "2026-06-18";

test("validateBookingInput: geçerli rezervasyon kabul edilir (happy path)", () => {
  assert.deepEqual(validateBookingInput(VALID, TODAY), { ok: true });
});

test("validateBookingInput: e-postasız ama telefonlu da geçerli", () => {
  assert.deepEqual(validateBookingInput({ ...VALID, customer_email: "" }, TODAY), { ok: true });
});

test("validateBookingInput: geçmiş tarih reddedilir (abuse)", () => {
  const r = validateBookingInput({ ...VALID, booking_date: "2020-01-01" }, TODAY);
  assert.equal(r.ok, false);
  assert.match((r as { error: string }).error, /past date/i);
});

test("validateBookingInput: sahte tenant_id (UUID değil) reddedilir — fail-closed", () => {
  const r = validateBookingInput({ ...VALID, tenant_id: "'; DROP TABLE bookings;--" }, TODAY);
  assert.equal(r.ok, false);
  assert.match((r as { error: string }).error, /missing or invalid/i);
});

test("validateBookingInput: bitiş <= başlangıç reddedilir", () => {
  assert.equal(validateBookingInput({ ...VALID, start_time: "11:00", end_time: "11:00" }, TODAY).ok, false);
  assert.equal(validateBookingInput({ ...VALID, start_time: "12:00", end_time: "11:00" }, TODAY).ok, false);
});

test("validateBookingInput: ne telefon ne e-posta -> reddedilir", () => {
  const r = validateBookingInput({ ...VALID, customer_phone: "", customer_email: "" }, TODAY);
  assert.equal(r.ok, false);
  assert.match((r as { error: string }).error, /phone number or email/i);
});

test("intervalsOverlap: yarı-açık aralık — sınırda dokunma çakışma değil", () => {
  assert.equal(intervalsOverlap("10:00", "11:00", "10:30", "11:30"), true); // örtüşür
  assert.equal(intervalsOverlap("10:00", "11:00", "11:00", "12:00"), false); // sınır temas
  assert.equal(intervalsOverlap("10:00", "11:00", "09:00", "10:00"), false); // sınır temas
});

test("hasConflict: çakışan aktif rezervasyon 409'a yol açar (abuse engeli)", () => {
  const existing = [{ start_time: "10:30", end_time: "11:30", status: "confirmed" }];
  assert.equal(hasConflict("10:00", "11:00", existing), true);
});

test("hasConflict: iptal/no-show çakışma SAYILMAZ; boş aralık serbest", () => {
  const cancelled = [
    { start_time: "10:00", end_time: "11:00", status: "cancelled" },
    { start_time: "10:00", end_time: "11:00", status: "no_show" },
  ];
  assert.equal(hasConflict("10:00", "11:00", cancelled), false);
  assert.equal(hasConflict("12:00", "13:00", [{ start_time: "10:00", end_time: "11:00", status: "confirmed" }]), false);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildJourney, daysBetween, normalizeEventDate, sortForAttention, type JourneyInput } from "../lib/journey.ts";

const TODAY = "2026-11-08";
const base = (over: Partial<JourneyInput> = {}): JourneyInput => ({
  eventDate: null, today: TODAY, orders: [], appointments: [], alterations: [], installments: [], ...over,
});

test("tarih normalleştirme: yalnız gerçek YYYY-MM-DD kabul", () => {
  assert.equal(normalizeEventDate("2026-12-20"), "2026-12-20");
  assert.equal(normalizeEventDate(" 2026-12-20 "), "2026-12-20");
  assert.equal(normalizeEventDate("2026-02-30"), null);
  assert.equal(normalizeEventDate(""), null);
  assert.equal(normalizeEventDate(null), null);
});

test("gün farkı", () => {
  assert.equal(daysBetween("2026-11-08", "2026-12-01"), 23);
  assert.equal(daysBetween("2026-11-08", "2026-11-06"), -2);
});

test("düğün tarihi yok: geri sayım yok, geride kalma yok", () => {
  const j = buildJourney(base());
  assert.equal(j.daysToWedding, null);
  assert.equal(j.risk, "on_track");
  assert.equal(j.steps.length, 5);
  assert.ok(j.steps.every((s) => s.idealDate === null));
  assert.equal(j.currentStep, 0);
});

test("düğün geçmiş: Married, risk yok", () => {
  const j = buildJourney(base({ eventDate: "2026-10-01", installments: [{ status: "overdue" }] }));
  assert.equal(j.risk, "married");
  assert.deepEqual(j.reasons, []);
});

test("ideal tarihler düğünden geriye sayılır", () => {
  const j = buildJourney(base({ eventDate: "2027-08-31" }));
  assert.deepEqual(j.steps.map((s) => s.idealDate), ["2027-02-28", "2027-05-31", "2027-07-06", "2027-08-17", "2027-08-31"]);
});

test("geride: elbise seçilmeden 6 aydan az kaldı", () => {
  const j = buildJourney(base({ eventDate: "2027-03-01" }));
  assert.equal(j.risk, "behind");
  assert.deepEqual(j.reasons, ["Dress not chosen yet"]);
});

test("taslak ve iptal sipariş elbise seçimi sayılmaz", () => {
  const j = buildJourney(base({ eventDate: "2027-12-01", orders: [{ status: "draft" }, { status: "cancelled" }] }));
  assert.equal(j.steps[0].done, false);
});

test("geciken tadilat kırmızı ve insan cümlesiyle", () => {
  const j = buildJourney(base({
    eventDate: "2026-12-20",
    orders: [{ status: "in_progress" }],
    alterations: [{ kind: "bustle", status: "in_progress", promised_date: "2026-11-06" }],
  }));
  assert.equal(j.risk, "late");
  assert.deepEqual(j.reasons, ["Bustle alteration is 2 days late"]);
  // tadilat var → elbise mağazada ve prova başladı
  assert.deepEqual(j.steps.map((s) => s.done), [true, true, true, false, false]);
  assert.equal(j.currentStep, 3);
});

test("tarihi olmayan gelinde de gecikme kırmızıdır", () => {
  const j = buildJourney(base({ alterations: [{ kind: "hem", status: "requested", promised_date: "2026-11-07" }] }));
  assert.equal(j.risk, "late");
  assert.deepEqual(j.reasons, ["Hem alteration is 1 day late"]);
});

test("gecikmiş taksit kırmızı", () => {
  const j = buildJourney(base({ eventDate: "2027-12-01", orders: [{ status: "confirmed" }], installments: [{ status: "overdue" }, { status: "overdue" }, { status: "paid" }] }));
  assert.equal(j.risk, "late");
  assert.deepEqual(j.reasons, ["2 payments are overdue"]);
});

test("hepsi bitti: teslim edilen sipariş + açık tadilat yok", () => {
  const j = buildJourney(base({
    eventDate: "2026-11-20",
    orders: [{ status: "delivered" }],
    alterations: [{ kind: "hem", status: "delivered", promised_date: "2026-11-01" }],
  }));
  assert.ok(j.steps.every((s) => s.done));
  assert.equal(j.currentStep, 5);
  assert.equal(j.risk, "on_track");
  assert.equal(j.daysToWedding, 12);
});

test("hazır ama teslim edilmemiş tadilat: son prova tamam, alınmadı", () => {
  const j = buildJourney(base({
    eventDate: "2026-12-20",
    orders: [{ status: "delivered" }],
    alterations: [{ kind: "hem", status: "ready", promised_date: "2026-12-01" }],
  }));
  assert.deepEqual(j.steps.map((s) => s.done), [true, true, true, true, false]);
});

test("tamamlanmış prova randevusu prova adımını işaretler", () => {
  const j = buildJourney(base({
    eventDate: "2027-12-01",
    orders: [{ status: "completed" }],
    appointments: [{ status: "completed", date: "2026-11-01" }, { status: "completed", date: "2026-11-10" }],
  }));
  assert.deepEqual(j.steps.map((s) => s.done), [true, true, true, false, false]);
});

test("dikkat sırası: kırmızı, sonra sarı, sonra düğüne yakın olan", () => {
  const mk = (name: string, over: Partial<JourneyInput>) => ({ name, journey: buildJourney(base(over)) });
  const rows = [
    mk("behind-far", { eventDate: "2027-03-01" }),
    mk("late", { alterations: [{ kind: "hem", status: "requested", promised_date: "2026-11-01" }] }),
    mk("behind-near", { eventDate: "2027-02-01" }),
    mk("ok", { eventDate: "2027-12-01", orders: [{ status: "confirmed" }] }),
  ];
  assert.deepEqual(sortForAttention(rows).map((r) => r.name), ["late", "behind-near", "behind-far", "ok"]);
});

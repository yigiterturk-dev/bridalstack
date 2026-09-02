import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBriefing, briefingToPrompt, type BriefingInput } from "../lib/briefing.ts";

const empty: BriefingInput = {
  followUpCount: 0, followUpValue: 0, oldestFollowUpDays: null,
  overdueInstallments: 0, overdueAmount: 0,
  pendingBookings: 0, appointmentsToday: 0, unconfirmedAppointments: 0,
  outOfStock: 0, lowStock: 0, deadStock: 0, unsignedContracts: 0,
};

test("hiçbir sinyal yoksa brifing boş", () => {
  assert.deepEqual(buildBriefing(empty), []);
});

test("sıfır olan sinyal satır üretmez", () => {
  const items = buildBriefing({ ...empty, pendingBookings: 2 });
  assert.equal(items.length, 1);
  assert.equal(items[0].id, "pending-bookings");
});

test("acil işler fırsatların üstünde", () => {
  const items = buildBriefing({ ...empty, pendingBookings: 1, followUpCount: 1, deadStock: 5 });
  assert.equal(items[0].tone, "urgent");
  assert.equal(items[items.length - 1].id, "dead-stock");
});

test("takip sayısı arttıkça öncelik yükselir", () => {
  const az = buildBriefing({ ...empty, followUpCount: 1, unconfirmedAppointments: 1 });
  const cok = buildBriefing({ ...empty, followUpCount: 15, unconfirmedAppointments: 1 });
  assert.equal(az[0].id, "follow-ups");
  assert.equal(cok[0].id, "follow-ups");
  assert.ok(cok[0].weight > az[0].weight);
});

test("tekil ve çoğul doğru yazılır", () => {
  const tek = buildBriefing({ ...empty, pendingBookings: 1 });
  const cok = buildBriefing({ ...empty, pendingBookings: 3 });
  assert.match(tek[0].title, /1 booking awaiting/);
  assert.match(cok[0].title, /3 bookings awaiting/);
});

test("stok tükendiyse azalan stok satırı gösterilmez", () => {
  const items = buildBriefing({ ...empty, outOfStock: 2, lowStock: 5 });
  assert.ok(items.some((i) => i.id === "out-of-stock"));
  assert.ok(!items.some((i) => i.id === "low-stock"));
});

test("sadece azalan stok varsa o gösterilir", () => {
  const items = buildBriefing({ ...empty, lowStock: 5 });
  assert.ok(items.some((i) => i.id === "low-stock"));
});

test("takip detayında tutar ve bekleme süresi geçer", () => {
  const [item] = buildBriefing({ ...empty, followUpCount: 2, followUpValue: 8700, oldestFollowUpDays: 41 });
  assert.match(item.detail, /8,700/);
  assert.match(item.detail, /41 days/);
});

test("her satırın gidilecek bir adresi var", () => {
  const items = buildBriefing({
    ...empty, followUpCount: 1, pendingBookings: 1, overdueInstallments: 1,
    unconfirmedAppointments: 1, appointmentsToday: 1, outOfStock: 1,
    deadStock: 1, unsignedContracts: 1,
  });
  assert.ok(items.length >= 8);
  for (const i of items) assert.match(i.href, /^\//);
});

test("prompt çevirisi boş brifingi de karşılıyor", () => {
  assert.match(briefingToPrompt([]), /Nothing needs attention/);
  const text = briefingToPrompt(buildBriefing({ ...empty, pendingBookings: 1 }));
  assert.match(text, /\[urgent\]/);
});

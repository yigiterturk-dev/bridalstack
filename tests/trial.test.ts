import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TRIAL_DAYS,
  startTrial,
  activeTrialPacks,
  effectivePacks,
  trialDaysLeft,
  canStartTrial,
  trialReminderKind,
} from "../lib/trial.ts";

const now = new Date("2026-09-09T12:00:00Z");
const iso = (d: Date) => d.toISOString();
const plusDays = (d: number) => new Date(now.getTime() + d * 86400000);

test("deneme yalnızca satılabilir ücretli paket için başlar", () => {
  const grant = startTrial(["sales", "base", "salon", "bogus" as never], now);
  assert.ok(grant);
  assert.deepEqual(grant.trialPacks, ["sales"]);
  assert.equal(grant.trialEndsAt.getTime() - now.getTime(), TRIAL_DAYS * 86400000);
});

test("ücretsiz paketten deneme çıkmaz", () => {
  assert.equal(startTrial(["base", "salon"], now), null);
  assert.equal(startTrial([], now), null);
});

test("deneme paketleri kiracının kendi paketlerine YAZILMAZ, okuma anında eklenir", () => {
  const settings = { trial_packs: ["sales"] };
  assert.deepEqual(effectivePacks(["base", "salon"], settings, iso(plusDays(3)), now), [
    "base",
    "salon",
    "sales",
  ]);
});

test("süresi dolan deneme kendiliğinden kapanır — cron gerekmez", () => {
  const settings = { trial_packs: ["sales"] };
  assert.deepEqual(activeTrialPacks(settings, iso(plusDays(-1)), now), []);
  assert.deepEqual(effectivePacks(["base"], settings, iso(plusDays(-1)), now), ["base"]);
});

test("tam sınırda (bitiş == şimdi) deneme dolmuş sayılır", () => {
  assert.deepEqual(activeTrialPacks({ trial_packs: ["sales"] }, iso(now), now), []);
});

test("bitiş tarihi yoksa deneme yoktur", () => {
  assert.deepEqual(activeTrialPacks({ trial_packs: ["sales"] }, null, now), []);
});

test("bozuk trial_packs içeriği yok sayılır", () => {
  assert.deepEqual(activeTrialPacks({ trial_packs: "sales" }, iso(plusDays(3)), now), []);
  assert.deepEqual(activeTrialPacks({ trial_packs: [1, "base", "nope"] }, iso(plusDays(3)), now), []);
});

test("aynı paket iki kez sayılmaz", () => {
  assert.deepEqual(effectivePacks(["base", "sales"], { trial_packs: ["sales"] }, iso(plusDays(3)), now), [
    "base",
    "sales",
  ]);
});

test("kalan gün yukarı yuvarlanır, eksiye inmez", () => {
  assert.equal(trialDaysLeft(iso(plusDays(2.4)), now), 3);
  assert.equal(trialDaysLeft(iso(plusDays(-5)), now), 0);
  assert.equal(trialDaysLeft(null, now), null);
});

test("deneme bir kez başlar: ödeyen veya daha önce denemiş kiracı yeniden başlatamaz", () => {
  assert.equal(canStartTrial({ packs: ["base"], plan: "free", trial_started_at: null, converted_at: null }), true);
  assert.equal(canStartTrial({ packs: ["base"], plan: "free", trial_started_at: iso(plusDays(-30)), converted_at: null }), false);
  assert.equal(canStartTrial({ packs: ["base", "sales"], plan: "free", trial_started_at: null, converted_at: null }), false);
  assert.equal(canStartTrial({ packs: ["base"], plan: "growth", trial_started_at: null, converted_at: null }), false);
});

test("hatırlatma: 3 gün kala bir kez, dolunca bir kez, arada susar", () => {
  assert.equal(trialReminderKind(iso(plusDays(3)), now), "ending_soon");
  assert.equal(trialReminderKind(iso(plusDays(0.5)), now), "ending_soon");
  assert.equal(trialReminderKind(iso(plusDays(7)), now), null);
  assert.equal(trialReminderKind(iso(plusDays(-0.5)), now), "expired");
  assert.equal(trialReminderKind(iso(plusDays(-10)), now), "expired");
  assert.equal(trialReminderKind(null, now), null);
});

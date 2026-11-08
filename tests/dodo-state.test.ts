import assert from "node:assert/strict";
import test from "node:test";
import { FREE_PACK_IDS } from "../config/modules.ts";
import {
  applyActiveSubscription,
  currentBillingInterval,
  DodoStateError,
  effectiveInterval,
  packsFromState,
  paidPacksFromState,
  planFromPacks,
  readDodoState,
  removeSubscription,
  subscriptionDiff,
} from "../lib/dodo-state.ts";

const sorted = (packs: string[]) => [...packs].sort();

test("bozuk/eksik ayar güvenle boş duruma çözülür", () => {
  assert.deepEqual(readDodoState(null), { customerId: null, subscriptions: {}, intervals: {} });
  assert.deepEqual(readDodoState({ dodo: "bozuk" }), { customerId: null, subscriptions: {}, intervals: {} });
  assert.deepEqual(
    readDodoState({ dodo: { customer_id: "  ", subscriptions: { sales: "sub_1", base: "x" } } }),
    { customerId: null, subscriptions: { sales: "sub_1" }, intervals: {} },
  );
});

test("aktif abonelik paketi ekler, ücretsizleri korur ve dönüşümü işaretler", () => {
  const change = applyActiveSubscription(null, {
    pack: "sales",
    subscriptionId: "sub_sales",
    customerId: "cus_1",
  });
  assert.equal(change.converted, true);
  assert.equal(change.plan, "starter");
  assert.deepEqual(sorted(change.packs), sorted([...FREE_PACK_IDS, "sales"]));
  const state = readDodoState(change.settings);
  assert.equal(state.customerId, "cus_1");
  assert.equal(state.subscriptions.sales, "sub_sales");
});

test("ikinci paket dönüşümü tekrar saymaz", () => {
  const first = applyActiveSubscription(null, { pack: "sales", subscriptionId: "sub_sales" });
  const second = applyActiveSubscription(first.settings, {
    pack: "finance",
    subscriptionId: "sub_finance",
    customerId: "cus_1",
  });
  assert.equal(second.converted, false);
  assert.deepEqual(sorted(second.packs), sorted([...FREE_PACK_IDS, "sales", "finance"]));
  assert.equal(second.state.customerId, "cus_1");
});

test("aynı aktif olay tekrar gelse de sonuç değişmez", () => {
  const first = applyActiveSubscription(null, { pack: "sales", subscriptionId: "sub_sales" });
  const again = applyActiveSubscription(first.settings, { pack: "sales", subscriptionId: "sub_sales" });
  assert.equal(again.converted, false);
  assert.deepEqual(sorted(again.packs), sorted(first.packs));
  assert.equal(again.state.subscriptions.sales, "sub_sales");
});

test("iptal yalnız KİMLİĞİ eşleşen aboneliği düşürür", () => {
  const first = applyActiveSubscription(null, { pack: "sales", subscriptionId: "sub_old" });
  const second = applyActiveSubscription(first.settings, { pack: "sales", subscriptionId: "sub_new" });

  const oldCancel = removeSubscription(second.settings, "sub_old");
  assert.equal(oldCancel.removedPack, null);
  assert.equal(readDodoState(oldCancel.settings).subscriptions.sales, "sub_new");

  const newCancel = removeSubscription(second.settings, "sub_new");
  assert.equal(newCancel.removedPack, "sales");
  assert.deepEqual(sorted(newCancel.packs), sorted(FREE_PACK_IDS));
  assert.equal(newCancel.plan, "free");
});

test("son ücretli paket gidince plan ücretsize döner, ücretsizler durur", () => {
  const active = applyActiveSubscription(null, { pack: "inventory", subscriptionId: "sub_inv" });
  const removed = removeSubscription(active.settings, "sub_inv");
  assert.equal(removed.plan, "free");
  assert.deepEqual(sorted(removed.packs), sorted(FREE_PACK_IDS));
});

test("plan paket listesinden türetilir", () => {
  assert.equal(planFromPacks([...FREE_PACK_IDS]), "free");
  assert.equal(planFromPacks([...FREE_PACK_IDS, "pro"]), "starter");
});

test("bilinmeyen paket ve boş abonelik kimliği reddedilir", () => {
  assert.throws(
    () => applyActiveSubscription(null, { pack: "base" as never, subscriptionId: "sub_1" }),
    DodoStateError,
  );
  assert.throws(
    () => applyActiveSubscription(null, { pack: "sales", subscriptionId: "  " }),
    DodoStateError,
  );
});

test("özet: ücretli paketler yalnız abonelik kimliği olanlar", () => {
  const state = readDodoState({ dodo: { subscriptions: { sales: "sub_1", pro: "" } } });
  assert.deepEqual(paidPacksFromState(state), ["sales"]);
  assert.deepEqual(sorted(packsFromState(state)), sorted([...FREE_PACK_IDS, "sales"]));
});

test("abonelik aralığı state'te saklanır ve iptalde temizlenir", () => {
  const active = applyActiveSubscription(null, { pack: "sales", subscriptionId: "sub_s", interval: "annual" });
  assert.equal(readDodoState(active.settings).intervals.sales, "annual");
  assert.equal(currentBillingInterval(readDodoState(active.settings)), "annual");
  const removed = removeSubscription(active.settings, "sub_s");
  assert.equal(readDodoState(removed.settings).intervals.sales, undefined);
  assert.equal(currentBillingInterval(readDodoState(removed.settings)), undefined);
});

test("aralık değişikliği iptal + yeniden satın alma üretir", () => {
  const active = applyActiveSubscription(null, { pack: "sales", subscriptionId: "sub_s", interval: "monthly" });
  const state = readDodoState(active.settings);
  assert.deepEqual(subscriptionDiff(state, ["sales"], "annual"), { toCancel: ["sales"], toBuy: ["sales"] });
  assert.deepEqual(subscriptionDiff(state, ["sales"], "monthly"), { toCancel: [], toBuy: [] });
  assert.deepEqual(subscriptionDiff(state, ["sales", "pro"], "monthly"), { toCancel: [], toBuy: ["pro"] });
  assert.deepEqual(subscriptionDiff(state, [], "monthly"), { toCancel: ["sales"], toBuy: [] });
});

test("aralık kaydı olmayan eski abonelik aylık sayılır", () => {
  const legacy = readDodoState({ dodo: { subscriptions: { sales: "sub_old" } } });
  assert.equal(effectiveInterval(legacy, "sales"), "monthly");
  assert.deepEqual(subscriptionDiff(legacy, ["sales"], "annual"), { toCancel: ["sales"], toBuy: ["sales"] });
  assert.deepEqual(subscriptionDiff(legacy, ["sales"], "monthly"), { toCancel: [], toBuy: [] });
});

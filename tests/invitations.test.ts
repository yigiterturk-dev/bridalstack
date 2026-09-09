import { test } from "node:test";
import assert from "node:assert/strict";
import { inviteStatus, inviteLink, isInviteActionable } from "../lib/invitations.ts";

const now = new Date("2026-09-09T12:00:00Z");
const inv = (expires: string, accepted: string | null = null) => ({
  expires_at: new Date(expires),
  accepted_at: accepted ? new Date(accepted) : null,
});

test("kabul edilmiş davet süresi geçse de kabul edilmiş sayılır", () => {
  assert.equal(inviteStatus(inv("2026-09-01T00:00:00Z", "2026-08-30T00:00:00Z"), now), "accepted");
});

test("süresi dolan davet expired, dolmayan pending", () => {
  assert.equal(inviteStatus(inv("2026-09-08T23:59:00Z"), now), "expired");
  assert.equal(inviteStatus(inv("2026-09-16T00:00:00Z"), now), "pending");
});

test("tam sınırda dolmuş sayılır (>= now)", () => {
  assert.equal(inviteStatus(inv("2026-09-09T12:00:00Z"), now), "expired");
});

test("bağlantı taban adresin sonundaki eğik çizgiyi ikilemez", () => {
  assert.equal(inviteLink("https://bridalstack.com", "abc"), "https://bridalstack.com/invite/abc");
  assert.equal(inviteLink("https://bridalstack.com/", "abc"), "https://bridalstack.com/invite/abc");
});

test("boş jeton bağlantı üretmez", () => {
  assert.throws(() => inviteLink("https://bridalstack.com", ""));
});

test("kabul edilmiş davete yeniden bağlantı üretilmez, süresi dolmuşa üretilir", () => {
  assert.equal(isInviteActionable(inv("2026-09-01T00:00:00Z", "2026-08-30T00:00:00Z"), now), false);
  assert.equal(isInviteActionable(inv("2026-09-01T00:00:00Z"), now), true);
  assert.equal(isInviteActionable(inv("2026-09-16T00:00:00Z"), now), true);
});

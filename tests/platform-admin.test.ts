import { test } from "node:test";
import assert from "node:assert/strict";
import { isPlatformAdmin, parseAdminEmails, signupNoticeEmail, signupNotifyAddress } from "../lib/platform-admin.ts";

test("boş liste kimseyi yönetici yapmaz", () => {
  assert.equal(isPlatformAdmin("a@b.com", ""), false);
  assert.equal(isPlatformAdmin("a@b.com", undefined), false);
  assert.equal(isPlatformAdmin(null, "a@b.com"), false);
});

test("büyük/küçük harf ve boşluk duyarsız", () => {
  assert.deepEqual(parseAdminEmails(" A@B.com , ,x"), ["a@b.com"]);
  assert.equal(isPlatformAdmin("a@B.COM ", "a@b.com,c@d.com"), true);
  assert.equal(isPlatformAdmin("c@d.com", "a@b.com"), false);
});

test("bildirim adresi varsayılanı hello@", () => {
  assert.equal(signupNotifyAddress(undefined), "hello@bridalstack.com");
  assert.equal(signupNotifyAddress("x@y.com"), "x@y.com");
});

test("bildirim metni HTML kaçırır, konu tek satır", () => {
  const m = signupNoticeEmail({ email: "a@b.com", shopName: "<b>Shop</b>\nX", slug: "shop", timeZone: null, at: new Date(0) });
  assert.ok(!m.subject.includes("\n"));
  assert.ok(m.html.includes("&lt;b&gt;Shop"));
  assert.ok(!m.html.includes("<b>Shop"));
});

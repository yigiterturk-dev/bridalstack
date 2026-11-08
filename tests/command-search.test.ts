import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreMatch, filterCommands, buildCommands } from "../lib/command-search.ts";

test("scoreMatch: başlangıç > kelime başı > içerir > yok", () => {
  assert.equal(scoreMatch("ord", "Orders"), 3);
  assert.equal(scoreMatch("ord", "New order"), 2);
  assert.equal(scoreMatch("rde", "Orders"), 1);
  assert.equal(scoreMatch("xyz", "Orders"), 0);
});

test("scoreMatch: büyük/küçük harf ve aksan fark etmez", () => {
  assert.equal(scoreMatch("ZOE", "Zoë Laurent"), 3);
  assert.equal(scoreMatch("  ", "Orders"), 3);
});

test("filterCommands: boş sorgu sırayı korur, dolu sorgu puana göre sıralar", () => {
  const items = [{ label: "New order" }, { label: "Orders" }, { label: "Cash" }];
  assert.deepEqual(filterCommands("", items).map((i) => i.label), ["New order", "Orders", "Cash"]);
  assert.deepEqual(filterCommands("ord", items).map((i) => i.label), ["Orders", "New order"]);
});

test("filterCommands: anahtar kelimeyle de bulunur", () => {
  const items = [{ label: "Book a fitting", keywords: ["appointment"] }];
  assert.equal(filterCommands("appoint", items).length, 1);
});

test("buildCommands: hızlı iş yalnız modülü açıksa çıkar, sayfalar tekrarsız", () => {
  const groups = [
    { items: [{ href: "/dashboard", label: "Today", icon: "today" }] },
    { section: "Clients", items: [{ href: "/customers", label: "Customers", icon: "group" }] },
  ];
  const { actions, pages } = buildCommands(groups);
  assert.deepEqual(actions.map((a) => a.href), ["/customers/new"]);
  assert.deepEqual(pages.map((p) => p.href), ["/dashboard", "/customers"]);
  assert.equal(pages[1].section, "Clients");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { getNavForModules, normalizeNavPins, MODULES, type ModuleId } from "../config/modules.ts";

const all = Object.keys(MODULES) as ModuleId[];
const hrefs = (g: { items: { href: string }[] }) => g.items.map((i) => i.href);

test("varsayılan ana menü: Today + 5 günlük ekran", () => {
  const [main] = getNavForModules(all);
  assert.deepEqual(hrefs(main), ["/dashboard", "/customers", "/appointments", "/orders", "/products", "/invoices"]);
});

test("butiğin seçtiği sayfalar ana menüye, sırasıyla; diğer gruplarda tekrar etmez", () => {
  const groups = getNavForModules(all, ["/rentals", "/analytics"]);
  assert.deepEqual(hrefs(groups[0]), ["/dashboard", "/rentals", "/analytics"]);
  const rest = groups.slice(1).flatMap(hrefs);
  assert.ok(!rest.includes("/rentals") && !rest.includes("/analytics"));
  assert.ok(rest.includes("/customers"));
});

test("kapalı modülün sayfası seçilmiş olsa da menüye girmez", () => {
  const [main] = getNavForModules(["crm"], ["/rentals", "/customers"]);
  assert.deepEqual(hrefs(main), ["/dashboard", "/customers"]);
});

test("boş seçim: yalnız Today", () => {
  assert.deepEqual(hrefs(getNavForModules(all, [])[0]), ["/dashboard"]);
});

test("normalizeNavPins çöpü atar", () => {
  assert.equal(normalizeNavPins("x"), null);
  assert.deepEqual(normalizeNavPins(["/a", "/a", "/dashboard", 5, "http://x", "/b"]), ["/a", "/b"]);
});

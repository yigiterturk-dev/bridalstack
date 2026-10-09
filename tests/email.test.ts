import { test } from "node:test";
import assert from "node:assert/strict";
import { bookingRequestEmail } from "../lib/email.ts";

test("booking request email includes the booking details", () => {
  const email = bookingRequestEmail(
    "Ada Lovelace",
    "The Bridal Room",
    "First fitting",
    "2026-10-21",
    "14:00–15:00",
    { email: "ada@example.com", phone: "+1 555 0100" }
  );

  assert.equal(email.subject, "New booking request — The Bridal Room");
  assert.match(email.html, /Ada Lovelace/);
  assert.match(email.html, /First fitting/);
  assert.match(email.html, /2026-10-21/);
  assert.match(email.html, /14:00–15:00/);
  assert.match(email.html, /ada@example.com · \+1 555 0100/);
});

test("booking request email escapes user-controlled HTML", () => {
  const email = bookingRequestEmail(
    '<img src=x onerror="alert(1)">',
    "Roses & Lace",
    "Couture <script>alert(1)</script>",
    "2026-10-21&next",
    "14:00 < 15:00",
    { email: "<script>alert(1)</script>@example.com", phone: "<b>555</b>" }
  );

  assert.doesNotMatch(email.html, /<img src=x/);
  assert.doesNotMatch(email.html, /<script>alert/);
  assert.match(email.html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.match(email.html, /Roses &amp; Lace/);
  assert.match(email.html, /2026-10-21&amp;next/);
  assert.match(email.html, /14:00 &lt; 15:00/);
  assert.match(email.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;@example.com/);
  assert.match(email.html, /&lt;b&gt;555&lt;\/b&gt;/);
});

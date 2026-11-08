# Bride Journey + Today Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make "a bride and her wedding date" the core unit: a wedding date field, a derived 5-step journey with risk, a new Today screen at `/dashboard`, and a redesigned bride page at `/customers/[id]`.

**Architecture:** `Customer.event_date` is the only new column. Everything else is derived on read by a pure function `lib/journey.ts` from existing orders, appointments, alterations and installments (nothing stored). Two server-component pages consume it; a small shared `components/journey-bar.tsx` draws the 5-segment bar.

**Tech Stack:** Next.js 16 (App Router, server components, server actions — read `node_modules/next/dist/docs/` before touching routing/fonts), Prisma 5 + Postgres, Tailwind v4, `node --test` with native TS (relative imports in `lib/` MUST end in `.ts`).

## Global Constraints

- Owner understands every screen in 5 seconds; plain English labels ("Dress ordered", not "PO issued"); no internal jargon.
- At most 5 journey steps. No configuration this round.
- Every number answers one question. Every empty state says what to do next, with one button.
- Color has one meaning only: gold = progress, amber = falling behind, red = late.
- Dates are `"YYYY-MM-DD"` strings (same as other date fields).
- No native `<select>` — use `components/select-field.tsx`.
- White background. Fonts: Fraunces (headings, countdown numbers), Inter (body, tables) via `next/font`.
- Every Prisma query filters by `tenant_id` (no RLS).
- Out of scope: the other 38 screens, ⌘K, per-boutique timeline settings, a stage table.
- Commit after each task; commit author is already configured. No AI footer in commit messages.

## Status strings (read from code, 2026-11-08)

| Record | Values | Source |
|---|---|---|
| Order | `draft, confirmed, in_progress, delivered, completed, cancelled` | `app/(dashboard)/orders/[id]/page.tsx:23` |
| Alteration | `requested, in_progress, ready, delivered, cancelled` | `lib/alterations.ts` |
| Appointment | `pending, confirmed, completed, cancelled` | `app/(dashboard)/appointments/page.tsx` |
| Installment | `pending, due, overdue, paid, cancelled` | `prisma/schema.prisma` |

There is no "dress arrived in shop" order status. Mapping decision: `completed` = order fulfilled / dress in the shop, `delivered` = handed to the bride. An existing alteration also proves the dress is in the shop.

## Spec deviation (deliberate)

Spec quick action "Send payment reminder" has no existing manual flow (reminders are cron-only, `app/api/cron/installments`). Building one is out of scope, so the third quick action is **"See payments"** → the bride's latest order page (where the installment plan lives), or **"New order"** if she has none.

## File map

- Modify `prisma/schema.prisma` (Customer) + create `prisma/migrations/20261108120000_customer_event_date/migration.sql`
- Create `lib/journey.ts` — pure: date helpers, `normalizeEventDate`, `buildJourney`, `sortForAttention`
- Create `tests/journey.test.ts`
- Modify `lib/actions.ts` (`createCustomer`), `app/(dashboard)/customers/new/page.tsx`, `app/(dashboard)/customers/[id]/actions.ts`
- Modify `app/globals.css`, `app/layout.tsx`, `app/(dashboard)/layout.tsx`, `components/sidebar.tsx`, `config/modules.ts`
- Create `components/journey-bar.tsx`, `components/bride-row.tsx`
- Replace `app/(dashboard)/dashboard/page.tsx`
- Replace `app/(dashboard)/customers/[id]/page.tsx`
- Modify `app/(dashboard)/appointments/page.tsx`, `app/(dashboard)/alterations/page.tsx` (prefill `?customer=`)
- Modify `lib/demo-data.ts`, `lib/demo-tour-steps.ts`

---

### Task 1: `event_date` column + journey logic

**Files:**
- Modify: `prisma/schema.prisma` (model Customer, after `notes`)
- Create: `prisma/migrations/20261108120000_customer_event_date/migration.sql`
- Create: `lib/journey.ts`
- Test: `tests/journey.test.ts`

**Interfaces:**
- Consumes: `isOpen`, `isOverdue`, `kindLabel` from `lib/alterations.ts`
- Produces (used by Tasks 2–5):
  - `normalizeEventDate(value: unknown): string | null`
  - `daysBetween(from: string, to: string): number`
  - `type JourneyInput = { eventDate: string | null; today: string; orders: { status: string }[]; appointments: { status: string; date: string }[]; alterations: { kind: string; status: string; promised_date: string | null }[]; installments: { status: string }[] }`
  - `type Risk = "late" | "behind" | "on_track" | "married"`
  - `type JourneyStep = { key: StepKey; label: string; done: boolean; idealDate: string | null }`
  - `type Journey = { steps: JourneyStep[]; currentStep: number; daysToWedding: number | null; risk: Risk; reasons: string[] }` (`currentStep` = index of first undone step, `5` when all done)
  - `buildJourney(input: JourneyInput): Journey`
  - `sortForAttention<T extends { journey: Journey }>(rows: T[]): T[]`

- [ ] **Step 1: Schema + migration**

In `prisma/schema.prisma`, model Customer, add after `notes      String?`:

```prisma
  /// Düğün günü — "2026-12-20". Yolculuk ve geri sayım buradan türetilir.
  event_date String?
```

Create `prisma/migrations/20261108120000_customer_event_date/migration.sql`:

```sql
-- AlterTable: gelin yolculuğunun tek yeni alanı.
ALTER TABLE "customers" ADD COLUMN "event_date" TEXT;
```

Run: `npx prisma generate 2>&1 | tail -2` → "Generated Prisma Client".

- [ ] **Step 2: Write the failing tests** — `tests/journey.test.ts`

```ts
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/journey.test.ts 2>&1 | tail -5`
Expected: FAIL — cannot find module `lib/journey.ts`.

- [ ] **Step 4: Implement `lib/journey.ts`**

```ts
/**
 * Gelin yolculuğu — saklanmaz, her okumada mevcut kayıtlardan türetilir.
 *
 * Gerçek durum değerleri (2026-11-08 kodu):
 *  - Order: draft, confirmed, in_progress, delivered, completed, cancelled.
 *    "completed" = sipariş tamamlandı / elbise mağazada; "delivered" = geline teslim.
 *  - Alteration: lib/alterations.ts (requested, in_progress, ready, delivered, cancelled).
 *  - Appointment: pending, confirmed, completed, cancelled.
 *  - Installment: pending, due, overdue, paid, cancelled.
 */
import { isOpen, isOverdue, kindLabel } from "./alterations.ts";

export type StepKey = "chosen" | "arrived" | "fittings" | "final" | "picked_up";
export type Risk = "late" | "behind" | "on_track" | "married";
export type JourneyStep = { key: StepKey; label: string; done: boolean; idealDate: string | null };
export type Journey = {
  steps: JourneyStep[];
  /** İlk bitmemiş adımın sırası; hepsi bittiyse 5. */
  currentStep: number;
  daysToWedding: number | null;
  risk: Risk;
  reasons: string[];
};
export type JourneyInput = {
  eventDate: string | null;
  today: string;
  orders: { status: string }[];
  appointments: { status: string; date: string }[];
  alterations: { kind: string; status: string; promised_date: string | null }[];
  installments: { status: string }[];
};

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function normalizeEventDate(value: unknown): string | null {
  const s = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && iso(d) === s ? s : null;
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);
}

function daysBefore(date: string, days: number): string {
  return iso(new Date(Date.parse(`${date}T00:00:00Z`) - days * DAY));
}

/** Ay sonu taşmasın: 31 Ağustos − 6 ay = 28 Şubat. */
function monthsBefore(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 - months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return iso(target);
}

const STEP_DEFS: { key: StepKey; label: string; behind: string; ideal: (wedding: string) => string }[] = [
  { key: "chosen", label: "Dress chosen", behind: "Dress not chosen yet", ideal: (w) => monthsBefore(w, 6) },
  { key: "arrived", label: "Dress arrived", behind: "Dress hasn't arrived yet", ideal: (w) => monthsBefore(w, 3) },
  { key: "fittings", label: "Fittings", behind: "No fitting yet", ideal: (w) => daysBefore(w, 56) },
  { key: "final", label: "Final fitting", behind: "Final fitting not done yet", ideal: (w) => daysBefore(w, 14) },
  { key: "picked_up", label: "Picked up", behind: "Dress not picked up yet", ideal: (w) => w },
];

const ORDER_CHOSEN = new Set(["confirmed", "in_progress", "delivered", "completed"]);
const ORDER_IN_SHOP = new Set(["delivered", "completed"]);

export function buildJourney(input: JourneyInput): Journey {
  const { eventDate, today, orders, appointments, alterations, installments } = input;
  const live = alterations.filter((a) => a.status !== "cancelled");

  const raw: Record<StepKey, boolean> = {
    chosen: orders.some((o) => ORDER_CHOSEN.has(o.status)),
    arrived: orders.some((o) => ORDER_IN_SHOP.has(o.status)) || live.length > 0,
    fittings: live.length > 0 || appointments.some((a) => a.status === "completed" && a.date <= today),
    final: live.length > 0 && live.every((a) => a.status === "ready" || a.status === "delivered"),
    picked_up: orders.some((o) => o.status === "delivered") && !live.some((a) => isOpen(a.status)),
  };
  // Sonraki adım bittiyse öncekiler de bitmiştir (tadilatsız gelin teslim alınmış olabilir).
  const done = STEP_DEFS.map((s) => raw[s.key]);
  for (let i = done.length - 2; i >= 0; i--) done[i] = done[i] || done[i + 1];

  const steps: JourneyStep[] = STEP_DEFS.map((s, i) => ({
    key: s.key, label: s.label, done: done[i], idealDate: eventDate ? s.ideal(eventDate) : null,
  }));
  const firstOpen = done.indexOf(false);
  const currentStep = firstOpen === -1 ? 5 : firstOpen;
  const daysToWedding = eventDate ? daysBetween(today, eventDate) : null;

  if (eventDate && eventDate < today) return { steps, currentStep, daysToWedding, risk: "married", reasons: [] };

  const reasons: string[] = [];
  for (const a of alterations) {
    if (!isOverdue(a, today)) continue;
    const n = daysBetween(a.promised_date as string, today);
    reasons.push(`${kindLabel(a.kind)} alteration is ${n} day${n === 1 ? "" : "s"} late`);
  }
  const overdue = installments.filter((i) => i.status === "overdue").length;
  if (overdue) reasons.push(overdue === 1 ? "A payment is overdue" : `${overdue} payments are overdue`);
  if (reasons.length) return { steps, currentStep, daysToWedding, risk: "late", reasons };

  const current = steps[currentStep];
  if (current && current.idealDate && current.idealDate < today) {
    return { steps, currentStep, daysToWedding, risk: "behind", reasons: [STEP_DEFS[currentStep].behind] };
  }
  return { steps, currentStep, daysToWedding, risk: "on_track", reasons: [] };
}

const RISK_RANK: Record<Risk, number> = { late: 0, behind: 1, on_track: 2, married: 3 };

/** Kırmızı → sarı → yolunda; aynı grupta düğünü en yakın olan önde, tarihsiz en sonda. */
export function sortForAttention<T extends { journey: Journey }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const r = RISK_RANK[a.journey.risk] - RISK_RANK[b.journey.risk];
    if (r) return r;
    return (a.journey.daysToWedding ?? Infinity) - (b.journey.daysToWedding ?? Infinity);
  });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/journey.test.ts tests/migrations.test.ts 2>&1 | tail -8`
Expected: all pass, `fail 0`.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20261108120000_customer_event_date lib/journey.ts tests/journey.test.ts
git commit -m "feat: gelin düğün tarihi + türetilmiş yolculuk/risk (lib/journey)"
```

---

### Task 2: Wedding date on customer forms

**Files:**
- Modify: `lib/actions.ts` (`createCustomer`, ~line 31-39)
- Modify: `app/(dashboard)/customers/new/page.tsx` (after the Phone field)
- Modify: `app/(dashboard)/customers/[id]/actions.ts`

**Interfaces:**
- Consumes: `normalizeEventDate` (Task 1)
- Produces: `updateCustomer` now also writes `event_date`; new server action `updateEventDate(formData: FormData)` reading `id`, `event_date` — used by the bride page hero (Task 5).

- [ ] **Step 1: `createCustomer`** — in `lib/actions.ts` add the import `import { normalizeEventDate } from "./journey.ts";` (match the file's existing import style; if it uses `@/lib/...` use `@/lib/journey`). After the `phone` line add:

```ts
  const event_date = normalizeEventDate(formData.get("event_date"));
```

and change the create data to `{ tenant_id: tenant.id, name, phone, email, notes, event_date, created_by: userId }`.

- [ ] **Step 2: New customer form** — in `app/(dashboard)/customers/new/page.tsx`, after the Phone field's wrapping `<div>`, add (same classes as Phone):

```tsx
          <div>
            <label htmlFor="customer-event-date" className="block text-sm font-medium text-gray-700 mb-1">Wedding date</label>
            <input id="customer-event-date" name="event_date" type="date" className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none text-sm" />
          </div>
```

- [ ] **Step 3: Edit actions** — in `app/(dashboard)/customers/[id]/actions.ts`: import `normalizeEventDate` from `@/lib/journey`; in `updateCustomer` add `const event_date = normalizeEventDate(formData.get("event_date"));` and add `event_date` to the `data` object. Then append:

```ts
/** Gelin sayfasındaki tek alanlık form: yalnız düğün tarihini değiştirir. */
export async function updateEventDate(formData: FormData) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");
  const member = await getCurrentMember();
  if (!hasPermission(member?.role, "customers.manage")) redirect("/customers?error=forbidden");

  const id = String(formData.get("id") || "").trim();
  if (!id) redirect("/customers");
  const event_date = normalizeEventDate(formData.get("event_date"));

  await prisma.customer.updateMany({ where: { id, tenant_id: tenant.id }, data: { event_date } });
  revalidatePath(`/customers/${id}`);
  revalidatePath("/dashboard");
  redirect(`/customers/${id}`);
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "actions.ts|customers/new" | head`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add lib/actions.ts "app/(dashboard)/customers/new/page.tsx" "app/(dashboard)/customers/[id]/actions.ts"
git commit -m "feat: düğün tarihi müşteri formlarında"
```

---

### Task 3: Visual tokens, fonts, sidebar, shared components

**Files:**
- Modify: `app/globals.css` (`:root`, `@theme inline`, header comment)
- Modify: `app/layout.tsx`
- Modify: `app/(dashboard)/layout.tsx` (root div background)
- Modify: `config/modules.ts:272`
- Modify: `components/sidebar.tsx` (nav link classes ~line 104-117)
- Create: `components/journey-bar.tsx`, `components/bride-row.tsx`

**Interfaces:**
- Consumes: `Journey`, `JourneyStep`, `Risk` (Task 1)
- Produces:
  - `<JourneyBar steps={JourneyStep[]} risk={Risk} />` — 5 segments, done = gold; current segment amber/red when risk behind/late.
  - `<BrideRow id name reason daysToWedding steps risk />` — one link row → `/customers/{id}`.
  - `countdownLabel(days: number | null): string` exported from `components/bride-row.tsx`.
  - Tailwind utilities: `font-serif`, `text-gold`, `bg-gold`, `text-amber`, `bg-amber`, `text-late`, `bg-late`.

- [ ] **Step 1: Read the font guide** — `ls node_modules/next/dist/docs/ | head` then read the `next/font` page found there; confirm `next/font/google` + `variable` option are unchanged in this version.

- [ ] **Step 2: Tokens** — in `app/globals.css` replace the header comment's line "No cream+gold, no serif display, no purple hero." with "White ground, champagne gold for progress, Fraunces for headings and numbers." Add to `:root` (keep existing vars):

```css
  --bg: #ffffff;
  --gold: #a8875a;
  --gold-soft: #f6f0e7;
  --amber: #c27c0e;
  --amber-soft: #fdf4e3;
  --red: #c0392b;
  --red-soft: #fbeceb;
```

and inside `@theme inline` replace the `--font-sans` line and add colors:

```css
  --font-sans: var(--font-inter), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-serif: var(--font-fraunces), ui-serif, Georgia, serif;
  --color-gold: var(--gold);
  --color-gold-soft: var(--gold-soft);
  --color-amber: var(--amber);
  --color-amber-soft: var(--amber-soft);
  --color-late: var(--red);
  --color-late-soft: var(--red-soft);
```

(`late` not `red`, so Tailwind's built-in `red-*` palette is untouched.)

- [ ] **Step 3: Fonts** — in `app/layout.tsx`:

```tsx
import { Fraunces, Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });
```

`<html lang="en" className={`h-full ${inter.variable} ${fraunces.variable}`}>` and body class `bg-[#fafafa]` → `bg-[var(--bg)]`.

In `app/(dashboard)/layout.tsx` change the root div `bg-[#FDFCFB]` → `bg-white`.

- [ ] **Step 4: Sidebar** — `config/modules.ts:272`: `{ href: "/dashboard", label: "Today", icon: "today" },` (already first). In `components/sidebar.tsx` nav `Link` className: `gap-3.5 px-4 py-2.5 rounded-2xl text-[14px] font-medium transition-all duration-300` → `gap-3 px-3.5 py-2 rounded-xl text-[13.5px] font-medium transition-colors duration-200`; active branch `bg-rose-50/80 text-rose-700 shadow-sm border border-rose-100/50` → `bg-gold-soft text-[var(--ink)] border border-transparent`; the active indicator span classes `bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.8)]` → `bg-gold`; active icon `text-rose-500 scale-110` → `text-gold`. Inactive styles unchanged.

- [ ] **Step 5: `components/journey-bar.tsx`**

```tsx
import type { JourneyStep, Risk } from "@/lib/journey";

/** 5 parçalı ilerleme: biten = altın; sıradaki adım geride/gecikmişse sarı/kırmızı. */
export default function JourneyBar({ steps, risk, labels = false }: { steps: JourneyStep[]; risk: Risk; labels?: boolean }) {
  const current = steps.findIndex((s) => !s.done);
  return (
    <div className="w-full">
      <div className="flex gap-1" role="img" aria-label={`${steps.filter((s) => s.done).length} of ${steps.length} steps done`}>
        {steps.map((s, i) => {
          const color = s.done
            ? "bg-gold"
            : i === current && risk === "late"
              ? "bg-late"
              : i === current && risk === "behind"
                ? "bg-amber"
                : "bg-[var(--line)]";
          return <span key={s.key} className={`h-1.5 flex-1 rounded-full ${color}`} />;
        })}
      </div>
      {labels && (
        <div className="mt-2 grid grid-cols-5 gap-1 text-[11px] leading-tight text-[var(--muted)]">
          {steps.map((s) => (
            <span key={s.key} className={s.done ? "text-[var(--ink)]" : ""}>{s.label}</span>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: `components/bride-row.tsx`**

```tsx
import Link from "next/link";
import JourneyBar from "@/components/journey-bar";
import type { JourneyStep, Risk } from "@/lib/journey";

export function countdownLabel(days: number | null): string {
  if (days === null) return "No date";
  if (days === 0) return "Today";
  if (days < 0) return "Married";
  return `${days} day${days === 1 ? "" : "s"}`;
}

const DOT: Record<Risk, string> = { late: "bg-late", behind: "bg-amber", on_track: "bg-gold", married: "bg-[var(--line)]" };

export default function BrideRow(props: { id: string; name: string; reason: string | null; daysToWedding: number | null; steps: JourneyStep[]; risk: Risk }) {
  const { id, name, reason, daysToWedding, steps, risk } = props;
  return (
    <Link href={`/customers/${id}`} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_8rem_6rem] items-center gap-x-4 gap-y-2 px-4 py-3 hover:bg-stone-50 transition-colors">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${DOT[risk]}`} />
          <span className="truncate font-medium text-[var(--ink)]">{name}</span>
        </div>
        {reason && <p className="mt-0.5 truncate text-sm text-[var(--muted)]">{reason}</p>}
      </div>
      <div className="col-span-2 sm:col-span-1 sm:order-none order-last"><JourneyBar steps={steps} risk={risk} /></div>
      <span className="text-right font-serif text-lg tabular-nums text-[var(--ink)]">{countdownLabel(daysToWedding)}</span>
    </Link>
  );
}
```

- [ ] **Step 7: Build check**

Run: `npx tsc --noEmit -p . 2>&1 | head -5` → no errors in touched files. Run `npm run lint 2>&1 | tail -3` if the script exists (`grep '"lint"' package.json`).

- [ ] **Step 8: Commit**

```bash
git add app/globals.css app/layout.tsx "app/(dashboard)/layout.tsx" config/modules.ts components/sidebar.tsx components/journey-bar.tsx components/bride-row.tsx
git commit -m "feat: beyaz zemin + altın token'lar, Fraunces/Inter, Today kenar çubuğu, yolculuk çubuğu"
```

---

### Task 4: Today screen (`/dashboard`)

**Files:**
- Replace: `app/(dashboard)/dashboard/page.tsx` (old charts/follow-ups dashboard is removed; `/analytics` keeps charts)

**Interfaces:**
- Consumes: `buildJourney`, `sortForAttention` (Task 1); `BrideRow` (Task 3); `dateInTimeZone`, `addCalendarDays`, `startOfDayInTimeZone`, `normalizeTimeZone` from `@/lib/timezone`; `formatPrice` from `@/config/modules`; `getCurrentTenant`, `getCurrentUserId` from `@/lib/tenant`.

- [ ] **Step 1: Check what the old page exported** — `grep -rn "dashboard/page" app components lib tests | head` → nothing imports it (pages are leaves). Confirm, then replace the file.

- [ ] **Step 2: Write the page**

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant, getCurrentUserId } from "@/lib/tenant";
import { formatPrice } from "@/config/modules";
import { addCalendarDays, dateInTimeZone, normalizeTimeZone, startOfDayInTimeZone } from "@/lib/timezone";
import { buildJourney, sortForAttention } from "@/lib/journey";
import BrideRow from "@/components/bride-row";

const OPEN_INSTALLMENT = ["pending", "due", "overdue"];

export default async function TodayPage() {
  const [tenant, userId] = await Promise.all([getCurrentTenant(), getCurrentUserId()]);
  if (!tenant) redirect("/onboarding");

  const tz = normalizeTimeZone((tenant.settings as Record<string, unknown> | null)?.time_zone);
  const now = new Date();
  const today = dateInTimeZone(now, tz);
  const dayStart = startOfDayInTimeZone(today, tz);
  const dayEnd = startOfDayInTimeZone(addCalendarDays(today, 1), tz);
  const weekEnd = addCalendarDays(today, 6);
  const t = tenant.id;

  const [user, customerCount, apptToday, alterFitToday, dueWeek, brides] = await Promise.all([
    userId ? prisma.user.findUnique({ where: { id: userId }, select: { name: true } }) : null,
    prisma.customer.count({ where: { tenant_id: t } }),
    prisma.appointment.count({ where: { tenant_id: t, appointment_date: { gte: dayStart, lt: dayEnd }, status: { not: "cancelled" } } }),
    prisma.alteration.count({ where: { tenant_id: t, fitting_date: today, status: { notIn: ["cancelled", "delivered"] } } }),
    prisma.installment.aggregate({ where: { tenant_id: t, status: { in: OPEN_INSTALLMENT }, due_date: { gte: today, lte: weekEnd } }, _sum: { amount: true } }),
    // Yaklaşan düğünü olan ya da bir şeyi geciken gelinler — geri kalanı Today'i meşgul etmez.
    prisma.customer.findMany({
      where: {
        tenant_id: t,
        OR: [
          { event_date: { gte: today } },
          { alterations: { some: { status: { in: ["requested", "in_progress", "ready"] }, promised_date: { lt: today } } } },
          { installments: { some: { status: "overdue" } } },
        ],
      },
      take: 300,
      select: {
        id: true, name: true, event_date: true,
        orders: { select: { status: true } },
        appointments: { select: { status: true, appointment_date: true } },
        alterations: { select: { kind: true, status: true, promised_date: true } },
        installments: { select: { status: true } },
      },
    }),
  ]);

  const rows = brides.map((c) => ({
    id: c.id,
    name: c.name,
    journey: buildJourney({
      eventDate: c.event_date,
      today,
      orders: c.orders,
      appointments: c.appointments.map((a) => ({ status: a.status, date: dateInTimeZone(a.appointment_date, tz) })),
      alterations: c.alterations,
      installments: c.installments,
    }),
  }));
  const active = rows.filter((r) => r.journey.risk !== "married");
  const attention = sortForAttention(active.filter((r) => r.journey.risk === "late" || r.journey.risk === "behind"));
  const upcoming = active
    .filter((r) => r.journey.daysToWedding !== null && r.journey.daysToWedding <= 60)
    .sort((a, b) => (a.journey.daysToWedding ?? 0) - (b.journey.daysToWedding ?? 0));
  const lateCount = active.filter((r) => r.journey.risk === "late").length;

  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(now));
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = user?.name?.split(" ")[0];
  const dateLabel = new Date(`${today}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });

  return (
    <div className="flex flex-col gap-10">
      <header>
        <p className="text-sm text-[var(--muted)]">{dateLabel}</p>
        <h1 className="mt-1 font-serif text-3xl sm:text-4xl text-[var(--ink)]">{greeting}{firstName ? `, ${firstName}` : ""}</h1>
      </header>

      {customerCount === 0 ? (
        <section className="rounded-2xl border border-[var(--line)] p-10 text-center">
          <h2 className="font-serif text-2xl text-[var(--ink)]">No brides yet</h2>
          <p className="mt-2 text-[var(--muted)]">Add a bride with her wedding date and Today will tell you who needs you.</p>
          <Link href="/customers/new" className="mt-6 inline-block rounded-xl bg-[var(--ink)] px-5 py-2.5 text-sm font-medium text-white">Add your first bride</Link>
        </section>
      ) : (
        <>
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Stat label="Fittings today" value={String(apptToday + alterFitToday)} href="/appointments" />
            <Stat label="Late" value={String(lateCount)} tone={lateCount ? "late" : undefined} href="#attention" />
            <Stat label="Payments due this week" value={formatPrice(dueWeek._sum.amount ?? 0)} href="/installments" />
          </section>

          <section id="attention">
            <h2 className="mb-3 font-serif text-xl text-[var(--ink)]">Needs attention</h2>
            {attention.length === 0 ? (
              <p className="rounded-2xl border border-[var(--line)] px-4 py-6 text-[var(--muted)]">Nothing is late. Nice.</p>
            ) : (
              <div className="divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)]">
                {attention.map((r) => (
                  <BrideRow key={r.id} id={r.id} name={r.name} reason={r.journey.reasons[0] ?? null} daysToWedding={r.journey.daysToWedding} steps={r.journey.steps} risk={r.journey.risk} />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 font-serif text-xl text-[var(--ink)]">Upcoming weddings <span className="text-base text-[var(--muted)]">· next 60 days</span></h2>
            {upcoming.length === 0 ? (
              <div className="rounded-2xl border border-[var(--line)] px-4 py-6 text-[var(--muted)]">
                No weddings in the next 60 days. Add wedding dates to your brides to see them here.
                <Link href="/customers" className="ml-2 font-medium text-[var(--ink)] underline">Open brides</Link>
              </div>
            ) : (
              <div className="divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)]">
                {upcoming.map((r) => (
                  <BrideRow key={r.id} id={r.id} name={r.name} reason={r.journey.reasons[0] ?? null} daysToWedding={r.journey.daysToWedding} steps={r.journey.steps} risk={r.journey.risk} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, href, tone }: { label: string; value: string; href: string; tone?: "late" }) {
  return (
    <Link href={href} className="rounded-2xl border border-[var(--line)] p-5 hover:border-stone-300 transition-colors">
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className={`mt-2 font-serif text-4xl tabular-nums ${tone === "late" ? "text-late" : "text-[var(--ink)]"}`}>{value}</p>
    </Link>
  );
}
```

- [ ] **Step 3: Verify module gating** — the old page checked `tenant.enabled_modules` (crm/sales/appointments). Run `grep -n "isModuleLive\|enabled_modules" config/modules.ts | head -5`. Today counts only use core tables; if a tenant lacks the `appointments` module, still show the tile (count is just 0). No gating needed — note it in the commit message.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p . 2>&1 | grep "dashboard/page" | head` → no output. (`tenant.settings` field: verify with `grep -n "settings" prisma/schema.prisma | head -3`; it is read the same way in `app/api/cron/installments/route.ts`.)

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/dashboard/page.tsx"
git commit -m "feat: Today ekranı — dikkat isteyen gelinler, yaklaşan düğünler, 3 sayı"
```

---

### Task 5: Bride page (`/customers/[id]`) + prefilled quick actions

**Files:**
- Replace: `app/(dashboard)/customers/[id]/page.tsx`
- Modify: `app/(dashboard)/appointments/page.tsx` (line 25 signature; SelectField ~line 87)
- Modify: `app/(dashboard)/alterations/page.tsx` (Props line 48; SelectField ~line 125)

**Interfaces:**
- Consumes: `buildJourney`, `daysBetween` (Task 1); `updateCustomer`, `updateEventDate` (Task 2); `JourneyBar`, `countdownLabel` (Task 3).

- [ ] **Step 1: Prefill `?customer=`** — appointments page: change signature to

```tsx
export default async function AppointmentsPage({ searchParams }: { searchParams?: Promise<{ customer?: string }> }) {
  const params = await searchParams;
```

and add `defaultValue={params?.customer ?? ""}` to the `customer_id` SelectField. Alterations page: extend Props to `{ error?: string; customer?: string }` and add `defaultValue={params?.customer ?? ""}` to its `customer_id` SelectField. (SelectField already accepts `defaultValue`.)

- [ ] **Step 2: Write the bride page**

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import PortalLinkButton from "@/components/portal-link-button";
import SelectField from "@/components/select-field";
import JourneyBar from "@/components/journey-bar";
import { countdownLabel } from "@/components/bride-row";
import { formatPrice } from "@/config/modules";
import { kindLabel } from "@/lib/alterations";
import { buildJourney } from "@/lib/journey";
import { dateInTimeZone, normalizeTimeZone } from "@/lib/timezone";
import { updateCustomer, updateEventDate } from "./actions";

type Props = { params: Promise<{ id: string }> };
type FeedItem = { key: string; date: string; title: string; detail: string; href: string };

const fmtDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export default async function BridePage({ params }: Props) {
  const { id } = await params;
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");
  const t = tenant.id;

  // Her sorguda tenant_id: RLS yok, izolasyon burada kuruluyor.
  const [customer, orders, appointments, alterations, installments] = await Promise.all([
    prisma.customer.findFirst({ where: { id, tenant_id: t } }),
    prisma.order.findMany({ where: { customer_id: id, tenant_id: t }, orderBy: { created_at: "desc" }, take: 20 }),
    prisma.appointment.findMany({ where: { customer_id: id, tenant_id: t }, orderBy: { appointment_date: "desc" }, take: 20 }),
    prisma.alteration.findMany({ where: { customer_id: id, tenant_id: t }, orderBy: { created_at: "desc" }, take: 20 }),
    prisma.installment.findMany({ where: { customer_id: id, tenant_id: t, status: { not: "cancelled" } }, orderBy: { due_date: "desc" }, take: 30 }),
  ]);
  if (!customer) redirect("/customers");

  const tz = normalizeTimeZone((tenant.settings as Record<string, unknown> | null)?.time_zone);
  const today = dateInTimeZone(new Date(), tz);
  const journey = buildJourney({
    eventDate: customer.event_date,
    today,
    orders,
    appointments: appointments.map((a) => ({ status: a.status, date: dateInTimeZone(a.appointment_date, tz) })),
    alterations,
    installments,
  });

  const feed: FeedItem[] = [
    ...orders.map((o) => ({ key: `o${o.id}`, date: o.order_date ?? o.created_at.toISOString().slice(0, 10), title: `Order ${o.ref_no}`, detail: `${o.status.replace(/_/g, " ")} · ${formatPrice(Number(o.discounted_total))}`, href: `/orders/${o.id}` })),
    ...appointments.map((a) => ({ key: `a${a.id}`, date: dateInTimeZone(a.appointment_date, tz), title: a.title ?? "Appointment", detail: a.status, href: "/appointments" })),
    ...alterations.map((a) => ({ key: `l${a.id}`, date: a.promised_date ?? a.fitting_date ?? a.created_at.toISOString().slice(0, 10), title: `${kindLabel(a.kind)} alteration`, detail: `${a.status.replace(/_/g, " ")}${a.promised_date ? ` · promised ${fmtDate(a.promised_date)}` : ""}`, href: "/alterations" })),
    ...installments.map((i) => ({ key: `i${i.id}`, date: i.due_date, title: `Payment ${i.installment_no} of ${i.total_count}`, detail: `${formatPrice(i.amount)} · ${i.status}`, href: i.order_id ? `/orders/${i.order_id}` : "/installments" })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const latestOrder = orders.find((o) => o.status !== "cancelled");
  const married = journey.risk === "married";
  const box = journey.risk === "late" ? "border-late bg-late-soft" : "border-amber bg-amber-soft";

  return (
    <div className="flex flex-col gap-8">
      <Link href="/customers" className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">← Brides</Link>

      {/* Hero */}
      <section className="rounded-2xl border border-[var(--line)] p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-serif text-3xl sm:text-4xl text-[var(--ink)]">{customer.name}</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">{[customer.phone, customer.email].filter(Boolean).join(" · ") || "No contact info"}</p>
          </div>
          <div className="sm:text-right">
            {customer.event_date ? (
              <>
                <p className="font-serif text-5xl tabular-nums text-[var(--ink)]">{married ? "Married" : countdownLabel(journey.daysToWedding)}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">Wedding {fmtDate(customer.event_date)}</p>
              </>
            ) : (
              <form action={updateEventDate} className="flex items-center gap-2">
                <input type="hidden" name="id" value={customer.id} />
                <label htmlFor="hero-event-date" className="sr-only">Wedding date</label>
                <input id="hero-event-date" name="event_date" type="date" required className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm" />
                <button type="submit" className="rounded-xl bg-[var(--ink)] px-4 py-2 text-sm font-medium text-white">Add wedding date</button>
              </form>
            )}
          </div>
        </div>
        <div className="mt-8"><JourneyBar steps={journey.steps} risk={journey.risk} labels /></div>
      </section>

      {(journey.risk === "late" || journey.risk === "behind") && (
        <section className={`rounded-2xl border px-5 py-4 ${box}`}>
          <ul className="flex flex-col gap-1 text-sm text-[var(--ink)]">
            {journey.reasons.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </section>
      )}

      {/* Quick actions — en fazla 3 */}
      <section className="flex flex-wrap gap-3">
        <Link href={`/appointments?customer=${customer.id}`} className="rounded-xl bg-[var(--ink)] px-4 py-2 text-sm font-medium text-white">Book fitting</Link>
        <Link href={`/alterations?customer=${customer.id}`} className="rounded-xl border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--ink)]">New alteration</Link>
        {latestOrder ? (
          <Link href={`/orders/${latestOrder.id}`} className="rounded-xl border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--ink)]">See payments</Link>
        ) : (
          <Link href={`/orders/new?customer=${customer.id}`} className="rounded-xl border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--ink)]">New order</Link>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Feed */}
        <section className="lg:col-span-2">
          <h2 className="mb-3 font-serif text-xl text-[var(--ink)]">Everything so far</h2>
          {feed.length === 0 ? (
            <div className="rounded-2xl border border-[var(--line)] px-4 py-6 text-[var(--muted)]">
              Nothing yet. Start with her dress.
              <Link href={`/orders/new?customer=${customer.id}`} className="ml-2 font-medium text-[var(--ink)] underline">New order</Link>
            </div>
          ) : (
            <ol className="divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)]">
              {feed.map((f) => (
                <li key={f.key}>
                  <Link href={f.href} className="grid grid-cols-[6.5rem_1fr] gap-4 px-4 py-3 hover:bg-stone-50">
                    <span className="text-sm tabular-nums text-[var(--muted)]">{fmtDate(f.date)}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-[var(--ink)]">{f.title}</span>
                      <span className="block truncate text-sm capitalize text-[var(--muted)]">{f.detail}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Details (eski düzenleme formu, düğün tarihiyle) */}
        <section className="rounded-2xl border border-[var(--line)] p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-xl text-[var(--ink)]">Details</h2>
            <PortalLinkButton customerId={customer.id} />
          </div>
          <form action={updateCustomer} className="flex flex-col gap-3">
            <input type="hidden" name="id" value={customer.id} />
            <Field label="Name"><input name="name" defaultValue={customer.name} required className={INPUT} /></Field>
            <Field label="Wedding date"><input name="event_date" type="date" defaultValue={customer.event_date ?? ""} className={INPUT} /></Field>
            <Field label="Phone"><input name="phone" defaultValue={customer.phone ?? ""} className={INPUT} /></Field>
            <Field label="Email"><input name="email" type="email" defaultValue={customer.email ?? ""} className={INPUT} /></Field>
            <Field label="Status">
              <SelectField
                name="status"
                defaultValue={customer.status ?? "new"}
                searchable={false}
                options={["new", "hot_lead", "appointment_set", "fitting_done", "sold", "delivered", "lost"].map((s) => ({ value: s, label: s.replace(/_/g, " ") }))}
              />
            </Field>
            <Field label="Notes"><textarea name="notes" rows={3} defaultValue={customer.notes ?? ""} className={`${INPUT} resize-y`} /></Field>
            <button type="submit" className="mt-1 rounded-xl bg-[var(--ink)] py-2 text-sm font-medium text-white">Save changes</button>
          </form>
        </section>
      </div>
    </div>
  );
}

const INPUT = "w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm outline-none focus:border-gold";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}
```

Try-on history is dropped from this page on purpose (not in spec feed; `/try-ons` still lists it). `daysBetween` import is not needed here — don't import it.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "customers/\[id\]|appointments/page|alterations/page" | head` → no output.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/customers/[id]/page.tsx" "app/(dashboard)/appointments/page.tsx" "app/(dashboard)/alterations/page.tsx"
git commit -m "feat: gelin sayfası — geri sayım, 5 adım, tek akış, hızlı işler"
```

---

### Task 6: Demo data + tour

**Files:**
- Modify: `lib/demo-data.ts` (DemoCustomer type ~line 14; customers ~line 80; Ava's alteration ~line 253)
- Modify: `lib/demo-tour-steps.ts` (first step)
- Test: `tests/demo-data.test.ts` (add one test)

**Interfaces:**
- Consumes: `buildJourney` (Task 1) in the test only.

- [ ] **Step 1: Failing test** — append to `tests/demo-data.test.ts` (add `import { buildJourney } from "../lib/journey.ts";` at the top):

```ts
test("tanıtımda düğün tarihleri önümüzdeki 6 aya yayılır ve Today boş kalmaz", () => {
  const now = new Date("2026-11-08T12:00:00Z");
  const today = "2026-11-08";
  const data = buildDemoData(now);
  const dated = data.customers.filter((c) => c.event_date && c.event_date >= today);
  assert.ok(dated.length >= 4, "en az dört yaklaşan düğün");
  assert.ok(dated.some((c) => c.event_date! <= "2026-12-08"), "30 gün içinde en az bir düğün");
  assert.ok(dated.every((c) => c.event_date! <= "2027-05-08"), "6 aydan uzak düğün yok");
  const ava = data.customers.find((c) => c.name === "Ava Bennett")!;
  const avaAlts = buildDemoOperations(now).alterations.filter((a) => a.customerName === "Ava Bennett");
  const j = buildJourney({ eventDate: ava.event_date, today, orders: [{ status: "confirmed" }], appointments: [], alterations: avaAlts.map((a) => ({ kind: a.kind, status: a.status, promised_date: a.promised_date })), installments: [] });
  assert.equal(j.risk, "late", "Needs attention bölümünde en az bir kırmızı gelin");
});
```

Change the existing import line to `import { buildDemoData, buildDemoOperations, DEMO_MARK } from "../lib/demo-data.ts";` (`buildDemoOperations` is at `lib/demo-data.ts:213`; its return has `alterations` with `customerName, kind, status, promised_date`).

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/demo-data.test.ts 2>&1 | tail -5` → FAIL (`event_date` undefined).

- [ ] **Step 2: Data** — in `DemoCustomer` add `event_date: string | null;`. In each `customers` row of `buildDemoData` add `event_date: dateOnly(new Date(now.getTime() + N * DAY))`:

| Customer | event_date |
|---|---|
| Ava Bennett | +38 days |
| Sofia Ramirez | +74 days |
| Chloe Turner | +150 days |
| Maya Okafor | +175 days |
| Elena Rossi | +21 days |
| Hannah Cole | −60 days (married) |

e.g. `event_date: dateOnly(new Date(now.getTime() + 38 * DAY))`. Update Ava's notes "Ceremony in June." → "Ceremony in five weeks." (keep the date story consistent).

Ava's hem alteration `promised_date`: `+ 6 * DAY` → `- 2 * DAY` (one red bride on Today; the alterations tour step already says "Late jobs rise to the top"). `lib/demo-seed.ts` spreads `...c` into `customer.create`, so `event_date` is written with no seed change.

- [ ] **Step 3: Tour** — first step in `lib/demo-tour-steps.ts`:

```ts
  {
    href: "/dashboard",
    title: "Today: who needs you",
    body: "Every bride with her wedding countdown. Red means something is late, amber means she's falling behind. Click a name to see her whole journey on one page.",
  },
```

- [ ] **Step 4: Run tests**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/demo-data.test.ts tests/demo-tenant.test.ts 2>&1 | tail -5` → `fail 0`.

- [ ] **Step 5: Commit**

```bash
git add lib/demo-data.ts lib/demo-tour-steps.ts tests/demo-data.test.ts
git commit -m "feat: tanıtım verisinde düğün tarihleri + Today turu"
```

---

### Task 7: Full gate, deploy, browser check

- [ ] **Step 1: Full test suite once** — `npm test 2>&1 | tail -8` → `fail 0`.
- [ ] **Step 2: Build** — `npm run build 2>&1 | tail -15` → success, no type errors.
- [ ] **Step 3: Push** — `git push`.
- [ ] **Step 4: Deploy** — `scripts/deploy-netcup.sh 2>&1 | tail -10` (ends probing `/api/health` and `/login`).
- [ ] **Step 5: Migrate** — backup first (OPERATIONS.md): `ssh netcup 'bash /opt/nocturn-yedek/nocturn-yedek.sh bridalstack'`, then `ssh netcup 'cd /opt/bridalstack && docker exec bridalstack npx prisma migrate deploy' 2>&1 | tail -4` → "1 migration applied" (`20261108120000_customer_event_date`). Additive column — safe.
- [ ] **Step 6: Demo reseed** — check how the demo tenant is reset (`grep -n "seedDemo\|reset" OPERATIONS.md app/demo -r | head -5`) and run that so demo customers get `event_date`.
- [ ] **Step 7: Probes** — `curl -s https://bridalstack.com/api/health` → `{"status":"ok"...}`; `/login` and `/demo` → 200.
- [ ] **Step 8: Browser check (desktop 1440 + mobile 390)** — open `/demo`, land on Today: header serif greeting, 3 tiles, Ava red in Needs attention with "Hem alteration is 2 days late", Elena/Ava/Sofia in Upcoming; click Ava → bride page: countdown "38 days", 5 labelled steps, red reasons box, feed, 3 quick actions; "Book fitting" opens appointments with Ava preselected. Mobile: no horizontal scroll, rows wrap the bar under the name. One screenshot per viewport, no more.
- [ ] **Step 9: Update memory** — `project_bridal_stack.md` one line: Today + bride journey live, commit sha.

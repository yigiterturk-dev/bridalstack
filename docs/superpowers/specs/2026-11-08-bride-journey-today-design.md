# Bride Journey + Today — design

Date: 2026-11-08 · Status: approved

## Problem
The app feels like a generic CRM: 40+ modules, every screen a table + form.
A bridal boutique thinks in one unit — *a bride and her wedding date* — and that
unit is missing (Customer has no wedding date; orders, fittings, alterations and
payments are disconnected).

## Guiding rule: simple and obvious
The owner must understand every screen in 5 seconds without training.
- Plain English labels ("Dress ordered", not "PO issued"). No internal jargon.
- At most 5 journey steps. No configuration in this round.
- Every number answers one question ("How many fittings today?").
- Every empty state says what to do next, with one button.
- Color has one meaning only: gold = progress, amber = falling behind, red = late.

## Scope (round 1)
1. `Customer.event_date` field (wedding date).
2. `lib/journey.ts` — pure function deriving journey + risk from existing records.
3. New **Today** screen at `/dashboard`.
4. Redesigned **bride page** at `/customers/[id]`.
5. Shared visual tokens (Fraunces + Inter, white background, champagne gold) and a light sidebar refresh.

Out of scope: other 38 screens, ⌘K palette, per-boutique timeline settings, new stage table.

## 1. Data
- `Customer.event_date String?` (`"2026-12-20"`, same convention as other date fields).
- Editable on customer create/edit form and inline on the bride page.
- Customers without a date still work; they show "Add wedding date" instead of a countdown.

## 2. Journey (derived, never stored)
Five steps:

| # | Step | Done when | Ideal by (before wedding) |
|---|------|-----------|---------------------------|
| 1 | Dress chosen | an order exists that is not draft/cancelled | 6 months |
| 2 | Dress arrived | order delivered/received status | 3 months |
| 3 | Fittings | an alteration exists, or a fitting appointment occurred | 8 weeks |
| 4 | Final fitting | all alterations ready/delivered | 2 weeks |
| 5 | Picked up | order/alteration delivered | wedding day |

Exact status strings are mapped in one table inside `journey.ts` after reading
the real status values in code.

Risk per bride:
- **late (red)**: alteration past `promised_date` and not ready; or an installment `overdue`.
- **behind (amber)**: current step's ideal date has passed.
- **on track**: otherwise.
- Wedding date in the past → bride is "Married", no risk, hidden from Today.

Output shape: `{ steps: [{key,label,done,idealDate}], currentStep, daysToWedding, risk, reasons: string[] }`.
`reasons` are short human sentences ("Bustle alteration is 2 days late").

## 3. Today (`/dashboard`)
- Header: date + "Good morning, {name}" (serif).
- 3 stat tiles: **Fittings today** · **Late** · **Payments due this week** (amount).
- **Needs attention**: red then amber brides, each row = name, reason sentence, D-countdown, 5-segment bar. Click → bride page.
- **Upcoming weddings (60 days)**: same row format, sorted by date.
- Empty states: no brides → "Add your first bride" button; nothing late → "Nothing is late. Nice."

## 4. Bride page (`/customers/[id]`)
- Hero: name, wedding date, big countdown ("23 days"), 5-step timeline with labels under each step.
- Reasons box if amber/red.
- One chronological feed: orders, fittings/appointments, alterations, payments — each with date, one-line summary, link to existing detail screen.
- Quick actions (max 3): Book fitting · New alteration · Send payment reminder (links to existing flows).

## 5. Visual system
- CSS tokens in globals: `--bg #fff`, `--ink`, `--muted`, `--line`, `--gold #a8875a`, `--amber`, `--red`.
- Fonts via `next/font`: Fraunces (headings, countdown numbers), Inter (body, tables).
- Sidebar: same items, refreshed type/spacing, "Today" first.
- No native `<select>` (use existing `select-field`).

## 6. Testing & release
- Unit tests for `journey.ts`: no date, past wedding, behind, late alteration, overdue installment, all done.
- Demo seed gets wedding dates spread over the next 6 months; demo tour steps updated to the new screens.
- Build, deploy to netcup, check Today + bride page in the browser on desktop and mobile.

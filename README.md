# BridalStack

A multi-tenant CRM for bridal retail operations. It brings customer records, appointments, sales, inventory, contracts, public booking, installments, and role-aware workflows into one Next.js application.

[![CI](https://github.com/yigiterturk-dev/bridalstack/actions/workflows/ci.yml/badge.svg)](https://github.com/yigiterturk-dev/bridalstack/actions/workflows/ci.yml)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![Tests](https://img.shields.io/badge/tests-356%20unit%20%2B%20399%20e2e-16a34a)](tests)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> Status: deployed at `bridalstack.com` on a single netcup VPS (Docker + Caddy + PostgreSQL) and verified live. The domain rules, TypeScript build, lint, and dependency audit pass locally, and a 24-stage end-to-end suite runs against a live PostgreSQL database or an isolated migration database, depending on the stage. Dodo Payments, Resend, Vercel Blob, and AI integrations are environment-gated and require owner-provided credentials; see [OPERATIONS.md](OPERATIONS.md) for the deployment, cron and backup layout.

## Product evidence

[![BridalStack landing experience](docs/screenshots/landing-desktop.png)](docs/screenshots/landing-desktop.png)

Landing experience at `bridalstack.com` (the screenshot above was captured locally). External integrations remain environment-gated.

## Why this project exists

Bridal retail combines long customer journeys with scheduled fittings, physical inventory, deposits, installments, contracts, and staff-specific access. BridalStack explores how those workflows can share one tenant-scoped operating model without turning every user into an administrator.

## Engineering highlights

- **Fail-closed RBAC:** `owner`, `admin`, `stylist`, and `viewer` roles normalize unknown values to the least-privileged role.
- **Tenant isolation:** there is no row-level security to fall back on, so every query is filtered through a single gate (`getCurrentTenant` / `requireTenantId`) that throws rather than run unscoped.
- **Public booking guardrails:** UUID, contact, date, time-range, past-date, and overlap validation live in pure, testable functions.
- **Installment state machine:** deterministic plan generation, cent-preserving rounding, due-state derivation, and deduplicated reminder decisions.
- **Environment-gated services:** database, cron, email, payment, storage, and AI credentials stay server-side; a missing `NEXTAUTH_SECRET` fails the boot in production rather than falling back to a shared default.
- **Modular product surface:** feature packs control sales, inventory, booking, and management capabilities. Packs with no shipped module cannot be purchased, and the checkout endpoint re-checks that server-side.

## Architecture

```mermaid
flowchart LR
    Browser[Next.js UI] --> Routes[Server Actions + Route Handlers]
    Routes --> Guard[RBAC + Tenant Context]
    Guard --> Db[(PostgreSQL via Prisma)]
    Routes --> Dodo[Dodo Payments Checkout/Webhooks]
    Routes --> Resend[Resend Email]
    Cron[Authenticated Cron] --> Installments[Installment State Machine]
    Installments --> Db
    Installments --> Resend
```

Authorization is layered: the proxy rejects unauthenticated requests to protected routes, while pages and API handlers enforce route-specific authentication, role, and tenant checks. Public booking, contract-signature, and customer-portal routes remain intentionally reachable through scoped tokens or validated inputs.

## Verified domain behavior

`npm test` covers 356 unit cases; `tests/e2e/` adds 399 checks across 24 stages against a running server, a live database, or an isolated migration database. Together they cover:

- booking happy paths, malformed tenant IDs, invalid time windows, past dates, missing contact data, and collision detection;
- role ranking, permission escalation denial, legacy-role normalization, and unknown-role fallback;
- installment splitting, rounding invariants, minimum counts, due/overdue transitions, and reminder selection.

Run the same quality gates used by CI:

```bash
npm ci --ignore-scripts
npx prisma generate
npm run lint
npm test
npm run build
npm audit --omit=dev --audit-level=high
```

## Local setup

Requirements: Node.js 24+, npm, and a PostgreSQL 17+ database.

```bash
git clone https://github.com/yigiterturk-dev/bridalstack.git
cd bridalstack
npm ci --ignore-scripts
npx prisma generate
cp .env.example .env.local   # then fill DATABASE_URL and NEXTAUTH_SECRET
npx prisma migrate deploy
npm run dev
```

Open `http://localhost:3000`. Every environment variable is documented in `.env.example`; optional integrations stay disabled until their server-only variables are supplied.

## Data and security notes

- Never expose the database URL, Dodo secrets, cron secrets, storage tokens, or AI keys to browser code.
- `NEXTAUTH_SECRET` is mandatory in production; the server refuses to start without it.
- The built-in public-route rate limiter uses Upstash Redis when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are configured. Without them it is process-local, so a distributed deployment must not treat it as a global abuse-control boundary.
- Password reset and staff invitations issue single-use tokens; only the SHA-256 digest is stored, never the raw token.
- Installment reminders are implemented; automatic recurring card charging is explicitly not implemented.

See [SECURITY.md](SECURITY.md) for reporting and [docs/showcase-audit.md](docs/showcase-audit.md) for the evidence ledger and remaining production gates.

## Stack

Next.js 16 · React 19 · TypeScript · Prisma · PostgreSQL · NextAuth · Dodo Payments · Resend · Vercel Blob · Tailwind CSS · Recharts · Node test runner · Docker · Caddy

## License

[MIT](LICENSE)

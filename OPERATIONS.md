# BridalStack operations guide

This guide covers the Vercel production deployment for `bridalstack.com`. It is intentionally explicit about what the repository can verify and what still requires confirmation in the hosted services.

## Release path

1. Work on a branch and open a pull request.
2. Require the `CI` workflow to pass before merging to `main`.
3. CI installs with `npm ci --ignore-scripts`, generates Prisma Client explicitly, runs lint and tests, builds the app, and audits production dependencies.
4. Vercel deploys `main` to the `bridalstack` project. The production aliases are `bridalstack.com`, `www.bridalstack.com`, and `bridalstack.vercel.app`.
5. After deployment, verify the deployment state and test the public landing page, sign-up page, demo, and one authenticated dashboard journey.

The public liveness probe is `GET /api/health`. It returns only service health and does not reveal secrets or database details. Use it for uptime checks; use the authenticated smoke journey for dependency readiness.

Useful commands from the repository root:

```bash
vercel ls bridalstack --yes
vercel inspect <deployment-url>
vercel logs <deployment-url>
```

The repository's local release checks are:

```bash
npm ci --ignore-scripts
npx prisma generate
npm run lint
npm test
npm run build
npm audit --omit=dev --audit-level=high
```

## Database changes

Prisma migrations are committed under `prisma/migrations/`. Apply them before serving traffic that depends on a new schema:

```bash
npx prisma migrate deploy
```

`DATABASE_URL` is the pooled runtime connection. `DIRECT_URL` is used for migration operations. Never run a destructive reset against a production database. Take or confirm a provider backup/PITR point before a migration that changes or removes data.

## Required production configuration

Required for the core application:

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL=https://bridalstack.com`
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` for distributed public-route rate limiting

Required before enabling the related feature:

- `CRON_SECRET` for scheduled jobs
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and live Stripe Price IDs for billing
- `RESEND_API_KEY` and `EMAIL_FROM` for email
- `BLOB_READ_WRITE_TOKEN` for image uploads
- `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` for the AI stylist

Keep all values server-side. Rotate a credential immediately if it appears in logs, source, a browser bundle, or a support attachment.

## Scheduled jobs and integrations

Vercel schedules the following authenticated routes:

- `/api/cron/briefing`
- `/api/cron/reminders`
- `/api/cron/installments`
- `/api/cron/trials`

Each route must receive the configured `CRON_SECRET` as a Bearer token. After changing a cron secret, verify one scheduled invocation and inspect logs for a successful response. Stripe webhook signature validation and Resend/Blob availability are fail-closed or feature-gated in the application; still monitor their provider dashboards for delivery failures.

## DNS and email authentication

DNS for `bridalstack.com` is managed at Hostinger (`aster`/`helios.dns-parking.com`).
The zone as of 2026-10-14 carries:

- `A @ → 76.76.21.21` (Vercel) and `CNAME www → bridalstack.com`.
- `TXT @ → v=spf1 include:send.bridalstack.com include:amazonses.com ~all`
  (sender authorization; `send`/`rsend` are CNAMEs to the transactional
  provider, `resend._domainkey` holds the DKIM public key).
- `TXT _dmarc → v=DMARC1; p=quarantine; adkim=r; aspf=r;`
- `CAA @ → issue/issuewild limited to letsencrypt.org and pki.goog`
  (the current certificate is issued by Let's Encrypt).

A zone backup is written before edits; changes can be reverted through the
Hostinger DNS snapshot/restore API.

**DNSSEC is not enabled.** The Hostinger API exposes no DNSSEC endpoint and the
`dns-parking.com` nameservers do not sign the zone, so there is no DS record at
the registry. To add DNSSEC, move the zone to a DNSSEC-capable provider
(for example Cloudflare, which keeps the Vercel `A` record and adds one-click
signing) and publish the resulting DS record at the registrar. This is the one
email/DNS hardening step that still requires a manual provider change.

## Incident response

### A deployment is unhealthy

1. Check the deployment state and logs with `vercel inspect` and `vercel logs`.
2. If the previous deployment is known-good, promote it while investigating:

   ```bash
   vercel promote <known-good-deployment-url>
   ```

3. Record the deployment IDs, first observed time, affected route, and the rollback decision.
4. Re-run the public landing, sign-up, demo, and dashboard smoke checks after rollback.

### A migration fails

Stop rollout. Do not retry destructive SQL blindly. Capture the migration name and database error, confirm the last successful backup/PITR point with the database owner, and prepare a forward fix or restore plan. Application rollback alone does not undo an applied migration.

### A credential or customer-data exposure is suspected

Disable or rotate the affected credential, preserve only the minimum privacy-safe evidence, review provider access logs, and report the vulnerability privately as described in [SECURITY.md](SECURITY.md). Do not paste customer records, tokens, or secrets into issues or chat.

## Current operational unknowns

The repository cannot prove these hosted controls:

- Neon backup/PITR retention and restore drills.
- Vercel alert routing and log retention.
- Successful delivery of every scheduled cron invocation.
- Stripe webhook replay/failed-event alerting.
- A configured distributed rate-limit store for multi-instance public routes. If the Upstash variables above are absent, the limiter is process-local and should not be described as a global abuse-control boundary.

Confirm these before promising a service-level guarantee to a paying boutique. Until then, describe BridalStack as production-deployed with provider-level operational controls still requiring owner verification.

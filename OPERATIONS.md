# BridalStack operations guide

BridalStack runs on a single netcup VPS behind Caddy, with a host PostgreSQL
database. This guide is the operational source of truth; `README.md` describes
the product and local development.

## Topology

```
browser → Caddy (TLS, 80/443)
        → 172.18.0.1:3224  (Docker container "bridalstack", Next.js standalone)
        → PostgreSQL 17 on the host (database "bridalstack", only 127.0.0.1)
```

- Server: netcup VPS, `159.195.158.36`.
- App source: `/opt/bridalstack` (extracted from this repository, no `.git` on
  the server).
- Container: `bridalstack` from `docker-compose.netcup.yml`, `network_mode: host`,
  listening on `172.18.0.1:3224`. It is not exposed to the public internet.
- Reverse proxy: Caddy container `legafetch-caddy`, config
  `/opt/legafetch/caddy/Caddyfile` (block `bridalstack.com, www.bridalstack.com`).
- Database: host PostgreSQL 17, database `bridalstack`. `DATABASE_URL` and
  `DIRECT_URL` live in `/opt/bridalstack/.env` (mode `600`).
- DNS: Hostinger. `A @ → 159.195.158.36`, `www` is a CNAME to the apex.
- TLS: Let's Encrypt, issued and renewed by Caddy.

## Release path

Run the local gates first:

```bash
npm ci --ignore-scripts
npx prisma generate
npm run lint
npm test
npm run build
npm audit --omit=dev --audit-level=high
```

Then deploy from the repository root:

```bash
scripts/deploy-netcup.sh
```

The script ships the tracked tree with `git archive` (so `.env`, `node_modules`,
`.next` and `.git` are never overwritten), rebuilds the image and recreates the
container. It finishes by probing `/api/health` and `/login`.

After every deploy verify:

```bash
curl -s https://bridalstack.com/api/health          # {"status":"ok",...}
curl -s -o /dev/null -w '%{http_code}\n' https://bridalstack.com/login
curl -s -o /dev/null -w '%{http_code}\n' https://bridalstack.com/demo
```

`GET /api/health` reports service and database health only; it never reveals
secrets or connection details. Use it for uptime checks.

Rollback: redeploy the previous commit (`git checkout <sha> && scripts/deploy-netcup.sh`).
Application rollback does not undo an applied migration.

## Database changes

Prisma migrations are committed under `prisma/migrations/`. Apply them from the
server after taking a backup:

```bash
ssh netcup 'bash /opt/nocturn-yedek/nocturn-yedek.sh bridalstack'
ssh netcup 'cd /opt/bridalstack && docker exec bridalstack npx prisma migrate deploy'
```

`DATABASE_URL` is the runtime connection and `DIRECT_URL` is used for migration
operations. Never run a destructive reset against production. Take or confirm a
backup before any migration that changes or removes data.

## Required configuration

Stored in `/opt/bridalstack/.env`:

- `DATABASE_URL`, `DIRECT_URL` — host PostgreSQL.
- `NEXTAUTH_SECRET` — mandatory; the server refuses to start in production without it.
- `NEXTAUTH_URL=https://bridalstack.com`.
- `CRON_SECRET` — bearer token for the `/api/cron/*` routes.

Optional, each feature stays disabled until its values are present:

- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — distributed rate
  limiting. Without them the limiter is process-local; acceptable on the single
  container, not a global abuse-control boundary.
- `DODO_PAYMENTS_ENVIRONMENT=live`, `DODO_PAYMENTS_API_KEY`,
  `DODO_PAYMENTS_WEBHOOK_KEY`, the four monthly `DODO_PRODUCT_*` IDs and the
  four `DODO_PRODUCT_*_ANNUAL` IDs — paid plans. Monthly and annual are gated
  independently: an interval stays closed until all four of its IDs plus the
  key and webhook secret are set. Annual prices are monthly × 10 (two months
  free). Without any set, checkout shows "Paid plans coming soon".
- `RESEND_API_KEY`, `EMAIL_FROM` — transactional email (password reset, staff
  invitations, reminders, trial notices). Without the key, sending is skipped
  and logged; nothing is delivered.
- `BLOB_READ_WRITE_TOKEN` — photo uploads (Vercel Blob). Without it the upload
  fields are disabled and the app still works.
- `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` — AI stylist. Without either, the page
  returns summary statistics instead.

Keep all values server-side. Rotate a credential immediately if it appears in
logs, source, a browser bundle or a support attachment.

## Locations (multi-shop)

A chain can run several locations. Each location is a separate tenant with its
own customers, stock, orders, team and subscription; data never crosses between
locations (the same tenant-isolation gate applies).

- The active location is stored in the `bs_tenant` cookie. It is only a
  preference: `getCurrentTenant` / `getCurrentMember` accept it only when the
  user actually has a membership in that tenant, otherwise they fall back to the
  first membership (`lib/tenant-select.ts`).
- `/locations` lists every location the user belongs to, switches the active one
  and (for non-demo accounts) creates a new one. A new location starts on the
  free plan with a 30-day trial; creating is capped at 10 owned locations per
  account and is blocked for the shared demo account.
- Billing is per location: open a location, then subscribe on `/settings`. There
  is no extra-location add-on price or multi-location discount yet.

## Scheduled jobs

The host runs `/opt/cron-tetik/tetik.py` every minute via
`/etc/cron.d/cron-tetik`. It calls the authenticated cron routes over the host
network. BridalStack jobs (all UTC):

| UTC | Route |
| --- | --- |
| 13:00 | `/api/cron/briefing` |
| 14:00 | `/api/cron/reminders` |
| 15:00 | `/api/cron/installments` |
| 16:00 | `/api/cron/trials` |

The canonical schedule lives in `ops/cron-schedule.json`; `tests/e2e/stage10`
fails if a cron route is missing from it, so a new cron cannot be added without
being scheduled.

The bearer secret is stored in `/opt/cron-tetik/secrets.env` as
`BRIDALSTACK_CRON_SECRET`. Run one job by hand:

```bash
ssh netcup 'python3 /opt/cron-tetik/tetik.py bridalstack /api/cron/reminders'
```

Each route returns `401` without the bearer token.

## Backups

BridalStack is registered in the shared backup system as
`/opt/nocturn-yedek/projeler/bridalstack.env`. `/etc/cron.d/nocturn-yedek` runs
the dump daily at 03:15; dumps are written to
`/var/backups/nocturn/bridalstack/` and kept for 30 days. A dump is only
considered good if `pg_restore -l` lists at least one table.

Run it by hand:

```bash
ssh netcup 'bash /opt/nocturn-yedek/nocturn-yedek.sh bridalstack'
ssh netcup 'tail -5 /var/log/nocturn-yedek.log'
```

Restore into a scratch database first:

```bash
ssh netcup 'sudo -u postgres createdb bridalstack_restore'
ssh netcup 'sudo -u postgres pg_restore -d bridalstack_restore --no-owner --no-acl /var/backups/nocturn/bridalstack/<file>.dump'
```

## DNS and email authentication

DNS for `bridalstack.com` is managed at Hostinger. The zone carries:

- `A @ → 159.195.158.36` (netcup) and `CNAME www → bridalstack.com`.
- `TXT @ → v=spf1 include:send.bridalstack.com include:amazonses.com ~all`.
- `TXT _dmarc → v=DMARC1; p=quarantine; adkim=r; aspf=r;`.
- Resend DKIM (`resend._domainkey`) and the `send`/`rsend` CNAMEs.
- `CAA` limited to `letsencrypt.org` and `pki.goog`.

DNSSEC is not enabled; `dns-parking.com` does not sign the zone. Adding it means
moving the zone to a DNSSEC-capable provider and publishing the DS record at the
registrar.

## Incident response

### The app is unhealthy

1. `ssh netcup 'docker ps --filter name=bridalstack'`
2. `ssh netcup 'docker logs --tail 100 bridalstack'`
3. `ssh netcup 'curl -s http://172.18.0.1:3224/api/health'`
4. If a deploy caused it, redeploy the previous known-good commit.
5. Re-check `/landing`, `/login`, `/demo` and `/api/health` afterwards.

### The database is unreachable

`/api/health` reports `dependencies.database` as not ok. Check the host cluster
(`sudo -u postgres psql -d bridalstack -c 'select 1'`), disk space and the
container's `DATABASE_URL`. Do not restart the database blindly.

### A migration fails

Stop rollout. Do not retry destructive SQL blindly. Capture the migration name
and error, confirm the latest dump in `/var/backups/nocturn/bridalstack/`, and
prepare a forward fix or restore plan.

### A credential or customer-data exposure is suspected

Disable or rotate the affected credential, preserve only the minimum privacy-safe
evidence, review provider access logs and report privately as described in
[SECURITY.md](SECURITY.md). Never paste customer records, tokens or secrets into
issues or chat.

## Known operational gaps

- Dodo and Resend credentials must be supplied by the owner before paid checkout
  and email delivery are live (see `scripts/OWNER-SETUP.md`).
- Multi-location: each location is a separate workspace (tenant) with its own
  subscription. There is no shared customer or inventory across locations and no
  multi-location discount yet, so a chain pays the normal price per location.
- Rate limiting is process-local unless Upstash is configured.
- DNSSEC is not enabled.
- There is no separate staging environment; verify locally against a scratch
  PostgreSQL database before deploying.

## Dodo canlı moda geçiş

Doğrulama onaylanınca, Dodo panelinde **canlı modda** bir API anahtarı aç, sonra:

```
DODO_PAYMENTS_API_KEY=<live anahtar> DODO_PAYMENTS_ENVIRONMENT=live \
  node scripts/dodo-setup.ts                                   # kuru çalıştırma
DODO_PAYMENTS_API_KEY=<live anahtar> DODO_PAYMENTS_ENVIRONMENT=live \
  node scripts/dodo-setup.ts --apply --out ~/.claude/.secrets/dodo-bridalstack-live.env
```

Betik 8 ürünü (fiyatlar `config/modules.ts`'ten) ve webhook'u açar, tekrar çalıştırmak güvenlidir.
Çıkan satırları + `DODO_PAYMENTS_API_KEY` prod `.env`'deki test değerlerinin yerine yaz, container'ı yeniden başlat.
`DODO_PAYMENTS_ENVIRONMENT` tam olarak `live` olmalı (`live_mode` test sayılır).

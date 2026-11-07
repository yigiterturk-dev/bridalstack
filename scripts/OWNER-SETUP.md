# Owner setup — the two remaining credentials

Everything in the code is ready; these two integrations stay disabled until the
owner supplies credentials. Production configuration lives in
`/opt/bridalstack/.env`. After editing it, redeploy with
`scripts/deploy-netcup.sh` (or `docker compose -f docker-compose.netcup.yml up -d`
on the server).

## 1. Dodo Payments (paid plans)

The billing code is complete and fail-closed: checkout stays closed until the
API key, webhook secret and **four** product IDs are all present.

```
DODO_PAYMENTS_ENVIRONMENT=live
DODO_PAYMENTS_API_KEY=          # Dodo → Developer → API Keys
DODO_PAYMENTS_WEBHOOK_KEY=      # Dodo → Developer → Webhooks → signing secret
DODO_PRODUCT_SALES=             # Dodo → Products: monthly subscription products
DODO_PRODUCT_INVENTORY=
DODO_PRODUCT_PRO=
DODO_PRODUCT_FINANCE=
```

In the Dodo dashboard:

1. **Products** — create one monthly subscription product per paid pack:
   Sales $39, Inventory $29, Pro $29, Finance $19. Copy each product ID
   (`pdt_...`) into the matching variable.
2. **Developer → API Keys** — create a live API key.
3. **Developer → Webhooks** — endpoint `https://bridalstack.com/api/dodo/webhook`,
   events `subscription.*` and `payment.*`; copy the signing secret into
   `DODO_PAYMENTS_WEBHOOK_KEY`.
4. Add all seven values to `/opt/bridalstack/.env` and redeploy.

Verify: open `/settings` while signed in; the plan selector should offer paid
packs instead of "Paid plans coming soon". Do one test purchase in Dodo test mode
before switching `DODO_PAYMENTS_ENVIRONMENT` to `live`.

Displayed prices come from `config/modules.ts`; the amount actually charged comes
from the Dodo product. When you change a price, create a new Dodo product and
update the ID, or the screen and the charge will disagree.

## 2. Resend (transactional email)

```
RESEND_API_KEY=                 # Resend → API Keys
EMAIL_FROM="BridalStack <noreply@bridalstack.com>"
```

The domain `bridalstack.com` is already verified in Resend (us-east-1) with the
DKIM/SPF/DMARC records in Hostinger DNS. Without the key, `sendEmail` does not
throw; it logs `[EMAIL SKIP]` and returns `{ sent: false, reason: "unconfigured" }`.
That affects password reset, staff invitations, installment reminders, the daily
briefing and trial notices.

After adding the key, verify with a real password reset from `/forgot-password`
and check the Resend dashboard for "delivered". Then restrict the API key to the
`bridalstack.com` domain.

## 3. Verify the deployment

```bash
curl -s https://bridalstack.com/api/health          # database ok
curl -s -o /dev/null -w '%{http_code}\n' https://bridalstack.com/login
ssh netcup 'python3 /opt/cron-tetik/tetik.py bridalstack /api/cron/reminders'
ssh netcup 'bash /opt/nocturn-yedek/nocturn-yedek.sh bridalstack'
```

Expected: `{"status":"ok","dependencies":{"database":"ok"}}`, `200`, `200` from
the cron job, and `OK bridalstack … tablo verisi` in the backup log.

## Notes

- Tenant isolation is enforced in application code (`getCurrentTenant` /
  `requireTenantId` on every query); there is no database-level RLS. The old
  Supabase SQL scripts under `scripts/` are historical and are not part of the
  current deployment.
- Automatic recurring card charging for installments is intentionally not
  implemented; installments are reminder-only (`autoChargingEnabled: false`).

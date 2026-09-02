# Portfolio evidence audit

Audit date: 2026-08-12

## Verified locally

| Gate | Result | Evidence |
| --- | --- | --- |
| Unit tests | Pass | 20/20 Node tests across RBAC, booking validation, and installments |
| ESLint | Pass | Zero errors and zero warnings |
| TypeScript / production bundle | Pass | Next.js 16.3 production build with Webpack |
| Dependency audit | Pass | `npm audit`: zero known vulnerabilities |
| Credential scan | Pass | No committed private-key blocks or live-looking service secrets found |
| Marketing claims | Pass | Unsupported customer-count and setup-time claims removed |

## Evidence-backed security properties

- Unknown roles normalize to `viewer`; billing management is owner-only.
- RLS hardening SQL adds tenant-scoped write checks and a recursion-safe helper.
- Public booking validates identifiers and ranges before persistence and rejects active-slot overlap.
- Cron execution requires a bearer secret and a server-only Supabase service role; missing configuration fails closed.
- Reminder insertion relies on a unique installment/kind constraint for deduplication.

## Not yet verified

- SQL migrations have not been applied to a fresh hosted Supabase project in this audit.
- Stripe checkout/webhook behavior has not been exercised against a live or test Stripe account.
- Resend delivery and AI-provider calls have not been exercised.
- Cross-instance rate limiting is not implemented; the current limiter is process-local.
- Staff invitation email-to-user provisioning remains a documented placeholder.
- There is no end-to-end browser suite yet.

These are production-readiness gates, not hidden claims. The repository is suitable as an auditable engineering case study; a live customer deployment should close each item above first.

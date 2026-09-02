# Security policy

## Supported version

Security fixes are applied to the latest commit on `main`.

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability. Use GitHub's private vulnerability reporting for this repository, or contact the repository owner privately through the email listed on their GitHub profile.

Include the affected route or component, reproduction steps, expected impact, and any suggested mitigation. Do not include real customer data, credentials, or destructive proof-of-concept payloads.

## Credential handling

Only variables prefixed with `NEXT_PUBLIC_` may reach browser code. Supabase service-role, Stripe, cron, Resend, and AI credentials must remain server-side and must never be committed.

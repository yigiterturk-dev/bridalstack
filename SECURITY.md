# Security policy

## Supported version

Security fixes are applied to the latest commit on `main`.

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability. Use GitHub's private vulnerability reporting for this repository, or contact the repository owner privately through the email listed on their GitHub profile.

Include the affected route or component, reproduction steps, expected impact, and any suggested mitigation. Do not include real customer data, credentials, or destructive proof-of-concept payloads.

## Credential handling

Only variables prefixed with `NEXT_PUBLIC_` may reach browser code. Supabase service-role, Stripe, cron, Resend, and AI credentials must remain server-side and must never be committed.

## Accepted dependency risk

- **`braces` stack-exhaustion DoS (CVE-2026-93687 / GHSA-vfj7-8cjw-p6xm).**
  Affects `braces <= 3.0.3`; no patched release exists upstream. Here it is
  reachable only through the lint toolchain
  (`eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` →
  `micromatch` → `braces`), which is a dev-only dependency and never ships in the
  production bundle. The glob patterns it processes come from our own ESLint
  configuration, not from request input, so it is not attacker-reachable at
  runtime. The Dependabot alert is dismissed as tolerable risk and should be
  reopened once `braces` publishes a fix.

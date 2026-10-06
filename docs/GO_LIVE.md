# Go-live status

The application pages now use Supabase Auth, Postgres, Storage, Row Level Security, database order/bill procedures, and Realtime subscriptions. The middleware validates signed-in users on owner and platform routes. The public order flow requires the random table capability embedded in the restaurant's printed QR/NFC link.

## Implemented in the project

- Restaurant signup and application with private proof-file upload
- Platform admin review, approve/reject, online/offline controls, network view, order activity, and a status audit log
- Restaurant-scoped dashboard, menu editing, food photos and bestseller/popular tags, table QR links, POS/waiter orders, live order queue, kitchen view, bills, and tax/service settings
- Customer menu, name-based multi-round table sessions, QR-bound orders, request-bill flow, tracking status, and print-ready itemized bill
- Six ordered Supabase migrations; migration 0006 adds tables, storage policies, safe workflow RPCs and audit events
- No demo users or pre-seeded restaurant/menu records

## Not configured or verified here

- No Supabase account URL/key has been supplied, so no live project or database has been connected.
- The migrations have not been applied to a Supabase project. The SQL needs to be applied and checked in staging.
- No platform administrator has been provisioned.
- No Vercel project or domain is linked, and no public deployment has been made.
- Staging acceptance, cross-tenant access verification, backup restore, and customer pilot have not been run.
- Payments, bill delivery, proof malware scanning, CAPTCHA/rate limiting, external monitoring/alerting, and formal compliance review are not included.

Use `docs/DEPLOY_VERCEL_SUPABASE.md` to finish setup. Do not onboard real restaurants until the staging acceptance checklist there is complete.

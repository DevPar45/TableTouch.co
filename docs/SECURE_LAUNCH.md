# Secure launch checklist

The feature implementation is present; a real Supabase project, administrator, and staging sign-off are still required.

## Implemented

- Supabase Auth owner and platform sign-in; middleware refreshes/validates Auth cookies on protected routes.
- Restaurant membership is enforced by Postgres RLS and server-owned security-definer workflow functions.
- Restaurant applications upload private business proof files with content-type and size caps; food photos use a separate bucket.
- Public table-order sessions require the table QR capability token; prices and item availability are read from restaurant menu records in Postgres.
- Restaurant data, menu editing, POS orders, guest sessions, kitchen statuses, bills, and service settings use Supabase rather than local browser storage.
- Supabase Realtime updates owner/platform screens; the customer status page polls the tracking RPC.
- Application decisions and service-state changes create platform audit events.

## Required before live customer use

- [ ] Apply migrations 0001–0006 in a new staging project and resolve any SQL errors.
- [ ] Provision a platform-admin account and verify a normal restaurant owner cannot access `/platform`.
- [ ] Verify tenant isolation with two owners and direct REST/Storage access attempts, including mutations and signed proof links.
- [ ] Verify table QR secrets are only exposed to restaurant members and not through anonymous views, HTML, or public API queries.
- [ ] Verify Supabase Auth email confirmation, password recovery, session expiry, allowed redirect URLs, and account closure.
- [ ] Add CAPTCHA or equivalent signup abuse protection and rate-limit public session/order endpoints; monitor abuse.
- [ ] Add upload malware scanning, documented retention/deletion, and support procedures for sensitive business documents.
- [ ] Verify retries, simultaneous orders, session limits, closed sessions, offline service, invalid QR tokens, and database timeouts.
- [ ] Verify menu/order/bill totals with the restaurant's actual applicable tax rules; have an appropriate adviser review service-charge and invoice behavior.
- [ ] Verify realtime status changes on separate devices, printer output, and backup restore.
- [ ] Configure database backups, log retention, uptime alerts, incident response, privacy notice and terms.
- [ ] Run the full two-restaurant staging checklist in `docs/DEPLOY_VERCEL_SUPABASE.md` and record the outcome before production.

## Known boundaries

The admin audit log records application and service-status transitions; it is not a full immutable compliance log. Bill line changes are tenant-authorized but are not revision-audited. No card/UPI payment, SMS/email bill delivery, automated proof verification, or support ticketing integration is provided.

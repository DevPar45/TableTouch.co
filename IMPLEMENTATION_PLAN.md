# TableTouch implementation plan

Last audited: 2026-10-18
Audited branch: `feature/tabletouch-upgrade`
Audited commit: `5760b19` (with uncommitted hotel guest-service work under review)

## Audit scope and evidence

This audit covered the Next.js source under `src/`, all committed Supabase migrations, package and deployment configuration, the repository Git state, and the connected Vercel project.

- Vercel project: `table-touch-co` (`Next.js`, Node.js 24.x).
- Latest production deployment: `c1bd256`, status `READY`.
- Production domain: `https://tabletouch.vercel.app` (verified).
- Vercel found no grouped runtime-error clusters in the last seven days. The account's log-retention window prevented a seven-day raw runtime-log read.
- The Vercel project has the two public Supabase environment-variable names used by this application, but their values and the actual Supabase database state are not exposed by this audit.
- No automated test suite or CI workflow exists in the repository. `package.json` has build, dev, start, and lint scripts only.
- `.env.local` is not present in this workspace. Supabase, Razorpay, deployed route, payment, and tenant-isolation runtime checks are therefore blocked here; no secret values were read or exposed.
- `npx tsc --noEmit` and `git diff --check` passed after the current hotel guest-service changes. The current local production build is blocked by generated-folder permissions in this OneDrive workspace; see the verification table. `npm run lint` opened the unconfigured Next.js ESLint setup prompt, so lint is blocked until a project ESLint configuration is added.

## Current architecture

| Area | Implementation |
| --- | --- |
| Frontend | Next.js 14 App Router, React 18, TypeScript, client-side pages |
| Styling | Repository CSS files plus Tailwind/PostCSS configuration; no component-library dependency |
| Authentication | Supabase Auth using `@supabase/ssr`, browser client, middleware session refresh, and an email/PCKE callback route |
| Database | Supabase Postgres with thirteen ordered SQL migrations and Row Level Security |
| File storage | Supabase Storage: private `business-proofs`; public `restaurant-assets` with tenant-scoped write policies |
| Realtime | Supabase Postgres Changes for owner order, table, and dining-session refreshes; customer tracking/session pages poll |
| Deployment | GitHub `main` to Vercel production; no `vercel.json` or GitHub Actions workflow |
| Payments | Razorpay server order creation, signed webhook verification, persisted payment records, and captured-payment receipts; provider credentials and live verification remain required |

## Feature inventory

### Implemented in source (requires Supabase migrations and configuration)

- Restaurant registration with email verification, private legal-proof uploads, review state, initial categories, branch, and table records.
- Platform-admin sign-in, restaurant approval/rejection, service-status controls, private proof links, and audit events.
- Restaurant owner workspace with menu/category management, food-image upload, billing settings, QR links, table management, POS/waiter/counter orders, kitchen queue, order-status workflow, named dining sessions, bill review, printing, and closing/reopening bills.
- Dynamic public restaurant menus, table QR/NFC capability links, customer cart, customer named dining session, server-priced order RPCs, bill request, table service call, and random-token order tracking.
- Multi-tenant tables, foreign keys, RLS, price calculation inside Postgres procedures, idempotency keys, and protected private proof storage.
- Hotel foundation: an additive business type, distinct room records, hotel-safe public profile/room views, manager-protected room QR/NFC lifecycle controls, hotel owner room inventory, a public room information page without guest data, and unified restaurant/hotel onboarding.
- Hotel guest service: a room-token-verified request RPC with idempotency and rate limits, privacy-safe guest tracking, realtime hotel staff queue, and server-enforced acknowledgement, progress, completion, and manager-only cancellation transitions.
- Hotel room service: room-token-verified, server-priced menu orders with menu snapshots, idempotency, tracking, staff delivery transitions, and explicit staff-mediated payment/room-charge handling.

### Partially implemented or needs verification

- Supabase Auth is implemented, including the recent callback/session repair, but email templates, redirect allow-lists, and real production sign-in must be verified in the connected Supabase project.
- Realtime owner updates are implemented. They need a staged two-restaurant test with Realtime enabled in the actual project.
- Bills calculate and persist final amounts. They are not payments, tax invoices, or fiscal receipts.
- QR code rendering works in the owner interface. Physical QR printing and NFC-tag programming require real-device validation.
- Restaurant branding, contact details, colours and public menu images can be managed from the owner workspace.

### Missing

- Refund handling and reconciliation reporting after a provider account is connected and its live event payloads are verified.
- Reservations, analytics/reporting, CSV/PDF exports, subscription billing, and restaurant staff invitation/management UI.
- Staff invitation and management UI. The forward-only role migration protects configuration, orders and bills, but needs to be applied and verified before staff accounts are issued.
- Automated unit, integration, tenant-isolation, and end-to-end tests; CI quality gates; error tracking/monitoring integration.
- Customer-facing final-bill/receipt delivery by email, SMS, WhatsApp, or payment link.
- Hotel room-service billing, reservations, notifications, reporting, and a staff invitation/assignment management interface.

### Known risks and defects found

1. **P0 — public data over-fetching:** the root client store queried every online restaurant and every published menu item for an anonymous menu visitor. This leaks publicly visible but unrelated restaurant data into the visitor's browser and will not scale. Fixed in the current working tree by loading only the restaurant named in the current public route.
2. **P0 — table preview lost its capability:** one owner-facing “Open QR menu” link omitted `table_token`, leaving the opened page read-only. Fixed in the current working tree.
3. **P1 — role permissions:** migration `0007_role_permissions.sql` defines owner, manager and staff access, but it is not confirmed on the connected Supabase project yet. Do not add staff accounts before staged verification.
4. **P1 — no rate limiting or bot protection:** registration, password reset, guest-session creation, and public order RPCs rely on Supabase/database validation only. Configure Supabase Auth rate limits and CAPTCHA, then add application-level controls where the real traffic pattern needs them.
5. **P1 — payment credentials required:** payment code is present, but no bill can be marked paid until Razorpay credentials, webhook secret, migration `0009`, and a verified provider delivery are configured.
6. **P1 — migration state unknown:** source migrations exist but this audit could not independently inspect the connected Supabase database to confirm migrations `0001` through `0013` are applied.
7. **P2 — no structured test coverage:** source and build checks cannot prove tenant isolation, storage policies, migration behavior, or production authentication.
8. **P2 — project linting is not configured:** `npm run lint` opens an interactive setup prompt and cannot validate source until an ESLint configuration and dependency are committed.

## Prioritised implementation checklist

### Stage 1 — audit and launch blockers

- [x] Inspect repository, database migrations, routes, environment-variable references, Git state, and Vercel project.
- [x] Add this persistent implementation plan.
- [x] Stop anonymous visitors from loading unrelated restaurants' menus.
- [x] Preserve the QR/NFC table capability when the owner opens a table menu.
- [x] Add an owner/manager/staff permission model to RLS and security-definer procedures in forward-only migration `0007_role_permissions.sql`.
- [ ] Apply and verify migrations `0007_role_permissions.sql` and `0008_table_service_requests.sql` against owner, manager, staff, platform-admin, guest-session, and cross-restaurant accounts in staging.
- [ ] Add a safe staff-membership management interface after permission enforcement is in place.
- [ ] Verify migrations, Auth redirect URLs, Storage buckets/policies, and Realtime publication in a non-production Supabase project.

### Stage 2 — restaurant settings and operational readiness

- [x] Implement restaurant branding/contact/opening-hours settings with image validation and tenant-safe uploads.
- [x] Add ability to rotate a table QR/NFC token and pause/re-enable individual tables without changing the stable restaurant/table route.
- [ ] Add owner-friendly empty/error states where a database setup step is incomplete.
- [x] Add service-request/waiter-call data model, live owner queue, guest trigger, and staff acknowledgement/resolution workflow.

### Stage 3 — money and reporting

- [x] Add Razorpay server order creation, payment/event persistence, signed webhook verification, idempotent event processing, and receipt creation on a verified capture.
- [x] Add the TableTouch commercial service catalogue and persist a restaurant's selected plan during onboarding. Plans are quoted and activated after review; no subscription charge is simulated.
- [ ] Configure Razorpay credentials and complete an actual staging capture plus webhook-delivery verification. Do not treat a browser redirect as a paid transaction.
- [ ] Add refund processing and reconciliation after the provider's actual event payloads are verified.
- [ ] Add receipt delivery integration only after payment collection is verified.
- [ ] Add tenant-scoped analytics and CSV export sourced from persisted completed orders/payments.

### Stage 4 — customer and restaurant product expansion

- [ ] Add reservations with time-slot capacity and conflict prevention.
- [ ] Add configurable menu themes and complete public branding.
- [ ] Add accessible table/QR print layouts and real-device QR/NFC acceptance testing.

### Stage 5 — quality, security, and release controls

- [x] Replace the client-wide generic failure message with clear session, network, permission, and migration guidance. Optional hotel reads now fail independently so an unapplied hotel migration cannot block the restaurant workspace.
- [x] Strengthen restaurant, registration, and platform sign-in flows by using the session returned by Supabase directly, checking workspace access before redirecting, and showing clear account-role guidance.
- [x] Separate owner-account creation, verification-email resend, password sign-in, and password recovery paths so unconfirmed and incorrect-password states receive clear recovery guidance.
- [x] Remove decorative emoji glyphs from the customer-facing UI and replace them with SVG/CSS marks that render consistently on mobile devices.
- [x] Repair the Vercel/Supabase variable-name mismatch: browser-safe Supabase configuration now accepts the connected integration's standard URL and publishable/anon-key names, while server secrets remain private.
- [x] Refresh the public landing story around the implemented QR/NFC → named order → kitchen → final-bill workflow, with an original heritage restaurant visual direction and phone-responsive flow cards.
- [x] Split the public product story into focused, mobile-responsive routes for the service flow, restaurant tools, QR/NFC table cards, and service plans. Added a branded route-recovery screen so unexpected render failures never show Next.js's generic error copy.
- [ ] Add database/RPC integration tests for registration, public ordering, idempotency, bill totals, and two-tenant isolation.
- [ ] Add browser tests for mobile public ordering, owner workflow, order tracking, and access controls.
- [ ] Add CI checks for type checking, build, migrations, and tests before production promotion.
- [ ] Add error monitoring, backup/restore verification, retention/privacy policy, and a restaurant pilot runbook.

### Stage 6 — multi-business and hotel foundation

- [x] Preserve existing restaurant records and add an additive `business_type` model without repurposing restaurant tables.
- [x] Add tenant-scoped hotel rooms with stable QR/NFC capability tokens, public-safe room lookup views, RLS, realtime publication, and owner/manager controls.
- [x] Add a public `/hotel/<slug>/room/<room>` page that never reveals occupancy, guest, stay, room-bill, or internal operations data.
- [x] Add unified restaurant/hotel onboarding that calls `register_hospitality_business` with validated property currency, time zone, welcome message, and initial room count.
- [x] Add room-service order tables, server-priced menu snapshots, room-token validation, idempotency, guarded delivery transitions, privacy-safe tracking, and a hotel staff queue. Payment and room charges remain staff-mediated.
- [x] Add hotel guest-service requests with QR/NFC room-token validation, idempotency/rate controls, safe tracking, server-enforced transitions, realtime hotel queue, and hotel dashboard actions.
- [ ] Add hotel reporting, authorised payment workflows, and staff-mediated room charges only after a verified stay/PMS integration is available.

## Core workflow implementation status

The source implementation uses Supabase Auth, Postgres procedures, Storage and Realtime for every workflow below. The final staging test remains blocked until the connected project's migration state and test accounts are available.

- [x] Restaurant-owner and platform-admin authentication guards backed by Supabase Auth and membership/admin RLS checks, with role-aware owner, manager and staff workspace navigation.
- [x] Restaurant onboarding with authenticated registration, private proof uploads and platform review.
- [x] Dynamic public restaurant menus scoped to the requested restaurant slug.
- [x] Tenant-scoped menu/category editing and public food-image uploads.
- [x] Stable `/r/<slug>/table/<number>` QR and NFC destinations with an unguessable table capability token.
- [x] Owner controls to copy, rotate, pause and resume a table destination through Supabase procedures.
- [x] Named guest dining sessions, cart submission, database-priced orders and idempotency keys.
- [x] Tenant-scoped restaurant order, kitchen and bill workspaces backed by Postgres and Realtime.
- [x] Customer order tracking using a separate random tracking token and backend status endpoint.
- [x] Secure guest service calls tied to the dining-session token, with a realtime restaurant response queue.
- [ ] Execute the full two-restaurant staging acceptance flow against the connected Supabase project.

## Restaurant operations module checklist

- [x] Kitchen display: persisted order queue, guarded status transitions, live owner updates, and customer tracking links.
- [x] Table management: stable table destinations, protected QR/NFC rotation, pause/resume, and table-specific sessions.
- [x] Waiter and service requests: persisted POS/waiter orders plus guest service calls and a live staff response queue.
- [x] Payment foundation: Razorpay server order creation, payment/event persistence, HMAC verification, idempotent webhook handling, and receipts after verified capture.
- [x] Billing and browser receipts: database-calculated final bills, controlled edits, final totals, and printable itemised output.
- [x] Thermal-print readiness: browser print CSS is provided; validate the actual printer driver, paper width, margins, and cash-drawer setup on the restaurant device.
- [ ] Reservations: data model, capacity controls, public booking flow, and restaurant schedule have not been implemented.
- [ ] Sales analytics: persisted-report queries and owner reporting screens have not been implemented.
- [x] Staff permissions: owner/manager/staff backend controls and role-aware workspace navigation are implemented. A safe invitation/management interface remains pending.
- [ ] Subscription management: no subscription business model, provider, or entitlement rules exist in the repository, so no subscription workflow has been added.

## Current verification status

| Area | Status | Evidence / limitation |
| --- | --- | --- |
| Type checking | Verified | `npx tsc --noEmit` passed after the public experience route changes. |
| Source whitespace | Verified | `git diff --check` passed. |
| Lint | Blocked | `npm run lint` opens Next.js's ESLint configuration prompt; no committed ESLint config exists. |
| Production build | Blocked locally | The current source compiled successfully during `next build`, but Windows denied generated-folder operations in the OneDrive workspace. A temporary-folder retry then failed resolving Next's generated type imports because sandbox policy denied a required `node_modules` junction. Verify the final build in Vercel Preview or a non-synced local folder. |
| Supabase migrations/RLS | Blocked | No linked project or local environment credentials are available to apply or query migrations. |
| Restaurant runtime flows | Blocked | Requires a staging Supabase project, real test accounts, and an approved online restaurant. |
| Hotel runtime flows | Partially implemented / blocked | Onboarding, room QR/NFC destinations, guest-service and room-service ordering/tracking queues are source-checked only. Real database and device validation is still required; payment and room charges remain staff-mediated. |
| Razorpay capture/webhook | Blocked | Requires server-only credentials and a real signed staging webhook delivery. |
| QR/NFC/thermal hardware | Blocked | Requires physical phones, programmed NFC tags, a printer driver, and target printer. |

## Manual configuration still required

1. In Supabase Auth, set the Site URL to `https://www.tabletouch.in`, add `https://www.tabletouch.in/auth/callback` and `https://www.tabletouch.in/auth/reset-password` to Redirect URLs, and configure a verified SMTP sender before relying on Gmail verification or password-recovery delivery.
2. Apply migrations `0001_core.sql` through `0014_service_plan_selection.sql` in order to a staging project before applying them to production. Confirm buckets, policies, Realtime tables, the public hotel views, hotel service-request procedures, room-service procedures, and service-plan fields afterward.
3. For live Razorpay payments, configure `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` only in Vercel's server environment. Register `/api/payments/razorpay/webhook` as the Razorpay webhook URL. None of these values belong in `NEXT_PUBLIC_*` variables.
4. Create the first authenticated platform-admin user and add that user's UUID to `public.platform_admins` through a controlled SQL session.
5. Confirm Vercel has `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in both Production and Preview. Do not expose a service-role key in any `NEXT_PUBLIC_*` variable.
6. Test QR/NFC tags on physical phones and run two independent restaurant accounts through the isolation checklist before onboarding customers.

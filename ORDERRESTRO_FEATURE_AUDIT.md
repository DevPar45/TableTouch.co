# TableTouch POS capability audit

Audited: 2026-10-26  
Reference: `Raktim94/nodedr-restaurant-pos` (public project, AGPL-3.0)

## Compatibility decision

TableTouch remains a Next.js + Supabase multi-tenant SaaS. The reference is a self-hosted NestJS/Next.js/Postgres/Prisma/Socket.IO POS. Its source will **not** be copied or transplanted: its AGPL-3.0 licence and architecture are incompatible with simply importing code into this commercial hosted product. This roadmap takes only product-level inspiration and creates original TableTouch implementations.

## What TableTouch already has

- Restaurant onboarding, Supabase authentication, RLS tenant isolation and owner/manager/staff permissions.
- Stable table routes that work for QR and NFC, named guest dining sessions, server-priced carts, customer order tracking and table-service requests.
- Owner POS, table status, kitchen queue, menu manager, billing review, printing CSS and restaurant settings.
- Razorpay order/webhook source integration, persisted receipt/payment records, but live use is blocked until credentials and a provider verification are completed.

## Gaps selected from the reference product map

| Priority | Original TableTouch capability | Status |
| --- | --- | --- |
| 1 | Reservation lifecycle with a private restaurant schedule and table assignment | Implemented in migration `0015` and `/restaurant/reservations`; database migration still must be applied. |
| 2 | Table floor plan, transfer/merge and capacity-aware conflict checking | Next; requires a deliberate visual floor-model and allocation rules. |
| 3 | Menu modifiers, combinations, allergens and recipe notes | Planned; data model first, then POS/menu validation. |
| 4 | Inventory, purchase orders, suppliers, waste and recipe deduction | Planned; must be built around verified restaurant inventory practices. |
| 5 | Customer profiles, loyalty and feedback | Planned; requires consent, retention policy and Indian privacy review. |
| 6 | Staff invitations, PIN clock-in and attendance | Existing roles are secured; staff-management UI remains next. |
| 7 | Sales, tax, item and staff reporting with exports | Planned; only completed persisted data will be reported. |
| 8 | Hardware: thermal printers, cash drawer, KDS station routing and offline mode | Requires device/browser and pilot-restaurant validation; not represented as complete until physical tests pass. |

## Delivery order

1. Apply migration `0015_restaurant_reservations.sql` in a staging Supabase project and test two separate restaurant accounts.
2. Add reservation conflict warnings plus a table floor plan.
3. Add structured modifiers/allergens and server-side line-item validation.
4. Add original inventory and reporting modules with migration and role tests.
5. Add staff invitation management, then pilot printing/NFC and payment hardware.

## Verification rule

No payment, QR/NFC hardware, email/SMS notification, or report is described as live until it has been verified using the connected provider and a real test device/account. The implementation must keep every database query and mutation scoped by `restaurant_id` and protected by RLS.

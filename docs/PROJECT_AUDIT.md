# Project deployment audit

Audit date: 2026-10-04

## Current code state

- Landing page is public and has working restaurant application and sign-in links.
- There are no seeded restaurants, sample menus, demo passwords or platform access codes.
- Restaurant and platform identity use Supabase Auth; protected paths are checked in Next.js middleware and data access is constrained by RLS.
- Application proofs are uploaded to a private bucket; food photos use a separate public bucket with tenant-scoped writes.
- Guest ordering is bound to the table capability in printed QR/NFC URLs and database menu prices.
- Owner pages use backend data and tenant-filtered Realtime for restaurant-scoped operations.
- Platform operations include application review, restaurant status, order activity, and an audit record for application/service changes.
- No payment provider or bill-delivery integration is connected.

## Not verified against an account

- The six migrations have not been applied to staging or production Supabase.
- No Vercel project, domain, Supabase URL/key, or platform administrator is linked.
- Build and type-check are local source checks only; they do not prove PostgreSQL migration behavior or tenant isolation.
- Two-tenant security checks, storage access checks, production backups/restore, and acceptance on real devices still need to be run in staging.

See `docs/GO_LIVE.md`, `docs/SECURE_LAUNCH.md`, and `docs/DEPLOY_VERCEL_SUPABASE.md` before accepting a real restaurant or customer order.

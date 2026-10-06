# Tabletouch

Tabletouch is a multi-restaurant QR/NFC menu and ordering app built with Next.js 14, Supabase Auth, Postgres, Storage, and Realtime.

## Current state

- No demo restaurants, seeded menu items, demo credentials, or local browser order store are used.
- Restaurant owners can register and upload business proof after Supabase is configured.
- New restaurants start offline and require platform-admin document review before guests can order.
- Owner and platform pages use Supabase Auth, tenant-scoped RLS, and database procedures.
- Customer orders are bound to table QR capabilities, restaurant-side menu prices, and named dining sessions.
- Kitchen/order updates use Supabase Realtime; guest tracking polls the capability-token endpoint.
- Restaurant pages use `/r/<restaurant-slug>`; table QR/NFC links use `/r/<restaurant-slug>/table/<number>?table_token=<private-table-token>`.

This is a staging-ready implementation. It is not a payment processor and still needs the staging checks and operational setup listed in `docs/DEPLOY_VERCEL_SUPABASE.md` before a public customer pilot.

## Local setup

1. Create a Supabase project and apply SQL migrations `0001_core.sql` through `0006_app_workflows.sql`, in numerical order.
2. Copy `.env.example` to `.env.local` and set the project URL and publishable key.
3. Add `http://localhost:3000/register` to Supabase Auth's allowed redirect URLs.
4. Run `npm install`, then `npm run dev`.

Never add a Supabase secret/service-role key to `NEXT_PUBLIC_*`, source code, or a client bundle. The browser publishable key is expected to be public; table access is enforced by database permissions and RLS.

## Main routes

- `/register` — owner account and verified restaurant application
- `/restaurant/login` — restaurant-owner sign in
- `/restaurant/dashboard`, `/restaurant/menu`, `/restaurant/tables`, `/restaurant/orders`, `/restaurant/kitchen`, `/restaurant/bills`, `/restaurant/billing-settings`, `/restaurant/pos` — isolated restaurant workspace
- `/platform/login` and `/platform` — platform administrator review and operations
- `/r/<slug>` — public restaurant menu
- `/r/<slug>/table/<number>?table_token=...` — table QR/NFC menu and ordering
- `/order/<tracking-token>` — order tracking

## Supabase and Vercel deployment

Follow [docs/DEPLOY_VERCEL_SUPABASE.md](docs/DEPLOY_VERCEL_SUPABASE.md) for migrations, Auth redirects, first platform-admin setup, Vercel preview deployment, and production promotion.

## Important boundaries

- Restaurant proof files are private and short-lived signed links are shown only in the admin workspace.
- Food photos are public menu assets; restaurant members control writes to their own asset folder.
- A physical table QR token is required to start a guest order session. Bare guessed table URLs remain read-only.
- No customer payment, SMS/email bill delivery, malware scanning, formal invoicing, or commercial monitoring integration is included.
- Staging acceptance, backups/restore, privacy and tax review, and production support procedures remain required before a live multi-restaurant rollout.

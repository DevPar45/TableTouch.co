# Deploy Tabletouch to Supabase and Vercel

This project is wired to Supabase, but it is not connected to an account yet. The steps below create the database, make the first platform administrator, deploy a Preview, and then promote only after the staging checks pass.

## 1. Create separate Supabase projects

Create a **staging** Supabase project first. Create a separate **production** project when the staging pilot passes. Keep their database, Auth, Storage, and publishable keys separate. For India-first customers, choose an available region close to your restaurants and verify the region and backup options in the Supabase dashboard.

In the Supabase project dashboard, open **SQL Editor**. Run these files in order, one at a time, and wait for each to finish successfully:

1. `supabase/migrations/0001_core.sql`
2. `supabase/migrations/0002_onboarding_and_platform_admin.sql`
3. `supabase/migrations/0003_guest_sessions_and_billing.sql`
4. `supabase/migrations/0004_menu_discovery_metadata.sql`
5. `supabase/migrations/0005_staff_order_sources.sql`
6. `supabase/migrations/0006_app_workflows.sql`
7. `supabase/migrations/0007_role_permissions.sql`
8. `supabase/migrations/0008_table_service_requests.sql`
9. `supabase/migrations/0009_payments_and_receipts.sql`

Migration 0006 creates the private `business-proofs` bucket, the public `restaurant-assets` bucket with restaurant-scoped write policies, secure table-order procedures, admin review operations, and an operations audit log. Migration 0007 enforces owner/manager/staff operational permissions and adds protected QR/NFC table-link rotation and pause/resume procedures. Migration 0008 adds secure guest service calls and the restaurant's realtime response queue. Migration 0009 adds Razorpay payment records, signed-webhook event storage, and receipts created only after capture. Keep `business-proofs` private. Never make proof files public.

## 2. Configure Supabase Auth

In **Authentication → URL Configuration**:

- Set the Site URL to the eventual production HTTPS URL.
- Add `http://localhost:3000/register` for local email confirmation.
- Add `http://localhost:3000/auth/reset-password` for local password recovery.
- Add the staging Vercel URL ending in `/register`.
- Add the staging Vercel URL ending in `/auth/reset-password`.
- Add the final production URL ending in `/register`.
- Add the final production URL ending in `/auth/reset-password`.
- Keep email confirmation enabled for owner accounts and configure the confirmation email template.

For Vercel Preview branches, add the exact preview URLs you intend to use or a carefully scoped Vercel preview wildcard supported by Supabase. Do not add a broad wildcard for unrelated domains.

The first platform administrator must be provisioned manually. Create the administrator user in **Authentication → Users**, copy that user's UUID, then run this in the SQL Editor (replace the UUID):

```sql
insert into public.platform_admins (user_id)
values ('00000000-0000-0000-0000-000000000000')
on conflict do nothing;
```

Use `/platform/login` with that account. Do not expose an admin signup link or reuse a restaurant owner's account as the platform operator.

## 3. Configure local development

Copy `.env.example` to `.env.local` and enter the staging project values from Supabase **Connect** or **Settings → API Keys**:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

The publishable key is designed for browser applications; database RLS still decides what each user can access. Do not use a Supabase `sb_secret_...` or legacy service-role key in this app's public environment. Add `.env.local` to your local machine only; it is ignored by Git/Vercel CLI.

From the project folder run:

```powershell
npm install
npm run build
npm run dev
```

Open `http://localhost:3000`. Submit a restaurant application with a real test account and business proof. The registration page creates eight table QR links by default. A platform administrator reviews the application at `/platform`; approval keeps the restaurant offline until its owner finishes the menu and turns service online.

## 4. Deploy a Vercel Preview

Vercel can deploy this folder directly from its CLI; a GitHub repository is optional. If you prefer automatic deployments on each push, create a **private** Git repository and import it instead.

1. Install/use the Vercel CLI and sign in:

   ```powershell
   npx vercel login
   ```

2. From the project folder, link it to the correct Vercel account/team:

   ```powershell
   npx vercel link
   ```

3. In **Vercel → Project → Settings → Environment Variables**, add these two variables to **Preview** and **Development**, pointing at the staging project:

   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

   For a Razorpay-enabled Preview, also add these **server-only** variables: `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET`. Do not prefix them with `NEXT_PUBLIC_`. Redeploy after changing environment variables.

4. Deploy a Preview:

   ```powershell
   npx vercel deploy
   ```

5. Add the Preview URL to Supabase Auth's allowed redirects. Sign up a restaurant owner, verify email, submit proof, sign in as the platform admin, review the submission, complete the menu, take the restaurant online, and run the staging checks below.

Vercel's deployment process detects Next.js automatically. Use the generated Preview URL while you test; avoid `--prod` until staging has passed.

## 5. Production variables and domain

After the staging pilot is accepted:

1. Apply the same nine migrations to the separate production Supabase project.
2. Provision the production platform administrator in that project's `platform_admins` table.
3. Add the production Supabase URL and publishable key to Vercel's **Production** environment only.
4. Add the final HTTPS domain `/register` to Supabase Auth's allowed redirects and set the Site URL.
5. Connect the domain to Vercel and confirm HTTPS is active.
6. Deploy:

   ```powershell
   npx vercel deploy --prod
   ```

7. Open `/platform` to confirm the database connection, then register a controlled pilot restaurant and generate table QR links only after the final domain and restaurant slug are stable.

Vercel documents direct CLI Preview and Production deployment and project environment separation in its [CLI deployment guide](https://vercel.com/docs/projects/deploy-from-cli) and [environment variables guide](https://vercel.com/docs/projects/environment-variables). Supabase explains why a publishable key is safe for browser code only when RLS is correctly configured in its [API keys guide](https://supabase.com/docs/guides/getting-started/api-keys).

## 6. Staging acceptance checklist

Use two restaurant owner accounts, two restaurants, two phones, and separate browser sessions. Verify:

- Account confirmation and sign-in work; a normal owner cannot open `/platform`.
- Restaurant A cannot see or update restaurant B's menus, tables, orders, bills, or proof files.
- Applications require at least one proof upload; proof files cannot be opened from a public URL.
- An unapproved or offline restaurant has no public ordering menu.
- A table link without its QR token can view the menu but cannot start an order session.
- Table 02's QR creates a Table 02 order, calculates the server-side price, and appears in the correct restaurant's dashboard and kitchen queue.
- Pause Table 02 and confirm its QR/NFC tag cannot start a new session; resume it and confirm the same physical tag works again. Rotate its capability and confirm only the newly copied QR/NFC URL can start a new session.
- Repeated order submission after a network retry does not create a duplicate.
- Order status changes appear on a guest's tracking link.
- A named table session accepts multiple order rounds and one final bill; the owner can correct lines, apply the configured tax and service-charge rates, print, and close it.
- A guest can use Call staff from a live table session; restaurant staff acknowledge or close the request from the dashboard.
- POS/waiter orders use the same tenant-scoped queue and table bill.
- Restaurant service can be taken offline; no table accepts orders while offline.
- Restore a staging backup and check the Vercel and Supabase logs before moving to production.

## 7. Remaining production operations

This repository does not include payment processing, bill SMS/email delivery, malware scanning for uploaded proofs, automated legal/tax review, an external uptime/alerting provider, or a tested backup restore. Configure Supabase backups/retention, owner account recovery, CAPTCHA/rate limiting for public signup and QR order endpoints, a privacy policy/terms, and restaurant support procedures before opening broadly across India. Treat the audit log as an operational record, not a full compliance/audit platform.

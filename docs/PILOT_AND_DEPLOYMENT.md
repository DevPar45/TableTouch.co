# Pilot and deployment

The Vercel/Supabase workflow and exact setup steps are in [`DEPLOY_VERCEL_SUPABASE.md`](DEPLOY_VERCEL_SUPABASE.md).

## Suggested rollout

1. Deploy a Preview connected to a staging Supabase project.
2. Create one platform admin and two controlled test restaurants.
3. Run the full two-device/two-tenant acceptance checklist before adding real diners.
4. Pilot with a small number of willing restaurants while they keep their existing order process available.
5. Review each final bill and compare it with the existing POS until the tax, service charge, table sessions and printing match the restaurant's requirements.
6. After written staging sign-off, apply migrations to a separate production project, set Vercel Production values, set the HTTPS domain in Supabase Auth, and deploy with `npx vercel deploy --prod`.

## Important constraints

- Preview and Production environment variables should point to different Supabase projects.
- New restaurants are offline until a platform admin approves them.
- Public table orders require the capability token in that table's QR/NFC link.
- This app does not process payments, deliver bills by SMS/email, or provide formal tax/legal validation.
- Set up backup and restore, privacy terms, proof-file retention, abuse controls, monitoring and a support owner before a public launch.

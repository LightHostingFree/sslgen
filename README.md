SSL Certificate Platform (Next.js + ACME DNS-01 + acme-dns + Clerk-ready env config)

Features:
- Register/Login API secured with `CLERK_SECRET_KEY`
- User-scoped certificate dashboard
- ACME DNS-01 workflow using acme-dns (`ACMEDNS_BASE`)
- Domain registration endpoint that returns required CNAME record
- Certificate generation endpoint (status: `pending`, `active`, `expiring`, `expired`)
- Stored data (PostgreSQL via Prisma):
  - Users
  - Certificates
  - acme-dns credentials
  - Expiry and PEM data

Setup guide:
1. Install dependencies:
   - `npm install`
2. Ensure required environment variables are configured in your deployment platform/runtime:
   - `CLERK_SECRET_KEY`
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `ACMEDNS_BASE`
   - `ACME_DIRECTORY`
   - `POSTGRES_PRISMA_URL`
3. Initialize the database schema:
   - `npx prisma db push`
4. Start development server:
   - `npm run dev`
5. Deploy to Vercel:
   - Create a new Vercel project connected to this repository.
   - Add runtime environment variables in Vercel Project Settings:
     - `POSTGRES_PRISMA_URL`
     - `CLERK_SECRET_KEY`
     - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
     - `CERT_ENCRYPTION_KEY`
     - `ACME_DIRECTORY`
     - `ACMEDNS_BASE` (defaults to `https://acme.getfreeweb.site` when unset)
     - `SENTRY_DSN`
     - `NEXT_PUBLIC_SENTRY_DSN`
     - `SENTRY_AUTH_TOKEN`
   - Redeploy after setting environment variables.

Environment variables:
- `CLERK_SECRET_KEY` (required): backend auth secret key.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (frontend): Clerk publishable key exposed to browser.
- `NEXT_PUBLIC_APP_URL` (frontend): base URL for the app.
- `ACMEDNS_BASE` (required): acme-dns API base URL.
- `ACME_DIRECTORY` (required): ACME directory URL.
- `POSTGRES_PRISMA_URL` (required): Prisma PostgreSQL connection URL.
- `BCRYPT_ROUNDS` (default: `12`): password hashing cost.
- `CERT_ENCRYPTION_KEY` (required): used for AES-256-GCM encryption of certificate and acme-dns secrets at rest.
- `DNS_PROPAGATION_DELAY_MS` (default: `20000`): wait time before ACME validation.
- `CERT_VALIDITY_DAYS` (default: `90`): used to calculate certificate expiry date in app state.
- `EXPIRING_THRESHOLD_DAYS` / `RENEWAL_THRESHOLD_DAYS` (default: `14`): thresholds for dashboard status and renew checks.
- `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` (optional): enables Sentry error reporting.
- `SENTRY_TRACES_SAMPLE_RATE` (default: `0`): Sentry tracing sample rate.
- `SENTRY_AUTH_TOKEN` (optional): enables source map uploads for Sentry releases during `next build`.

Sentry setup command (local):
- `npx @sentry/wizard@latest -i nextjs --saas --org is-cool-me --project sslgen`

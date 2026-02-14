SSL Certificate Platform (Next.js + ACME DNS-01 + acme-dns)

Features:
- Register/Login using JWT + bcrypt password hashing
- User-scoped certificate dashboard
- ACME DNS-01 workflow using acme-dns (`https://acme.getfreeweb.site/`)
- Domain registration endpoint that returns required CNAME record
- Certificate generation endpoint (status: `pending`, `active`, `expiring`, `expired`)
- Stored data (SQLite via Prisma):
  - Users
  - Certificates
  - acme-dns credentials
  - Expiry and PEM data

Setup guide:
1. Install dependencies:
   - `npm install`
2. Create `.env.local` in the project root:
   - `JWT_SECRET=replace-with-a-long-random-secret`
   - `ACMEDNS_BASE=https://acme.getfreeweb.site`
3. Initialize the local SQLite database:
   - `npx prisma db push`
4. Start development server:
   - `npm run dev`

Environment variables:
- `JWT_SECRET` (required): Secret for signing auth tokens. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
- `ACMEDNS_BASE` (default: `https://acme.getfreeweb.site`): acme-dns API base URL.
- `ACME_DIRECTORY` (default: Let's Encrypt staging `https://acme-staging-v02.api.letsencrypt.org/directory`): set to production when ready.
- `BCRYPT_ROUNDS` (default: `12`): password hashing cost.
- `DNS_PROPAGATION_DELAY_MS` (default: `20000`): wait time before ACME validation.
- `CERT_VALIDITY_DAYS` (default: `90`): used to calculate certificate expiry date in app state.
- `EXPIRING_THRESHOLD_DAYS` / `RENEWAL_THRESHOLD_DAYS` (default: `14`): thresholds for dashboard status and renew checks.
- `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` (optional): enables Sentry error reporting.
- `SENTRY_TRACES_SAMPLE_RATE` (default: `0`): Sentry tracing sample rate.

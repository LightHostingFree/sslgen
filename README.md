# SSL Certificate Platform

Production-ready SSL certificate management built with **Next.js**, **Prisma**, and **ACME DNS-01** using **acme-dns**.

## ✨ Highlights

- 🔐 Auth-ready API with Clerk-style environment setup
- 🌐 Domain onboarding flow that returns required DNS CNAME records
- 📜 Certificate issuance + renewal endpoints with lifecycle states:
  - `pending`
  - `active`
  - `expiring`
  - `expired`
- 📊 User-scoped certificate dashboard
- 🧱 PostgreSQL persistence (Prisma) for:
  - users
  - certificates
  - acme-dns credentials
  - expiry + PEM data
- 🛡️ At-rest encryption for certificate/acme-dns secrets via `CERT_ENCRYPTION_KEY`

---

## 🧭 Tech Stack

- **Frontend / API**: Next.js (`pages` router)
- **Database**: PostgreSQL + Prisma
- **Certificate flow**: ACME DNS-01 + acme-dns
- **Auth integration**: Clerk-compatible secret/public env keys
- **Observability**: Optional Sentry integration

---

## 🚀 Quick Start

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment variables

At minimum, set:

- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `ACMEDNS_BASE`
- `ACME_DIRECTORY`
- `POSTGRES_PRISMA_URL`
- `CERT_ENCRYPTION_KEY`

### 3) Initialize database schema

```bash
npx prisma db push
```

### 4) Run locally

```bash
npm run dev
```

---

## ⚙️ Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `CLERK_SECRET_KEY` | Yes | - | Backend auth secret key |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | - | Clerk publishable key exposed to browser |
| `NEXT_PUBLIC_APP_URL` | No | - | Public base URL for app |
| `ACMEDNS_BASE` | Yes* | `https://acme.getfreeweb.site` (when unset) | acme-dns API base URL |
| `ACME_DIRECTORY` | Yes | - | ACME directory URL |
| `POSTGRES_PRISMA_URL` | Yes | - | PostgreSQL connection string for Prisma |
| `CERT_ENCRYPTION_KEY` | Yes | - | AES-256-GCM key for encrypting cert/acme-dns data at rest |
| `BCRYPT_ROUNDS` | No | `12` | Password hashing cost factor |
| `DNS_PROPAGATION_DELAY_MS` | No | `20000` | Wait time before ACME validation |
| `CERT_VALIDITY_DAYS` | No | `90` | Certificate validity tracking in app state |
| `EXPIRING_THRESHOLD_DAYS` | No | `14` | Days before cert is marked expiring |
| `RENEWAL_THRESHOLD_DAYS` | No | `14` | Renewal check threshold |
| `SENTRY_DSN` | No | - | Server-side Sentry DSN |
| `NEXT_PUBLIC_SENTRY_DSN` | No | - | Client-side Sentry DSN |
| `SENTRY_TRACES_SAMPLE_RATE` | No | `0` | Sentry performance tracing sample rate |
| `SENTRY_AUTH_TOKEN` | No | - | Enables source map uploads during build |

\* If `ACMEDNS_BASE` is not set, the app falls back to `https://acme.getfreeweb.site`.

---

## 📡 Core API Endpoints

- `POST /api/auth/register` — Register user
- `POST /api/auth/login` — Login user
- `POST /api/register-domain` — Register domain and return DNS CNAME details
- `POST /api/request-cert` — Request a certificate via DNS-01 flow
- `POST /api/renew` — Renew eligible certificates
- `GET /api/certificates` — List user certificates
- `GET /api/certificates/[id]` — Get certificate by ID
- `GET /api/health` — Health check endpoint

---

## ☁️ Deploying to Vercel

1. Create a Vercel project connected to this repository.
2. Keep `vercel.json` as-is (it runs `npm run build` and raises max duration for DNS validation in `pages/api/request-cert.js`).
3. Add the required environment variables in Vercel Project Settings:
   - `POSTGRES_PRISMA_URL`
   - `CLERK_SECRET_KEY`
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CERT_ENCRYPTION_KEY`
   - `ACME_DIRECTORY`
   - `ACMEDNS_BASE`
   - `SENTRY_DSN` (optional)
   - `NEXT_PUBLIC_SENTRY_DSN` (optional)
   - `SENTRY_AUTH_TOKEN` (optional)
4. Redeploy after setting variables.

---

## 🧪 Optional: Sentry Setup (Local)

```bash
npx @sentry/wizard@latest -i nextjs --saas --org is-cool-me --project sslgen
```

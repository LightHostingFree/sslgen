# 🔐 SSL Generator

> Automated SSL certificate issuance and lifecycle management — powered by Next.js, Prisma, ACME DNS-01, and Cloudflare DNS automation.

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-blue?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel)](https://vercel.com/)
[![Sentry](https://img.shields.io/badge/Sentry-monitored-362D59?logo=sentry)](https://sentry.io/)

---

## ✨ Features

- 🔑 **Email/password auth** with bcrypt hashing and JWT bearer tokens
- 📧 **Password reset** via secure time-limited email link
- 🌐 **Domain onboarding** — returns a unique CNAME target for `_acme-challenge.<domain>`
- 📜 **ACME DNS-01 issuance** via Cloudflare TXT records in a dedicated validation zone
- 🔒 **Encryption at rest** — certificate and private key stored encrypted using `CERT_ENCRYPTION_KEY`
- 🔁 **Automatic renewal detection** — tracks expiry and flags certificates nearing expiry
- 📬 **Email reminders** — notifies users before SSL certificates expire
- 🔍 **DNS verification** endpoint to check CNAME propagation before issuance
- 📊 **Dashboard APIs** for listing, fetching, and deleting certificate records
- 🛡️ **Google Trust Services** support (ACME EAB)

---

## 🏗️ Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 15](https://nextjs.org/) (Pages Router) |
| Database | PostgreSQL + [Prisma 6](https://www.prisma.io/) |
| ACME client | [`acme-client`](https://www.npmjs.com/package/acme-client) |
| DNS automation | Cloudflare DNS API (token-based) |
| Auth | `jsonwebtoken` + `bcryptjs` |
| Email | Nodemailer (SMTP) |
| HTTP client | Axios (with retry logic) |
| UI animations | Framer Motion |
| Error tracking | Sentry (`@sentry/nextjs`) |

---

## 📋 Certificate Flow

```
1. POST /api/register-domain   →  receive unique CNAME target
2. Configure DNS               →  _acme-challenge.<domain> CNAME → <target>
3. POST /api/request-cert      →  issue certificate via ACME DNS-01
4. GET  /api/certificates/:id  →  download certificate & private key
```

**`/api/request-cert`** supports:
- **Standard cert** — root domain + optional `www`
- **Wildcard cert** — `*.domain` + root domain
- **Google Trust Services** — pass `ca: "google"` with `eabKeyId` and `eabHmacKey` as JSON body fields

---

## 📌 Certificate Status Values

| Status | Meaning |
|---|---|
| `ACTION_REQUIRED` | DNS CNAME not yet configured, or certificate nearing expiry |
| `ISSUED` | Certificate active and valid |
| `FAILED` | Issuance failed |
| `EXPIRED` | Certificate has passed its expiry date |
| `REVOKED` | Certificate has been revoked |

---

## 🔌 API Endpoints

### Auth

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register a new user account |
| `POST` | `/api/auth/login` | Log in and receive a JWT token |
| `POST` | `/api/auth/forgot-password` | Request a password reset email |
| `POST` | `/api/auth/reset-password` | Reset password using a token from email |

### Certificates

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/register-domain` | Onboard a domain and get a CNAME target |
| `GET` | `/api/check-dns` | Check DNS CNAME propagation for a domain |
| `POST` | `/api/request-cert` | Issue an SSL certificate via ACME DNS-01 |
| `GET` | `/api/certificates` | List all certificates (filterable by `status`) |
| `GET` | `/api/certificates/[id]` | Fetch a certificate's PEM, private key, and CA bundle |
| `DELETE` | `/api/certificates/[id]` | Delete a certificate record |
| `POST` | `/api/renew` | List certificates due for renewal |

### System

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check — returns `{ ok: true, time }` |
| `POST` | `/api/ssl-reminders` | Send expiry reminder emails (requires `REMINDER_SECRET`) |

---

## ⚙️ Environment Variables

### Required

| Variable | Description |
|---|---|
| `POSTGRES_PRISMA_URL` | PostgreSQL connection string |
| `CLERK_SECRET_KEY` | Secret key used to sign JWT tokens |
| `CERT_ENCRYPTION_KEY` | Key used to encrypt certificates and private keys at rest |
| `ACME_DIRECTORY` | ACME directory URL (e.g. Let's Encrypt production or staging) |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with DNS edit permissions |
| `CLOUDFLARE_ZONE_ID` | Cloudflare zone ID for the validation domain |
| `CLOUDFLARE_VALIDATION_DOMAIN` | Domain used to host `_acme-challenge` CNAME targets |

### Email (required for password reset and expiry reminders)

| Variable | Description |
|---|---|
| `SMTP_HOST` | SMTP server hostname |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `SMTP_PORT` | SMTP port (default: `587`) |
| `SMTP_SECURE` | Set to `true` for TLS (default: `false`) |
| `SMTP_FROM_NAME` | Display name for outgoing emails (default: `SSL Generator`) |
| `SMTP_FROM_EMAIL` | From address for outgoing emails (defaults to `SMTP_USER`) |

### Optional

| Variable | Default | Description |
|---|---|---|
| `APP_URL` | `https://sslgen.app` | Base URL used in email links — set this to your deployment URL |
| `BCRYPT_ROUNDS` | `12` | bcrypt work factor for password hashing |
| `DNS_PROPAGATION_DELAY_MS` | `20000` | Delay (ms) after creating TXT record before ACME challenge |
| `CERT_VALIDITY_DAYS` | `90` | Certificate validity period in days |
| `EXPIRING_THRESHOLD_DAYS` | `14` | Days before expiry to mark certificate as `ACTION_REQUIRED` |
| `RENEWAL_THRESHOLD_DAYS` | `14` | Days before expiry to include in renewal list |
| `REMINDER_THRESHOLD_DAYS` | `30` | Days before expiry to send reminder emails |
| `REMINDER_SECRET` | — | Bearer token required to call `/api/ssl-reminders` |
| `SENTRY_AUTH_TOKEN` | — | Enables Sentry source map upload during build |
| `SENTRY_DSN` | — | Sentry DSN for server-side error tracking |
| `NEXT_PUBLIC_SENTRY_DSN` | — | Sentry DSN for client-side error tracking |
| `SENTRY_TRACES_SAMPLE_RATE` | — | Sentry performance tracing sample rate |

---

## 🚀 Local Development

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

---

## 🏭 Build

```bash
npm run build
```

**Vercel `buildCommand`:**

```bash
prisma generate && prisma migrate deploy && next build
```

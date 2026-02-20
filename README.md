# SSL Generator

SSL certificate issuance and lifecycle management built with Next.js, Prisma, ACME DNS-01, and Cloudflare DNS automation.

## Overview

- User authentication with email/password and JWT bearer tokens.
- Domain onboarding returns a CNAME target for `_acme-challenge.<domain>`.
- ACME DNS-01 issuance through Cloudflare TXT records in a dedicated validation zone.
- Certificate and private key are encrypted at rest using `CERT_ENCRYPTION_KEY`.
- Dashboard APIs for listing, fetching, and deleting certificate records.

## Stack

- Next.js (Pages Router)
- PostgreSQL + Prisma
- `acme-client`
- Cloudflare DNS API (token-based)
- Sentry (`@sentry/nextjs`)

## Certificate Flow

1. Call `POST /api/register-domain` with a domain.
2. Configure DNS: point `_acme-challenge.<domain>` to the returned CNAME target.
3. Call `POST /api/request-cert` to issue certificate.
4. Download certificate/key using `GET /api/certificates/[id]`.

`/api/request-cert` supports:
- Standard cert: root domain + optional `www`
- Wildcard cert: `*.domain` + root domain

## Status Values

- `ACTION_REQUIRED`
- `ISSUED`
- `FAILED`
- `EXPIRED`
- `REVOKED`

## Environment Variables

### Required

- `POSTGRES_PRISMA_URL`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CERT_ENCRYPTION_KEY`
- `ACME_DIRECTORY`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ZONE_ID`
- `CLOUDFLARE_VALIDATION_DOMAIN`

### Optional

- `BCRYPT_ROUNDS` (default: `12`)
- `DNS_PROPAGATION_DELAY_MS` (default: `20000`)
- `CERT_VALIDITY_DAYS` (default: `90`)
- `EXPIRING_THRESHOLD_DAYS` (default: `14`)
- `RENEWAL_THRESHOLD_DAYS` (default: `14`)
- `SENTRY_AUTH_TOKEN` (enables source map upload during build)
- `SENTRY_DSN`
- `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_TRACES_SAMPLE_RATE`

## Local Development

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

## Build

```bash
npm run build
```

Vercel `buildCommand` is:

```bash
prisma generate && prisma migrate deploy && next build
```

## API Endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/health`
- `POST /api/register-domain`
- `POST /api/request-cert`
- `POST /api/renew`
- `GET /api/certificates`
- `GET /api/certificates/[id]`
- `DELETE /api/certificates/[id]`

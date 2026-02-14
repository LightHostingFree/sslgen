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

Quick start:
1. `npm install`
2. `npx prisma db push`
3. `npm run dev`

Environment variables:
- `JWT_SECRET` (required outside local dev)
- `ACMEDNS_BASE` (default: `https://acme.getfreeweb.site`)
- `ACME_DIRECTORY` (default: Let's Encrypt staging)

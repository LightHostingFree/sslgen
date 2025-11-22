SSL Generator - Neon + Prisma + Clerk Auth (Free stack)

What's included:
- Next.js app with Clerk auth (frontend)
- Prisma schema ready for Neon (Postgres)
- API routes for acme-dns registration and ACME certificate issuance (DNS-01)
- Wildcard support
- Auto-renew endpoint compatible with cron-job.org
- Example env vars and deployment instructions (Vercel + Neon + Clerk)
- NOTE: This package also contains the file you previously uploaded at: /mnt/data/dash-main.zip

Setup summary:
1. Create Neon Postgres DB and copy connection string to DATABASE_URL
2. Create a Clerk project (https://clerk.com) and add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY in Vercel
3. Set ACMEDNS_BASE (e.g. https://acme.getfreeweb.site) and ACME_DIRECTORY (Let's Encrypt staging for testing)
4. npx prisma generate && npx prisma db push
5. Deploy on Vercel, set environment variables, and set up cron-job.org to call /api/renew

import { randomUUID } from 'crypto';
import * as Sentry from '@sentry/nextjs';
import prisma from '../../lib/prisma';
import { requireAuth } from '../../lib/auth';

const CLOUDFLARE_VALIDATION_DOMAIN = process.env.CLOUDFLARE_VALIDATION_DOMAIN;

export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({ error: 'Method not allowed' });
  const authUser = requireAuth(req, res);
  if (!authUser) return;
  const { domain } = req.body;
  const normalizedDomain = String(domain || '').trim().toLowerCase();
  if(!normalizedDomain) return res.status(400).json({ error: 'domain required' });
  if (!CLOUDFLARE_VALIDATION_DOMAIN) return res.status(500).json({ error: 'CLOUDFLARE_VALIDATION_DOMAIN must be configured' });
  try{
    // Generate a unique subdomain in the Cloudflare validation zone for this domain.
    // This UUID-based subdomain is the CNAME target the user will point their
    // _acme-challenge record at, allowing the system to set TXT records there
    // during ACME DNS-01 challenges without touching the user's own DNS zone.
    const cnameTarget = `${randomUUID()}.${CLOUDFLARE_VALIDATION_DOMAIN}`;

    // Atomically create-or-return the certificate record. If the domain is already
    // registered the existing record (with its cnameTarget) is kept unchanged so
    // the user's DNS CNAME continues to point to the correct place, and only the
    // latest certificate data is ever stored per domain.
    const record = await prisma.certificate.upsert({
      where: { userId_domain: { userId: authUser.userId, domain: normalizedDomain } },
      create: {
        userId: authUser.userId,
        domain: normalizedDomain,
        cnameTarget,
        status: 'ACTION_REQUIRED'
      },
      update: {}
    });
    const cname = `_acme-challenge.${normalizedDomain} -> ${record.cnameTarget}`;
    return res.json({ domain: normalizedDomain, cname, status: record.status });
  }catch(e){
    Sentry.captureException(e);
    const errorData = e.response?.data;
    const errorMessage = (errorData && typeof errorData === 'object' && errorData !== null) 
      ? JSON.stringify(errorData) 
      : (e.message || 'An error occurred');
    return res.status(500).json({ error: errorMessage });
  }
}

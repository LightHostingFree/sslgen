import axios from 'axios';
import * as Sentry from '@sentry/nextjs';
import prisma from '../../lib/prisma';
import { requireAuth } from '../../lib/auth';
import { DEFAULT_ACMEDNS_BASE } from '../../lib/constants';
import { encryptAtRest } from '../../lib/crypto';

export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({ error: 'Method not allowed' });
  const authUser = requireAuth(req, res);
  if (!authUser) return;
  const { domain } = req.body;
  const normalizedDomain = String(domain || '').trim().toLowerCase();
  if(!normalizedDomain) return res.status(400).json({ error: 'domain required' });
  const ACMEDNS_BASE = process.env.ACMEDNS_BASE || DEFAULT_ACMEDNS_BASE;
  if (!ACMEDNS_BASE) return res.status(500).json({ error: 'ACMEDNS_BASE must be configured' });
  try{
    const existing = await prisma.certificate.findUnique({ where: { userId_domain: { userId: authUser.userId, domain: normalizedDomain } } });

    if(existing){
      const cname = `_acme-challenge.${normalizedDomain} -> ${existing.cnameTarget}`;
      return res.json({ domain: normalizedDomain, cname, status: existing.status });
    }

    const r = await axios.post(`${ACMEDNS_BASE}/register`, {});
    const reg = r.data;
    await prisma.certificate.create({
      data: {
        userId: authUser.userId,
          domain: normalizedDomain,
          acmeDnsSubdomain: reg.subdomain,
          acmeDnsUsername: encryptAtRest(reg.username),
          acmeDnsPassword: encryptAtRest(reg.password),
          cnameTarget: reg.fulldomain,
          status: 'ACTION_REQUIRED'
        }
      });
    const cname = `_acme-challenge.${normalizedDomain} -> ${reg.fulldomain}`;
    return res.json({ domain: normalizedDomain, cname, status: 'ACTION_REQUIRED' });
  }catch(e){
    Sentry.captureException(e);
    return res.status(500).json({ error: e.response?.data || e.message });
  }
}

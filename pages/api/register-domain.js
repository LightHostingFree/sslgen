import axios from 'axios';
import * as Sentry from '@sentry/nextjs';
import prisma from '../../lib/prisma';
import { requireAuth } from '../../lib/auth';

export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({ error: 'Method not allowed' });
  const authUser = requireAuth(req, res);
  if (!authUser) return;
  const { domain, wildcard } = req.body;
  if(!domain) return res.status(400).json({ error: 'domain required' });
  const ACMEDNS_BASE = process.env.ACMEDNS_BASE || 'https://acme.getfreeweb.site';
  try{
    const existing = await prisma.certificate.findUnique({ where: { userId_domain: { userId: authUser.userId, domain } } });

    if(existing){
      const cname = `_acme-challenge.${domain} -> ${existing.cnameTarget}`;
      return res.json({ domain, cname, status: existing.status });
    }

    const r = await axios.post(`${ACMEDNS_BASE}/register`, {});
    const reg = r.data;
    await prisma.certificate.create({
      data: {
        userId: authUser.userId,
        domain,
        acmeDnsSubdomain: reg.subdomain,
        acmeDnsUsername: reg.username,
        acmeDnsPassword: reg.password,
        cnameTarget: reg.fulldomain,
        status: 'pending'
      }
    });
    const cname = `_acme-challenge.${domain} -> ${reg.fulldomain}`;
    return res.json({ domain, cname, registration: reg });
  }catch(e){
    Sentry.captureException(e);
    return res.status(500).json({ error: e.response?.data || e.message });
  }
}

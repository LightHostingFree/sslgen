import axios from 'axios';
import prisma from '../../lib/prisma';
import { clerkClient } from '@clerk/nextjs/server';

export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).end();
  const { domain, wildcard } = req.body;
  if(!domain) return res.status(400).json({ error: 'domain required' });
  const ACMEDNS_BASE = process.env.ACMEDNS_BASE || 'https://acme.getfreeweb.site';
  try{
    const r = await axios.post(`${ACMEDNS_BASE}/register`, {});
    const reg = r.data;
    // optional: associate owner via Clerk (if available)
    let ownerId = null;
    try{ const session = req.headers['cookie']; /* placeholder - associate after verifying session */ }catch(e){}
    await prisma.registration.upsert({ where: { domain }, update: { subdomain: reg.subdomain, fulldomain: reg.fulldomain, username: reg.username, password: reg.password, wildcard: !!wildcard }, create: { domain, subdomain: reg.subdomain, fulldomain: reg.fulldomain, username: reg.username, password: reg.password, wildcard: !!wildcard } });
    const cname = `_acme-challenge.${domain} -> ${reg.fulldomain}`;
    return res.json({ domain, cname, registration: reg });
  }catch(e){
    return res.status(500).json({ error: e.response?.data || e.message });
  }
}

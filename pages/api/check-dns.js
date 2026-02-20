import dns from 'dns';
import { promisify } from 'util';
import { requireAuth } from '../../lib/auth';

const resolveNs = promisify(dns.resolveNs);
const resolveCname = promisify(dns.resolveCname);

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const authUser = requireAuth(req, res);
  if (!authUser) return;

  const domain = String(req.query.domain || '').trim().toLowerCase();
  if (!domain) return res.status(400).json({ error: 'domain required' });

  let hasNameservers = false;
  try {
    const ns = await resolveNs(domain);
    hasNameservers = Array.isArray(ns) && ns.length > 0;
  } catch {
    hasNameservers = false;
  }

  let cname = null;
  try {
    const records = await resolveCname(`_acme-challenge.${domain}`);
    cname = Array.isArray(records) && records.length > 0 ? records[0] : null;
  } catch {
    cname = null;
  }

  return res.json({ hasNameservers, cname });
}

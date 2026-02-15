import prisma from '../../lib/prisma';
import { requireAuth } from '../../lib/auth';
const RENEWAL_THRESHOLD_DAYS = Number(process.env.RENEWAL_THRESHOLD_DAYS || 14);
export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({ error: 'Method not allowed' });
  const authUser = requireAuth(req, res);
  if (!authUser) return;
  const due = await prisma.certificate.findMany({
    where: {
      userId: authUser.userId,
      expiresAt: { not: null, lt: new Date(Date.now() + RENEWAL_THRESHOLD_DAYS * 24 * 3600 * 1000) }
    }
  });
  return res.json({ due });
}

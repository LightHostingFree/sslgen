import prisma from '../../lib/prisma';
export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).end();
  const now = new Date();
  const due = await prisma.cert.findMany({ where: { expiresAt: { lt: new Date(Date.now() + 14*24*3600*1000) } } });
  return res.json({ due });
}

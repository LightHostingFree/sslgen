import prisma from '../../../lib/prisma';
import { requireAuth } from '../../../lib/auth';
import { decryptAtRest } from '../../../lib/crypto';

export default async function handler(req, res) {
  const authUser = requireAuth(req, res);
  if (!authUser) return;

  const id = Number(req.query.id);
  if (isNaN(id) || id < 1) return res.status(400).json({ error: 'Invalid certificate id' });

  if (req.method === 'GET') {
    const certificate = await prisma.certificate.findFirst({
      where: { id, userId: authUser.userId }
    });
    if (!certificate) return res.status(404).json({ error: 'Certificate not found' });

    return res.json({
      privateKey: certificate.privateKeyPem ? decryptAtRest(certificate.privateKeyPem) : null,
      certificate: certificate.certificatePem ? decryptAtRest(certificate.certificatePem) : null
    });
  }

  if (req.method === 'DELETE') {
    const certificate = await prisma.certificate.findFirst({
      where: { id, userId: authUser.userId }
    });
    if (!certificate) return res.status(404).json({ error: 'Certificate not found' });

    await prisma.certificate.delete({ where: { id } });
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

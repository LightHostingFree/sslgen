import prisma from '../../lib/prisma';
import { requireAuth } from '../../lib/auth';

const EXPIRING_THRESHOLD_DAYS = Number(process.env.EXPIRING_THRESHOLD_DAYS || 14);

function computeStatus(certificate) {
  if (certificate.status === 'FAILED' || certificate.status === 'REVOKED') return certificate.status;
  if (!certificate.expiresAt) return 'ACTION_REQUIRED';
  const now = Date.now();
  const expiry = new Date(certificate.expiresAt).getTime();
  if (expiry <= now) return 'EXPIRED';
  if (expiry - now <= EXPIRING_THRESHOLD_DAYS * 24 * 60 * 60 * 1000) return 'ACTION_REQUIRED';
  return 'ISSUED';
}

export default async function handler(req, res) {
  const authUser = requireAuth(req, res);
  if (!authUser) return;

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const statusFilter = String(req.query.status || '').toUpperCase();
  const certificates = await prisma.certificate.findMany({
    where: { userId: authUser.userId },
    orderBy: { createdAt: 'desc' }
  });
  const updated = await Promise.all(
    certificates.map(async (certificate) => {
      const status = computeStatus(certificate);
      if (status !== certificate.status) {
        return prisma.certificate.update({ where: { id: certificate.id }, data: { status } });
      }
      return certificate;
    })
  );

  return res.json({
    certificates: statusFilter ? updated.filter((certificate) => certificate.status === statusFilter) : updated
  });
}

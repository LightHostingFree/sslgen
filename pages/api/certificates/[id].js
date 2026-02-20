import prisma from '../../../lib/prisma';
import { requireAuth } from '../../../lib/auth';
import { decryptAtRest } from '../../../lib/crypto';

function splitCertificateChain(pem) {
  if (!pem) return { certificate: null, caBundle: null };
  const certs = [];
  const regex = /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g;
  let match;
  while ((match = regex.exec(pem)) !== null) {
    certs.push(match[0]);
  }
  return {
    certificate: certs[0] || null,
    caBundle: certs.slice(1).join('\n\n') || null
  };
}

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

    const fullChain = certificate.certificatePem ? decryptAtRest(certificate.certificatePem) : null;
    const { certificate: leafCert, caBundle } = splitCertificateChain(fullChain);

    return res.json({
      privateKey: certificate.privateKeyPem ? decryptAtRest(certificate.privateKeyPem) : null,
      certificate: leafCert,
      caBundle
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

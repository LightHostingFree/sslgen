import * as acme from 'acme-client';
import axios from 'axios';
import * as Sentry from '@sentry/nextjs';
import prisma from '../../lib/prisma';
import { requireAuth } from '../../lib/auth';

const ACME_DNS_API = process.env.ACMEDNS_BASE || 'https://acme.getfreeweb.site';
const ACME_DIRECTORY = process.env.ACME_DIRECTORY || acme.directory.letsencrypt.staging;
const DNS_PROPAGATION_DELAY_MS = Number(process.env.DNS_PROPAGATION_DELAY_MS || 20000);
const CERT_VALIDITY_DAYS = Number(process.env.CERT_VALIDITY_DAYS || 90);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const authUser = requireAuth(req, res);
  if (!authUser) return;

  const { domain, email, wildcard = false } = req.body || {};
  if (!domain) return res.status(400).json({ error: 'domain required' });

  try {
    const certificate = await prisma.certificate.findUnique({
      where: { userId_domain: { userId: authUser.userId, domain } }
    });
    if (!certificate) return res.status(404).json({ error: 'Register domain first' });

    const accountEmail = email || authUser.email;
    const client = new acme.Client({
      directoryUrl: ACME_DIRECTORY,
      accountKey: await acme.crypto.createPrivateKey()
    });

    await client.createAccount({
      termsOfServiceAgreed: true,
      contact: [`mailto:${accountEmail}`]
    });

    const names = wildcard ? [`*.${domain}`, domain] : [domain];
    const [privateKey, csr] = await acme.crypto.createCsr({
      commonName: names[0],
      altNames: names
    });

    const certificatePem = await client.auto({
      csr,
      email: accountEmail,
      termsOfServiceAgreed: true,
      challengeCreateFn: async (_authz, challenge, keyAuthorization) => {
        if (challenge.type !== 'dns-01') return;
        const txt = acme.crypto.createHash('sha256').update(keyAuthorization).digest('base64url');
        await axios.post(
          `${ACME_DNS_API}/update`,
          { subdomain: certificate.acmeDnsSubdomain, txt },
          {
            headers: {
              'X-Api-User': certificate.acmeDnsUsername,
              'X-Api-Key': certificate.acmeDnsPassword
            }
          }
        );
        await new Promise((resolve) => setTimeout(resolve, DNS_PROPAGATION_DELAY_MS));
      },
      challengeRemoveFn: async () => {}
    });

    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + CERT_VALIDITY_DAYS * 24 * 60 * 60 * 1000);
    await prisma.certificate.update({
      where: { id: certificate.id },
      data: {
        issuedAt,
        expiresAt,
        certificatePem,
        privateKeyPem: privateKey.toString(),
        status: 'active'
      }
    });

    return res.json({
      domain,
      certificate: certificatePem,
      privateKey: privateKey.toString(),
      cname: `_acme-challenge.${domain} -> ${certificate.cnameTarget}`,
      status: 'active'
    });
  } catch (error) {
    Sentry.captureException(error);
    return res.status(500).json({ error: error?.response?.data || error.message });
  }
}

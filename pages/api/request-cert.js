import * as acme from 'acme-client';
import axios from 'axios';
import * as Sentry from '@sentry/nextjs';
import { createHash } from 'crypto';
import { promises as dns } from 'dns';
import prisma from '../../lib/prisma';
import { requireAuth } from '../../lib/auth';
import { DEFAULT_ACMEDNS_BASE } from '../../lib/constants';
import { decryptAtRest, encryptAtRest } from '../../lib/crypto';

const ACME_DNS_API = process.env.ACMEDNS_BASE || DEFAULT_ACMEDNS_BASE;
const ACME_DIRECTORY = process.env.ACME_DIRECTORY;
const DNS_PROPAGATION_DELAY_MS = Number(process.env.DNS_PROPAGATION_DELAY_MS || 20000);
const CERT_VALIDITY_DAYS = Number(process.env.CERT_VALIDITY_DAYS || 90);

async function validateDomainExists(domain) {
  try {
    await dns.resolve(domain, 'A');
    return true;
  } catch (error) {
    // Try AAAA record (IPv6) if A record (IPv4) fails
    try {
      await dns.resolve(domain, 'AAAA');
      return true;
    } catch (error2) {
      return false;
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const authUser = requireAuth(req, res);
  if (!authUser) return;

  const { domain, email, wildcard = false, includeWww = true } = req.body || {};
  const normalizedDomain = String(domain || '').trim().toLowerCase();
  if (!normalizedDomain) return res.status(400).json({ error: 'domain required' });
  if (!ACME_DNS_API || !ACME_DIRECTORY) {
    return res.status(500).json({ error: 'ACMEDNS_BASE and ACME_DIRECTORY must be configured' });
  }

  try {
    const certificate = await prisma.certificate.findUnique({
      where: { userId_domain: { userId: authUser.userId, domain: normalizedDomain } }
    });
    if (!certificate) return res.status(404).json({ error: 'Register domain first' });

    // Validate that the domain exists before attempting certificate generation
    const names = wildcard ? [`*.${normalizedDomain}`, normalizedDomain] : [normalizedDomain, ...(includeWww ? [`www.${normalizedDomain}`] : [])];
    
    // Check if base domain resolves
    const domainExists = await validateDomainExists(normalizedDomain);
    if (!domainExists) {
      return res.status(400).json({ 
        error: `Domain ${normalizedDomain} does not exist or cannot be resolved. Please ensure the domain is registered and has valid DNS records before requesting a certificate.` 
      });
    }

    // If including www subdomain, validate it exists too
    if (includeWww && !wildcard) {
      const wwwDomain = `www.${normalizedDomain}`;
      const wwwExists = await validateDomainExists(wwwDomain);
      if (!wwwExists) {
        return res.status(400).json({ 
          error: `Subdomain ${wwwDomain} does not exist or cannot be resolved. Either add DNS records for www.${normalizedDomain} or request a certificate without the www subdomain by setting includeWww to false.` 
        });
      }
    }

    const accountEmail = email || authUser.email;
    const client = new acme.Client({
      directoryUrl: ACME_DIRECTORY,
      accountKey: await acme.crypto.createPrivateKey()
    });

    await client.createAccount({
      termsOfServiceAgreed: true,
      contact: [`mailto:${accountEmail}`]
    });

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
        const txt = createHash('sha256').update(keyAuthorization).digest('base64url');
        await axios.post(
          `${ACME_DNS_API}/update`,
          { subdomain: certificate.acmeDnsSubdomain, txt },
          {
            headers: {
              'X-Api-User': decryptAtRest(certificate.acmeDnsUsername),
              'X-Api-Key': decryptAtRest(certificate.acmeDnsPassword)
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
        certificatePem: encryptAtRest(certificatePem),
        privateKeyPem: encryptAtRest(privateKey.toString()),
        status: 'ISSUED'
      }
    });

    return res.json({
      domain: normalizedDomain,
      certificate: certificatePem,
      privateKey: privateKey.toString(),
      cname: `_acme-challenge.${normalizedDomain} -> ${certificate.cnameTarget}`,
      status: 'ISSUED'
    });
  } catch (error) {
    if (normalizedDomain) {
      await prisma.certificate.updateMany({
        where: { userId: authUser.userId, domain: normalizedDomain },
        data: { status: 'FAILED' }
      });
    }
    Sentry.captureException(error);
    
    // Provide more specific error messages for DNS-related errors
    let errorMessage = error?.response?.data || error.message;
    if (error.code === 'ENOTFOUND' || error.message?.includes('getaddrinfo ENOTFOUND')) {
      const failedDomain = error.hostname || normalizedDomain;
      errorMessage = `Domain ${failedDomain} could not be resolved. Please ensure the domain exists and has valid DNS records configured.`;
    }
    
    return res.status(500).json({ error: errorMessage });
  }
}

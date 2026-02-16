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
const AXIOS_TIMEOUT_MS = 30000;
const MAX_RETRIES = 3;

async function axiosWithRetry(config, retries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await axios({ timeout: AXIOS_TIMEOUT_MS, ...config });
    } catch (err) {
      const status = err.response?.status;
      const isNetworkError = err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED';
      const isRetryable = isNetworkError || status === 502 || status === 503 || status === 504;
      if (attempt >= retries || !isRetryable) throw err;
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    }
  }
}

async function validateDomainExists(domain) {
  const isServerError = (err) => ['ESERVFAIL', 'EREFUSED', 'ETIMEOUT'].includes(err?.code);
  
  try {
    await dns.resolve(domain, 'A');
    return { exists: true, error: null };
  } catch (error) {
    // Try AAAA record (IPv6) if A record (IPv4) fails
    try {
      await dns.resolve(domain, 'AAAA');
      return { exists: true, error: null };
    } catch (error2) {
      // If DNS server refuses the query, we can't validate
      if (isServerError(error) || isServerError(error2)) {
        return { exists: null, error: 'DNS validation unavailable' };
      }
      return { exists: false, error: error2.message };
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
    
    // Check if base domain resolves (skip if DNS validation is unavailable)
    const domainCheck = await validateDomainExists(normalizedDomain);
    if (domainCheck.exists === false) {
      return res.status(400).json({ 
        error: `Domain ${normalizedDomain} does not exist or cannot be resolved. Please ensure the domain is registered and has valid DNS records before requesting a certificate.` 
      });
    }

    // If including www subdomain, validate it exists too (skip if DNS validation is unavailable)
    if (includeWww && !wildcard) {
      const wwwDomain = `www.${normalizedDomain}`;
      const wwwCheck = await validateDomainExists(wwwDomain);
      if (wwwCheck.exists === false) {
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
        await axiosWithRetry({
          method: 'post',
          url: `${ACME_DNS_API}/update`,
          data: { subdomain: certificate.acmeDnsSubdomain, txt },
          headers: {
            'X-Api-User': decryptAtRest(certificate.acmeDnsUsername),
            'X-Api-Key': decryptAtRest(certificate.acmeDnsPassword)
          }
        });
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
    let errorMessage = error.message || 'An error occurred';
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      errorMessage = 'The request to the ACME DNS service timed out. Please try again.';
    } else if (error.code === 'ENOTFOUND' || error.message?.includes('getaddrinfo ENOTFOUND')) {
      const failedDomain = error.hostname || normalizedDomain;
      errorMessage = `Domain ${failedDomain} could not be resolved. Please ensure the domain exists and has valid DNS records configured.`;
    } else if (error?.response?.data) {
      // Safely extract error from response data
      const errorData = error.response.data;
      errorMessage = (typeof errorData === 'object' && errorData !== null) 
        ? JSON.stringify(errorData) 
        : errorMessage;
    }
    
    return res.status(500).json({ error: errorMessage });
  }
}

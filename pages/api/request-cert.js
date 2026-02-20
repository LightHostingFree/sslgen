import * as acme from 'acme-client';
import axios from 'axios';
import * as Sentry from '@sentry/nextjs';
import prisma from '../../lib/prisma';
import { requireAuth } from '../../lib/auth';
import { CLOUDFLARE_API_BASE } from '../../lib/constants';
import { encryptAtRest } from '../../lib/crypto';

const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_ZONE_ID = process.env.CLOUDFLARE_ZONE_ID;
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

async function createCloudflareTxtRecord(name, content) {
  try {
    const resp = await axiosWithRetry({
      method: 'post',
      url: `${CLOUDFLARE_API_BASE}/zones/${CLOUDFLARE_ZONE_ID}/dns_records`,
      data: { type: 'TXT', name, content, ttl: 60 },
      headers: { Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}` }
    });
    return resp.data?.result?.id;
  } catch (err) {
    const status = err.response?.status;
    if (status === 401) throw new Error('Cloudflare authentication failed. Check CLOUDFLARE_API_TOKEN.');
    if (status === 403) throw new Error('Cloudflare API token lacks DNS edit permission for CLOUDFLARE_ZONE_ID.');
    throw err;
  }
}

async function deleteCloudflareTxtRecord(recordId) {
  if (!recordId) return;
  try {
    await axiosWithRetry({
      method: 'delete',
      url: `${CLOUDFLARE_API_BASE}/zones/${CLOUDFLARE_ZONE_ID}/dns_records/${recordId}`,
      headers: { Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}` }
    });
  } catch (err) {
    const status = err.response?.status;
    if (status === 401) throw new Error('Cloudflare authentication failed. Check CLOUDFLARE_API_TOKEN.');
    if (status === 403) throw new Error('Cloudflare API token lacks DNS edit permission for CLOUDFLARE_ZONE_ID.');
    throw err;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const authUser = requireAuth(req, res);
  if (!authUser) return;

  const { domain, email, wildcard = false, includeWww = true } = req.body || {};
  const normalizedDomain = String(domain || '').trim().toLowerCase();
  if (!normalizedDomain) return res.status(400).json({ error: 'domain required' });
  if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ZONE_ID || !ACME_DIRECTORY) {
    return res.status(500).json({ error: 'CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID, and ACME_DIRECTORY must be configured' });
  }

  let certificate = null;
  try {
    certificate = await prisma.certificate.findFirst({
      where: { userId: authUser.userId, domain: normalizedDomain },
      orderBy: { createdAt: 'desc' }
    });
    if (!certificate) return res.status(404).json({ error: 'Register domain first' });

    const names = wildcard ? [`*.${normalizedDomain}`, normalizedDomain] : [normalizedDomain, ...(includeWww ? [`www.${normalizedDomain}`] : [])];
    
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

    const txtRecordIds = new Map();
    const certificatePem = await client.auto({
      csr,
      email: accountEmail,
      termsOfServiceAgreed: true,
      challengePriority: ['dns-01'],
      challengeCreateFn: async (_authz, challenge, keyAuthorization) => {
        if (challenge.type !== 'dns-01') return;
        // Create TXT record at the cnameTarget subdomain in the Cloudflare validation zone.
        // The user's _acme-challenge CNAME points here, so the ACME CA will follow it.
        const recordId = await createCloudflareTxtRecord(certificate.cnameTarget, keyAuthorization);
        txtRecordIds.set(keyAuthorization, recordId);
        await new Promise((resolve) => setTimeout(resolve, DNS_PROPAGATION_DELAY_MS));
      },
      challengeRemoveFn: async (_authz, challenge, keyAuthorization) => {
        if (challenge.type !== 'dns-01') return;
        const recordId = txtRecordIds.get(keyAuthorization);
        await deleteCloudflareTxtRecord(recordId);
        txtRecordIds.delete(keyAuthorization);
      }
    });

    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + CERT_VALIDITY_DAYS * 24 * 60 * 60 * 1000);
    // Create a new record so previous certificates are preserved in history.
    // The list API returns only the latest record per domain.
    await prisma.certificate.create({
      data: {
        userId: authUser.userId,
        domain: normalizedDomain,
        cnameTarget: certificate.cnameTarget,
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
    if (certificate) {
      await prisma.certificate.update({
        where: { id: certificate.id },
        data: { status: 'FAILED' }
      });
    }
    Sentry.captureException(error);
    
    // Provide more specific error messages for DNS-related errors
    let errorMessage = error.message || 'An error occurred';
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      errorMessage = 'The request timed out. Please try again.';
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

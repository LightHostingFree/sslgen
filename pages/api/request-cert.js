import axios from "axios";
import prisma from "../../lib/prisma";
import acme from "acme-client";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { domain, wildcard } = req.body;

    if (!domain) {
      return res.status(400).json({ error: "Domain is required" });
    }

    const registration = await prisma.registration.findUnique({
      where: { domain },
    });

    if (!registration) {
      return res.status(400).json({ error: "Domain is not registered" });
    }

    const ACMEDNS_BASE =
      process.env.ACMEDNS_BASE || "https://acme.getfreeweb.site";

    const ACME_DIRECTORY =
      process.env.ACME_DIRECTORY ||
      "https://acme-staging-v02.api.letsencrypt.org/directory";

    // Keys
    const accountKey = await acme.openssl.createPrivateKey();
    const domainKey = await acme.openssl.createPrivateKey();

    // Client
    const client = new acme.Client({
      directoryUrl: ACME_DIRECTORY,
      accountKey,
    });

    await client.createAccount({
      termsOfServiceAgreed: true,
    });

    // Identifiers
    const identifiers = wildcard
      ? [
          { type: "dns", value: domain },
          { type: "dns", value: `*.${domain}` },
        ]
      : [{ type: "dns", value: domain }];

    // Create order
    const order = await client.createOrder({ identifiers });

    const authzList = await client.getAuthorizations(order);

    for (const authz of authzList) {
      const challenge = authz.challenges.find((c) => c.type === "dns-01");
      if (!challenge) {
        throw new Error("DNS-01 challenge not found");
      }

      const keyAuth = await client.getChallengeKeyAuthorization(challenge);

      const dnsValue = acme
        .digest64(keyAuth);

      await axios.post(
        `${ACMEDNS_BASE}/update`,
        {
          subdomain: registration.subdomain,
          txt: dnsValue,
        },
        {
          auth: {
            username: registration.username,
            password: registration.password,
          },
        }
      );

      await client.verifyChallenge(authz, challenge);
      await client.completeChallenge(challenge);
    }

    await client.waitForValidStatus(order);

    const [csr, csrPem] = await acme.openssl.createCSR({
      commonName: domain,
      altNames: wildcard ? [domain, `*.${domain}`] : [domain],
    });

    const certificate = await client.finalizeOrder(order, csr);

    const expiresAt = new Date(Date.now() + 90 * 24 * 3600 * 1000);

    await prisma.cert.create({
      data: {
        domain,
        certPem: certificate,
        keyPem: domainKey,
        expiresAt,
      },
    });

    return res.status(200).json({
      certificate,
      privateKey: domainKey,
    });
  } catch (err) {
    return res.status(500).json({
      error: err.message || "Internal Server Error",
    });
  }
}

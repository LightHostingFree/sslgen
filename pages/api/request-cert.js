import axios from "axios";
import prisma from "../../lib/prisma";
import acme from "acme-client";
import dns from "dns/promises";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { domain, wildcard } = req.body;

  if (!domain) {
    return res.status(400).json({ error: "domain required" });
  }

  const ACMEDNS_BASE =
    process.env.ACMEDNS_BASE || "https://acme.getfreeweb.site";

  try {
    //
    // 1. Check if registration already exists
    //
    const existing = await prisma.registration.findUnique({
      where: { domain },
    });

    let reg;

    if (existing) {
      reg = {
        subdomain: existing.subdomain,
        fulldomain: existing.fulldomain,
        username: existing.username,
        password: existing.password,
      };
    } else {
      //
      // 2. Register with ACME DNS
      //
      const r = await axios.post(`${ACMEDNS_BASE}/register`, {});
      reg = r.data;

      await prisma.registration.create({
        data: {
          domain,
          subdomain: reg.subdomain,
          fulldomain: reg.fulldomain,
          username: reg.username,
          password: reg.password,
          wildcard: Boolean(wildcard),
        },
      });
    }

    //
    // 3. Generate private key for certificate
    //
    const [privateKey, csr] = await acme.forge.createCsr({
      commonName: wildcard ? `*.${domain}` : domain,
    });

    //
    // 4. Create ACME client
    //
    const client = new acme.Client({
      directoryUrl: acme.directory.letsencrypt.production,
      accountKey: await acme.forge.createPrivateKey(),
    });

    //
    // 5. Create order
    //
    const order = await client.createOrder({
      identifiers: [
        {
          type: "dns",
          value: wildcard ? `*.${domain}` : domain,
        },
      ],
    });

    //
    // 6. Get DNS-01 challenge
    //
    const authorizations = await client.getAuthorizations(order);
    const challenge = authorizations[0].challenges.find(
      (c) => c.type === "dns-01"
    );

    const challengeKey = await client.getChallengeKeyAuthorization(challenge);

    //
    // 7. Push challenge TXT record to ACME DNS server
    //
    await axios.post(`${ACMEDNS_BASE}/update`, {
      username: reg.username,
      password: reg.password,
      txt: challengeKey,
    });

    //
    // 8. Wait for DNS to propagate
    //
    const challengeDomain = `_acme-challenge.${domain}`;

    let success = false;
    for (let i = 0; i < 30; i++) {
      try {
        const records = await dns.resolveTxt(challengeDomain);
        if (records.flat().includes(challengeKey)) {
          success = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 3000));
    }

    if (!success) {
      return res.status(500).json({ error: "DNS challenge did not propagate" });
    }

    //
    // 9. Verify challenge
    //
    await client.verifyChallenge(authorizations[0], challenge);
    await client.completeChallenge(challenge);

    //
    // 10. Wait for challenge to be valid
    //
    await client.waitForValidStatus(challenge);

    //
    // 11. Finalize certificate
    //
    const certificate = await client.finalizeOrder(order, csr);

    //
    // 12. Return certificate + private key
    //
    return res.json({
      domain,
      certificate,
      privateKey: privateKey.toString(),
      cname: `_acme-challenge.${domain} -> ${reg.fulldomain}`,
      registration: reg,
    });
  } catch (err) {
    return res.status(500).json({
      error: err?.response?.data || err?.message,
    });
  }
}

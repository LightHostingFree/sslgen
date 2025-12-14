
import * as acme from "acme-client";
import axios from "axios";
import fs from "fs-extra";
import path from "path";

const ACME_DNS_API = process.env.ACME_DNS_API || "https://acme.getfreeweb.site";
const STORE_PATH = process.env.ACME_DNS_STORE || "./acme-dns.json";
const CERTS_DIR = process.env.CERTS_DIR || "./certs";

async function loadStore() {
  if (!(await fs.pathExists(STORE_PATH))) return {};
  return fs.readJson(STORE_PATH);
}

async function saveStore(data) {
  await fs.writeJson(STORE_PATH, data, { spaces: 2 });
}

async function registerWithAcmeDNS() {
  const res = await axios.post(`${ACME_DNS_API}/register`);
  return res.data;
}

async function updateTxt(creds, txt) {
  await axios.post(
    `${ACME_DNS_API}/update`,
    { subdomain: creds.subdomain, txt },
    {
      headers: {
        "X-Api-User": creds.username,
        "X-Api-Key": creds.password
      }
    }
  );
}

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { domain, email, wildcard = false } = req.body;
  if (!domain || !email)
    return res.status(400).json({ error: "domain and email required" });

  try {
    const store = await loadStore();

    if (!store[domain]) {
      const reg = await registerWithAcmeDNS();
      store[domain] = reg;
      await saveStore(store);

      return res.status(200).json({
        success: true,
        message: "Add this CNAME record before issuing certificate",
        cname: {
          name: `_acme-challenge.${domain}`,
          value: reg.fulldomain
        }
      });
    }

    const creds = store[domain];

    const client = new acme.Client({
      directoryUrl: acme.directory.letsencrypt.production,
      accountKey: await acme.crypto.createPrivateKey()
    });

    await client.createAccount({
      termsOfServiceAgreed: true,
      contact: [`mailto:${email}`]
    });

    const names = wildcard ? [`*.${domain}`, domain] : [domain];
    const [key, csr] = await acme.crypto.createCsr({
      commonName: names[0],
      altNames: names
    });

    const cert = await client.auto({
      csr,
      email,
      termsOfServiceAgreed: true,
      challengeCreateFn: async (authz, challenge, keyAuthorization) => {
        if (challenge.type !== "dns-01") return;
        const txt = acme.crypto
          .createHash("sha256")
          .update(keyAuthorization)
          .digest("base64url");
        await updateTxt(creds, txt);
        await new Promise(r => setTimeout(r, 20000));
      },
      challengeRemoveFn: async () => {}
    });

    const dir = path.join(CERTS_DIR, domain);
    await fs.ensureDir(dir);
    await fs.writeFile(path.join(dir, "privkey.pem"), key.toString());
    await fs.writeFile(path.join(dir, "fullchain.pem"), cert);

    res.status(200).json({
      success: true,
      message: "Certificate issued",
      files: ["privkey.pem", "fullchain.pem"]
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
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

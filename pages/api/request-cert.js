import axios from "axios";
import prisma from "../../lib/prisma";

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
    // Check existing
    const existing = await prisma.registration.findUnique({
      where: { domain }
    });

    if (existing) {
      return res.json({
        domain,
        cname: `_acme-challenge.${domain} -> ${existing.fulldomain}`,
        registration: {
          subdomain: existing.subdomain,
          fulldomain: existing.fulldomain
        }
      });
    }

    // Register new
    const response = await axios.post(`${ACMEDNS_BASE}/register`, {});
    const reg = response.data;

    await prisma.registration.create({
      data: {
        domain,
        subdomain: reg.subdomain,
        fulldomain: reg.fulldomain,
        username: reg.username,
        password: reg.password,
        wildcard: Boolean(wildcard)
      }
    });

    return res.json({
      domain,
      cname: `_acme-challenge.${domain} -> ${reg.fulldomain}`,
      registration: reg
    });
  } catch (err) {
    return res.status(500).json({
      error: err?.response?.data || err?.message || "Internal Server Error"
    });
  }
}
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

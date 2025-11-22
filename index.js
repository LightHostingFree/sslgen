
const express = require('express');
const axios = require('axios');
const acme = require('acme-client');

const app = express();
app.use(express.json());

const ACME_DIRECTORY = 'https://acme-v02.api.letsencrypt.org/directory';
const ACMEDNS_BASE = 'https://acme.getfreeweb.site';

const registrations = {};

async function registerWithAcmeDns(domain) {
  const res = await axios.post(`${ACMEDNS_BASE}/register`, {});
  const reg = { ...res.data };
  registrations[domain] = reg;
  return reg;
}

async function updateAcmeDnsTxt(reg, txtValue) {
  const body = { subdomain: reg.subdomain, txt: txtValue };
  const auth = { username: reg.username, password: reg.password };
  const res = await axios.post(`${ACMEDNS_BASE}/update`, body, { auth });
  return res.data;
}

app.post('/api/register-domain', async (req, res) => {
  const { domain } = req.body;
  if (!domain) return res.status(400).json({ error: 'domain required' });
  try {
    const reg = await registerWithAcmeDns(domain);
    res.json({
      domain,
      registration: reg,
      cname: `_acme-challenge.${domain} -> ${reg.fulldomain}`
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = app;

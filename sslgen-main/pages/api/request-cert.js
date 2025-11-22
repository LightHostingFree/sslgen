import axios from 'axios';
import prisma from '../../lib/prisma';
import acme from 'acme-client';

module.exports = async function(req,res) {
  try {

  if(req.method!=='POST') return res.status(405).end();
  const { domain, wildcard } = req.body;
  if(!domain) return res.status(400).json({ error: 'domain required' });
  const reg = await prisma.registration.findUnique({ where: { domain } });
  if(!reg) return res.status(400).json({ error: 'domain not registered' });
  const ACMEDNS_BASE = process.env.ACMEDNS_BASE || 'https://acme.getfreeweb.site';
  const ACME_DIRECTORY = process.env.ACME_DIRECTORY || 'https://acme-staging-v02.api.letsencrypt.org/directory';
  try{
    const accountKey = await acme.openssl.createPrivateKey();
    const domainKey = await acme.openssl.createPrivateKey();
    const client = new acme.Client({ directoryUrl: ACME_DIRECTORY, accountKey });
    await client.createAccount({ termsOfServiceAgreed: true });
    const identifiers = wildcard ? [{type:'dns',value:`*.${domain}`},{type:'dns',value:domain}] : [{type:'dns',value:domain}];
    const order = await client.createOrder({ identifiers });
    const authorizations = await client.getAuthorizations(order);
    for(const authz of authorizations){
      const challenge = authz.challenges.find(c=>c.type==='dns-01');
      if(!challenge) throw new Error('no dns-01 challenge');
      const keyAuth = await client.getChallengeKeyAuthorization(challenge);
      const dnsValue = acme.forge.digest('sha256', keyAuth).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
      await axios.post(`${ACMEDNS_BASE}/update`, { subdomain: reg.subdomain, txt: dnsValue }, { auth: { username: reg.username, password: reg.password } });
      await client.verifyChallenge(authz, challenge);
      await client.completeChallenge(challenge);
    }
    await client.waitForValidStatus(order);
    const [csr, csrPem] = await acme.openssl.createCSR({ commonName: domain, altNames: wildcard ? [domain, `*.${domain}`] : [domain] });
    const cert = await client.finalizeOrder(order, csr);
    const expiresAt = new Date(Date.now() + 90*24*3600*1000);
    await prisma.cert.create({ data: { domain, certPem: cert, keyPem: domainKey, expiresAt } });
    return res.json({ certificate: cert, privateKey: domainKey });
  }catch(e){
    return res.status(500).json({ error: e.response?.data || e.message });
  }

  } catch (err) {
    console.error('request-cert handler error:', err);
    if (err && err.response) console.error('response data:', err.response.data || err.response);
    return arguments[1] && arguments[1].status ? arguments[1].status(500).json({ error: err.message || String(err) }) : null;
  }
}

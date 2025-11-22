const axios = require('axios');
const db = require('../../../lib_db');
const acme = require('acme-client');
module.exports = async (req,res)=>{
  if(req.method!=='POST') return res.status(405).end();
  const {domain,wildcard} = req.body;
  if(!domain) return res.status(400).json({error:'domain required'});
  const row = db.prepare('SELECT * FROM registrations WHERE domain = ?').get(domain);
  if(!row) return res.status(400).json({error:'domain not registered'});
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
      await axios.post(`${ACMEDNS_BASE}/update`, { subdomain: row.subdomain, txt: dnsValue }, { auth:{ username: row.username, password: row.password }});
      await client.verifyChallenge(authz, challenge);
      await client.completeChallenge(challenge);
    }
    await client.waitForValidStatus(order);
    const [csr, csrPem] = await acme.openssl.createCSR({ commonName: domain, altNames: wildcard ? [domain,`*.${domain}`] : [domain] });
    const cert = await client.finalizeOrder(order, csr);
    db.prepare('INSERT INTO certs (domain,cert,key,issued_at,expires_at) VALUES (?,?,?,?,?)').run(domain, cert, domainKey, Date.now(), Date.now()+90*24*3600*1000);
    return res.json({certificate:cert, privateKey:domainKey});
  }catch(e){
    return res.status(500).json({error: e.response?.data || e.message});
  }
}

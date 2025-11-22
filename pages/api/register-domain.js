const axios = require('axios');
const db = require('../../../lib_db');
module.exports = async (req,res)=>{
  if(req.method!=='POST') return res.status(405).end();
  const {domain,wildcard} = req.body;
  if(!domain) return res.status(400).json({error:'domain required'});
  const ACMEDNS_BASE = process.env.ACMEDNS_BASE || 'https://acme.getfreeweb.site';
  try{
    const r = await axios.post(`${ACMEDNS_BASE}/register`, {});
    const reg = r.data;
    db.prepare('INSERT OR REPLACE INTO registrations (domain,subdomain,fulldomain,username,password,wildcard,created) VALUES (?,?,?,?,?,?,?)').run(domain,reg.subdomain,reg.fulldomain,reg.username,reg.password,wildcard?1:0,Date.now());
    return res.json({domain,registration:reg,cname:`_acme-challenge.${domain} -> ${reg.fulldomain}`});
  }catch(e){
    return res.status(500).json({error: e.response?.data || e.message});
  }
}

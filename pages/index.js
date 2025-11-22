import {useState} from 'react'
export default function Home(){
  const [domain,setDomain]=useState(''); const [cname,setCname]=useState(null); const [cert,setCert]=useState(null); const [wild,setWild]=useState(false); const [err,setErr]=useState(null); const [loading,setLoading]=useState(false);
  async function reg(){ setLoading(true); setErr(null); try{ const r=await fetch('/api/register-domain',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({domain,wildcard:wild})}); const d=await r.json(); if(d.error) throw new Error(d.error); setCname(d.cname); }catch(e){ setErr(e.message);} setLoading(false); }
  async function req(){ setLoading(true); setErr(null); try{ const r=await fetch('/api/request-cert',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({domain,wildcard:wild})}); const d=await r.json(); if(d.error) throw new Error(d.error); setCert(d); }catch(e){ setErr(e.message);} setLoading(false); }
  return <div className="min-h-screen bg-gradient-to-br from-sky-50 to-indigo-50 flex items-center justify-center p-6">
    <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-3xl">
      <h1 className="text-2xl font-bold mb-4">SSL Generator</h1>
      {err && <div className="p-3 bg-red-50 text-red-700 mb-3">{err}</div>}
      <div className="mb-3"><input value={domain} onChange={e=>setDomain(e.target.value)} className="w-full p-3 rounded-xl border" placeholder="example.com"/></div>
      <div className="mb-3"><label className="flex items-center gap-2"><input type="checkbox" checked={wild} onChange={e=>setWild(e.target.checked)}/> Wildcard</label></div>
      <div className="flex gap-2"><button onClick={reg} className="px-4 py-2 bg-blue-600 text-white rounded-xl">Register</button><button onClick={req} className="px-4 py-2 bg-green-600 text-white rounded-xl">Generate</button></div>
      {cname && <div className="mt-4 p-3 bg-gray-50 rounded-xl font-mono">{cname}</div>}
      {cert && <div className="mt-4"><h3 className="font-semibold">Certificate</h3><textarea className="w-full h-40 p-2 font-mono">{cert.certificate}</textarea></div>}
    </div>
  </div>
}

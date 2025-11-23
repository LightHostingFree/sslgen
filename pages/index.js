import { useAuth, SignInButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import { useState } from 'react';

export default function Home(){
  const { user } = useAuth?.() || {};
  const [domain,setDomain]=useState(''); const [wild,setWild]=useState(false);
  const [cname,setCname]=useState(null); const [cert,setCert]=useState(null); const [err,setErr]=useState(null);

  async function registerDomain(){
    setErr(null);
    const res = await fetch('/api/register-domain',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({domain,wildcard:wild})});
    const d = await res.json();
    if(d.error) setErr(d.error); else setCname(d.cname);
  }
  async function requestCert(){
    setErr(null);
    const res = await fetch('/api/request-cert',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({domain,wildcard:wild})});
    const d = await res.json();
    if(d.error) setErr(d.error); else setCert(d);
  }

  return <div className='min-h-screen bg-gradient-to-tr from-sky-50 to-indigo-50 flex items-center justify-center p-6'>
    <div className='bg-white rounded-3xl shadow-xl p-8 w-full max-w-3xl'>
      <div className='flex justify-between items-center mb-6'>
        <h1 className='text-2xl font-bold'>SSL Generator</h1>
        <div>{/* Clerk auth UI */}<SignedIn><UserButton/></SignedIn><SignedOut><SignInButton/></SignedOut></div>
      </div>
      <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mb-4'>
        <div className='col-span-2'>
          <div className='flex items-center gap-1 p-3 rounded-xl border bg-white'>
            <input value={domain} onChange={e=>setDomain(e.target.value)} className='flex-1 outline-none' placeholder='example' />
            <span className='text-gray-400'>.acme.getfreeweb.site</span>
          </div>
        </div>
        <label className='flex items-center gap-2 p-3 bg-gray-50 rounded-xl border'>
          <input type='checkbox' checked={wild} onChange={e=>setWild(e.target.checked)} /> Wildcard
        </label>
      </div>
      <div className='flex gap-3 mb-4'>
        <button onClick={registerDomain} className='px-5 py-3 bg-blue-600 text-white rounded-xl'>Register</button>
        <button onClick={requestCert} className='px-5 py-3 bg-green-600 text-white rounded-xl'>Generate</button>
      </div>
      {cname && <div className='p-4 bg-gray-50 rounded-xl font-mono mb-3'>{cname}</div>}
      {cert && <div><h3 className='font-semibold'>Certificate</h3><textarea className='w-full h-40 p-2 font-mono'>{cert.certificate}</textarea></div>}
    </div>
  </div>
}

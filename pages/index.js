import { useEffect, useState } from 'react';

const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function Home() {
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [domain, setDomain] = useState('');
  const [wildcard, setWildcard] = useState(false);
  const [cname, setCname] = useState('');
  const [error, setError] = useState('');
  const [certificates, setCertificates] = useState([]);

  useEffect(() => {
    const saved = window.localStorage.getItem('token') || '';
    setToken(saved);
  }, []);

  useEffect(() => {
    if (token) loadCertificates(token);
  }, [token]);

  async function auth(path) {
    setError('');
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error || 'Request failed');
    window.localStorage.setItem('token', data.token);
    setToken(data.token);
  }

  async function loadCertificates(activeToken = token) {
    const res = await fetch('/api/certificates', {
      headers: { Authorization: `Bearer ${activeToken}` }
    });
    const data = await res.json();
    if (res.ok) setCertificates(data.certificates || []);
  }

  async function registerDomain() {
    setError('');
    const res = await fetch('/api/register-domain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ domain, wildcard })
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error || 'Failed to register');
    setCname(data.cname);
    loadCertificates();
  }

  async function generateCertificate() {
    setError('');
    const res = await fetch('/api/request-cert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ domain, wildcard })
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error || 'Failed to generate');
    setCname(data.cname);
    loadCertificates();
  }

  function logout() {
    window.localStorage.removeItem('token');
    setToken('');
    setCertificates([]);
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-100 p-6 flex items-center justify-center">
        <div className="bg-white p-6 rounded-xl w-full max-w-md shadow">
          <h1 className="text-xl font-bold mb-4">SSL Platform Login / Register</h1>
          {!clerkPublishableKey && <p className="mb-3 text-red-600">NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is not configured</p>}
          <input className="w-full border rounded p-2 mb-2" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="w-full border rounded p-2 mb-4" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <div className="flex gap-2">
            <button onClick={() => auth('/api/auth/login')} className="bg-blue-600 text-white px-4 py-2 rounded">Login</button>
            <button onClick={() => auth('/api/auth/register')} className="bg-green-600 text-white px-4 py-2 rounded">Register</button>
          </div>
          {error && <p className="mt-3 text-red-600">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-xl p-6 shadow">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">SSL Dashboard</h1>
          <button onClick={logout} className="text-sm px-3 py-1 border rounded">Logout</button>
        </div>
        <div className="grid md:grid-cols-3 gap-3 mb-3">
          <input className="md:col-span-2 border rounded p-2" placeholder="example.com" value={domain} onChange={(e) => setDomain(e.target.value)} />
          <label className="border rounded p-2 flex items-center gap-2">
            <input type="checkbox" checked={wildcard} onChange={(e) => setWildcard(e.target.checked)} />
            Wildcard
          </label>
        </div>
        <div className="flex gap-2 mb-4">
          <button onClick={registerDomain} className="bg-blue-600 text-white px-4 py-2 rounded">1) Register Domain</button>
          <button onClick={generateCertificate} className="bg-green-600 text-white px-4 py-2 rounded">2) Generate SSL</button>
        </div>
        {cname && <div className="bg-yellow-50 border p-3 rounded mb-4 font-mono">Create CNAME: {cname}</div>}
        {error && <p className="mb-3 text-red-600">{error}</p>}
        <h2 className="font-semibold mb-2">Certificates</h2>
        <div className="space-y-2">
          {certificates.map((item) => (
            <div key={item.id} className="border rounded p-3">
              <div className="font-medium">{item.domain}</div>
              <div className="text-sm">Status: {item.status}</div>
              <div className="text-sm font-mono">_acme-challenge.{item.domain} → {item.cnameTarget}</div>
            </div>
          ))}
          {!certificates.length && <div className="text-sm text-gray-500">No certificates yet</div>}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';

const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function Home() {
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [domain, setDomain] = useState('');
  const [wildcard, setWildcard] = useState(false);
  const [includeWww, setIncludeWww] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [currentView, setCurrentView] = useState('list');
  const [filter, setFilter] = useState('ALL');
  const [validationData, setValidationData] = useState(null);
  const [selectedCertificate, setSelectedCertificate] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
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
    const query = filter === 'ALL' ? '' : `?status=${encodeURIComponent(filter)}`;
    const res = await fetch(`/api/certificates${query}`, {
      headers: { Authorization: `Bearer ${activeToken}` }
    });
    const data = await res.json();
    if (res.ok) setCertificates(data.certificates || []);
  }

  useEffect(() => {
    if (token) loadCertificates();
  }, [filter, token]);

  async function createOrder() {
    setError('');
    setSuccess('');
    const res = await fetch('/api/register-domain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ domain })
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error || 'Failed to register');
    setValidationData({ domain: data.domain || domain, cname: data.cname, includeWww, wildcard });
    setCurrentView('validate');
    await loadCertificates();
  }

  async function generateCertificate(order = validationData) {
    setError('');
    setSuccess('');
    const res = await fetch('/api/request-cert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ domain: order.domain, wildcard: order.wildcard, includeWww: order.includeWww })
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error || 'Failed to generate');
    setSuccess('Certificate issued successfully.');
    setValidationData(null);
    setCurrentView('list');
    setDomain('');
    await loadCertificates();
  }

  function logout() {
    window.localStorage.removeItem('token');
    setToken('');
    setCertificates([]);
  }

  function formatDate(value) {
    if (!value) return '-';
    return new Date(value).toLocaleDateString();
  }

  function filteredCertificates() {
    if (filter === 'ALL') return certificates;
    return certificates.filter((certificate) => certificate.status === filter);
  }

  function statusBadgeClass(status) {
    if (status === 'ISSUED') return 'bg-green-600';
    if (status === 'ACTION_REQUIRED') return 'bg-amber-500';
    if (status === 'FAILED') return 'bg-red-600';
    return 'bg-gray-500';
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

  if (currentView === 'new') {
    return (
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-3xl mx-auto bg-white rounded-xl p-6 shadow">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold">Order New SSL Certificate</h1>
            <button onClick={() => setCurrentView('list')} className="text-sm px-3 py-1 border rounded">Back</button>
          </div>
          <label className="block text-sm font-medium mb-1">Domain Name</label>
          <input className="w-full border rounded p-2 mb-2" placeholder="example.com" value={domain} onChange={(e) => setDomain(e.target.value)} />
          <p className="text-xs text-gray-600 mb-3">Auto-include www</p>
          <label className="border rounded p-2 mb-3 flex items-center gap-2">
            <input type="checkbox" checked={includeWww} onChange={(e) => setIncludeWww(e.target.checked)} />
            Include www subdomain
          </label>
          <button onClick={() => setAdvancedOpen((value) => !value)} aria-expanded={advancedOpen} className="text-sm underline mb-2">Advanced options</button>
          {advancedOpen && (
            <label className="border rounded p-2 mb-4 flex items-center gap-2">
              <input type="checkbox" checked={wildcard} onChange={(e) => setWildcard(e.target.checked)} />
              Request wildcard certificate
            </label>
          )}
          <button onClick={createOrder} className="bg-blue-600 text-white px-4 py-2 rounded">Create Order</button>
          {error && <p className="mt-3 text-red-600">{error}</p>}
        </div>
      </div>
    );
  }

  if (currentView === 'validate' && validationData) {
    const cnameTarget = validationData.cname.split(' -> ')[1] || validationData.cname;
    return (
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-3xl mx-auto bg-white rounded-xl p-6 shadow">
          <h1 className="text-2xl font-bold mb-2">Validate your domain name</h1>
          <p className="mb-4">Create the DNS record below, wait for propagation, then continue.</p>
          <div className="border rounded p-4 bg-gray-50 space-y-2 font-mono text-sm mb-4">
            <div>Record Type: CNAME</div>
            <div>Name: _acme-challenge.{validationData.domain}</div>
            <div>Value: {cnameTarget}</div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => generateCertificate(validationData)} className="bg-green-600 text-white px-4 py-2 rounded">Continue Validation</button>
            <button onClick={() => setCurrentView('list')} className="px-4 py-2 border rounded">Back to Certificates</button>
          </div>
          {error && <p className="mt-3 text-red-600">{error}</p>}
        </div>
      </div>
    );
  }

  if (currentView === 'detail' && selectedCertificate) {
    return (
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">Let&apos;s Encrypt SSL Certificate for {selectedCertificate.domain}</h1>
            <button onClick={() => setCurrentView('list')} className="text-sm px-3 py-1 border rounded">Back</button>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-3">
              <section className="bg-white border rounded">
                <div className="px-4 py-3 border-b font-semibold">Step 4: Install SSL Certificate</div>
                <div className="px-4 py-3 text-sm text-gray-700">
                  Use the private key and certificate files to install SSL on your hosting account or server.
                </div>
                <div className="px-4 pb-4">
                  <button className="px-3 py-2 border rounded text-sm">View Private Key and Certificate</button>
                </div>
              </section>
              <section className="bg-white border rounded">
                <div className="px-4 py-3 border-b font-semibold">Step 5: Verify Installation on {selectedCertificate.domain}</div>
                <div className="px-4 py-3 text-sm text-gray-700">
                  Check whether your website is serving the issued SSL certificate correctly.
                </div>
                <div className="px-4 pb-4 text-sm">
                  <div className="grid grid-cols-3 gap-y-2">
                    <div className="font-medium">Status</div>
                    <div className="col-span-2"><span className={`text-white text-xs px-2 py-1 rounded ${statusBadgeClass(selectedCertificate.status)}`}>{selectedCertificate.status}</span></div>
                    <div className="font-medium">Issuer</div>
                    <div className="col-span-2">Let&apos;s Encrypt</div>
                    <div className="font-medium">Expires at</div>
                    <div className="col-span-2">{formatDate(selectedCertificate.expiresAt)}</div>
                  </div>
                </div>
              </section>
              <section className="bg-white border rounded">
                <div className="px-4 py-3 border-b font-semibold">Step 6: Make your website use HTTPS</div>
                <div className="px-4 py-3 text-sm text-gray-700">
                  <ol className="list-decimal pl-5 space-y-1">
                    <li>Make sure all URLs use HTTPS and your address bar shows a secure lock.</li>
                    <li>Force all visitors to use HTTPS with your server or application settings.</li>
                  </ol>
                </div>
              </section>
              <button className="text-sm text-purple-700">Delete Certificate Order</button>
            </div>
            <aside className="bg-white border rounded p-4 text-sm h-fit">
              <h2 className="font-semibold mb-3">Certificate Details</h2>
              <div className="space-y-2 text-gray-700">
                <p><span className="block text-xs text-gray-500">DOMAIN</span>{selectedCertificate.domain}</p>
                <p><span className="block text-xs text-gray-500">CERTIFICATE PROVIDER</span>Let&apos;s Encrypt</p>
                <p><span className="block text-xs text-gray-500">STATUS</span>{selectedCertificate.status}</p>
                <p><span className="block text-xs text-gray-500">CREATED AT</span>{formatDate(selectedCertificate.createdAt)}</p>
                <p><span className="block text-xs text-gray-500">ISSUE DATE</span>{formatDate(selectedCertificate.issuedAt)}</p>
                <p><span className="block text-xs text-gray-500">EXPIRATION DATE</span>{formatDate(selectedCertificate.expiresAt)}</p>
                <label className="flex items-center justify-between pt-2 border-t">
                  <span className="text-xs text-gray-500">SEND EXPIRATION REMINDERS</span>
                  <input type="checkbox" defaultChecked />
                </label>
              </div>
            </aside>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto bg-white rounded-xl p-6 shadow">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">SSL Certificates</h1>
          <div className="flex gap-2">
            <button onClick={() => setCurrentView('new')} className="bg-blue-600 text-white px-4 py-2 rounded">➕ New SSL Certificate</button>
            <button onClick={logout} className="text-sm px-3 py-1 border rounded">Logout</button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {['ALL', 'ACTION_REQUIRED', 'ISSUED', 'EXPIRED', 'REVOKED', 'FAILED'].map((status) => (
            <button key={status} onClick={() => setFilter(status)} aria-pressed={filter === status} className={`px-3 py-1 rounded border ${filter === status ? 'bg-gray-900 text-white' : ''}`}>
              {status.replace('_', ' ')}
            </button>
          ))}
        </div>
        {success && <p className="mb-3 text-green-700">{success}</p>}
        {error && <p className="mb-3 text-red-600">{error}</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2">Domain</th>
                <th className="py-2">Provider</th>
                <th className="py-2">Status</th>
                <th className="py-2">Issued</th>
                <th className="py-2">Expired</th>
                <th className="py-2">Action Required</th>
                <th className="py-2">Failed</th>
                <th className="py-2">Expires At</th>
                <th className="py-2">Manage</th>
              </tr>
            </thead>
            <tbody>
              {filteredCertificates().map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="py-2">{item.domain}</td>
                  <td className="py-2">Let&apos;s Encrypt</td>
                  <td className="py-2">{item.status}</td>
                  <td className="py-2">{item.issuedAt ? 'Yes' : '-'}</td>
                  <td className="py-2">{item.status === 'EXPIRED' ? 'Yes' : '-'}</td>
                  <td className="py-2">{item.status === 'ACTION_REQUIRED' ? 'Yes' : '-'}</td>
                  <td className="py-2">{item.status === 'FAILED' ? 'Yes' : '-'}</td>
                  <td className="py-2">{formatDate(item.expiresAt)}</td>
                  <td className="py-2">
                    <button
                      className="px-3 py-1 border rounded"
                      onClick={() => {
                        if (item.status === 'ACTION_REQUIRED') {
                          setValidationData({
                            domain: item.domain,
                            cname: `_acme-challenge.${item.domain} -> ${item.cnameTarget}`,
                            includeWww: true,
                            wildcard: false
                          });
                          setCurrentView('validate');
                          return;
                        }
                        setSelectedCertificate(item);
                        setCurrentView('detail');
                      }}
                    >
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
              {!filteredCertificates().length && (
                <tr>
                  <td colSpan="9" className="py-4 text-gray-500">No certificates found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

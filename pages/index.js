import { useEffect, useState } from 'react';

const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const SERVER_REQUEST_MAX_DURATION_MS = 300000;
const REQUEST_TIMEOUT_MS = SERVER_REQUEST_MAX_DURATION_MS + 10000;

async function safeJsonParse(res) {
  try {
    return await res.json();
  } catch {
    if (res.status === 504) {
      return { error: 'The server took too long to respond (HTTP 504). This can happen during certificate validation. Please try again.' };
    }
    return { error: `An unexpected error occurred (HTTP ${res.status})` };
  }
}

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
  const [isValidating, setIsValidating] = useState(false);
  const [certKeys, setCertKeys] = useState(null);

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
    const data = await safeJsonParse(res);
    if (!res.ok) return setError(data.error || 'Request failed');
    window.localStorage.setItem('token', data.token);
    setToken(data.token);
  }

  async function loadCertificates(activeToken = token, statusFilter = filter) {
    const query = statusFilter === 'ALL' ? '' : `?status=${encodeURIComponent(statusFilter)}`;
    const res = await fetch(`/api/certificates${query}`, {
      headers: { Authorization: `Bearer ${activeToken}` }
    });
    const data = await safeJsonParse(res);
    if (res.ok) {
      setCertificates(data.certificates || []);
    } else if (res.status === 401) {
      // Authorization failed, clear token and show error
      window.localStorage.removeItem('token');
      setToken(null);
      setError(data.error || 'Session expired. Please login again.');
    }
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
    const data = await safeJsonParse(res);
    if (!res.ok) {
      if (res.status === 401) {
        window.localStorage.removeItem('token');
        setToken(null);
        return setError(data.error || 'Session expired. Please login again.');
      }
      return setError(data.error || 'Failed to register');
    }
    setValidationData({ domain: data.domain || domain, cname: data.cname, includeWww, wildcard });
    setCurrentView('validate');
    await loadCertificates();
  }

  async function generateCertificate(order = validationData) {
    setError('');
    setSuccess('');
    if (!order?.domain) return setError('Domain is required to generate certificate');
    setIsValidating(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch('/api/request-cert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ domain: order.domain, wildcard: order.wildcard, includeWww: order.includeWww }),
        signal: controller.signal
      });
      const data = await safeJsonParse(res);
      if (!res.ok) {
        if (res.status === 401) {
          window.localStorage.removeItem('token');
          setToken(null);
          return setError(data.error || 'Session expired. Please login again.');
        }
        return setError(data.error || 'Failed to generate');
      }
      setSuccess('Certificate issued successfully.');
      setValidationData(null);
      setCurrentView('list');
      setDomain('');
      // Reset filter to 'ALL' so all certificates appear after generation.
      // setFilter schedules the state update for the next render, so we also
      // pass 'ALL' explicitly to loadCertificates to avoid stale closure.
      setFilter('ALL');
      await loadCertificates(token, 'ALL');
    } catch (requestError) {
      const errorMessage = requestError.name === 'AbortError'
        ? 'Validation timed out. Please try again.'
        : requestError?.message || 'Validation failed. Please try again.';
      setError(errorMessage);
    } finally {
      clearTimeout(timeoutId);
      setIsValidating(false);
    }
  }

  async function viewCertificateKeys(id) {
    setError('');
    const res = await fetch(`/api/certificates/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await safeJsonParse(res);
    if (!res.ok) return setError(data.error || 'Failed to load certificate');
    setCertKeys(data);
  }

  async function deleteCertificate(id) {
    if (!confirm('Are you sure you want to delete this certificate order? This action cannot be undone.')) return;
    setError('');
    const res = await fetch(`/api/certificates/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await safeJsonParse(res);
    if (!res.ok) return setError(data.error || 'Failed to delete certificate');
    setSelectedCertificate(null);
    setCertKeys(null);
    setCurrentView('list');
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
    if (status === 'ISSUED') return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
    if (status === 'ACTION_REQUIRED') return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
    if (status === 'FAILED') return 'bg-red-500/20 text-red-400 border border-red-500/30';
    if (status === 'EXPIRED') return 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
    if (status === 'REVOKED') return 'bg-purple-500/20 text-purple-400 border border-purple-500/30';
    return 'bg-slate-500/20 text-slate-400 border border-slate-500/30';
  }

  const LockIcon = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );

  const ShieldIcon = () => (
    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );

  const Spinner = () => (
    <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 mb-4 shadow-lg shadow-blue-500/30">
              <ShieldIcon />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">SSL Generator</h1>
            <p className="text-slate-400 mt-1">Secure your domains with free SSL certificates</p>
          </div>
          <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-slate-700/50">
            <h2 className="text-lg font-semibold text-white mb-6">Sign in to your account</h2>
            {!clerkPublishableKey && (
              <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is not configured
              </div>
            )}
            <div className="space-y-3">
              <input
                className="w-full bg-slate-900/60 border border-slate-600/50 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                className="w-full bg-slate-900/60 border border-slate-600/50 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition"
                placeholder="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => auth('/api/auth/login')}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold px-4 py-3 rounded-xl transition shadow-lg shadow-blue-500/20"
              >
                Login
              </button>
              <button
                onClick={() => auth('/api/auth/register')}
                className="flex-1 bg-slate-700/80 hover:bg-slate-600/80 text-white font-semibold px-4 py-3 rounded-xl border border-slate-600/50 transition"
              >
                Register
              </button>
            </div>
            {error && (
              <div className="mt-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (currentView === 'new') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow shadow-blue-500/30">
              <LockIcon />
            </div>
            <span className="text-white font-bold text-lg">SSL Generator</span>
          </div>
          <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl shadow-2xl border border-slate-700/50">
            <div className="flex justify-between items-center px-6 py-5 border-b border-slate-700/50">
              <h1 className="text-xl font-bold text-white">Order New SSL Certificate</h1>
              <button
                onClick={() => setCurrentView('list')}
                className="text-sm px-4 py-2 rounded-xl bg-slate-700/60 hover:bg-slate-600/60 text-slate-300 border border-slate-600/50 transition"
              >
                ← Back
              </button>
            </div>
            <div className="px-6 py-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Domain Name</label>
                <input
                  className="w-full bg-slate-900/60 border border-slate-600/50 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition"
                  placeholder="example.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                />
                <p className="text-xs text-slate-500 mt-1.5">Enter the root domain — www can be included automatically below.</p>
              </div>
              <label className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-600/50 bg-slate-900/40 cursor-pointer hover:border-blue-500/50 transition">
                <input
                  type="checkbox"
                  checked={includeWww}
                  onChange={(e) => setIncludeWww(e.target.checked)}
                  className="w-4 h-4 accent-blue-500"
                />
                <span className="text-sm text-slate-300">Include www subdomain</span>
              </label>
              <div>
                <button
                  onClick={() => setAdvancedOpen((value) => !value)}
                  aria-expanded={advancedOpen}
                  className="text-sm text-blue-400 hover:text-blue-300 transition flex items-center gap-1"
                >
                  <span>{advancedOpen ? '▾' : '▸'}</span> Advanced options
                </button>
                {advancedOpen && (
                  <label className="mt-3 flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-600/50 bg-slate-900/40 cursor-pointer hover:border-blue-500/50 transition">
                    <input
                      type="checkbox"
                      checked={wildcard}
                      onChange={(e) => setWildcard(e.target.checked)}
                      className="w-4 h-4 accent-blue-500"
                    />
                    <span className="text-sm text-slate-300">Request wildcard certificate (*.example.com)</span>
                  </label>
                )}
              </div>
              <button
                onClick={createOrder}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold px-4 py-3 rounded-xl transition shadow-lg shadow-blue-500/20"
              >
                Create Order
              </button>
              {error && (
                <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === 'validate' && validationData) {
    const cnameTarget = validationData.cname.split(' -> ')[1] || validationData.cname;
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow shadow-blue-500/30">
              <LockIcon />
            </div>
            <span className="text-white font-bold text-lg">SSL Generator</span>
          </div>
          <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl shadow-2xl border border-slate-700/50">
            <div className="px-6 py-5 border-b border-slate-700/50">
              <h1 className="text-xl font-bold text-white">Validate Your Domain</h1>
              <p className="text-slate-400 text-sm mt-1">Add the DNS record below, wait for propagation, then click continue.</p>
            </div>
            <div className="px-6 py-6 space-y-5">
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 overflow-hidden">
                <div className="px-4 py-2 bg-blue-500/10 border-b border-blue-500/20">
                  <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">DNS Record to Add</span>
                </div>
                <div className="px-4 py-4 space-y-3 font-mono text-sm">
                  <div className="flex items-start gap-3">
                    <span className="text-slate-500 w-28 shrink-0">Record Type</span>
                    <span className="text-white font-semibold">CNAME</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-slate-500 w-28 shrink-0">Name</span>
                    <span className="text-cyan-300 break-all">_acme-challenge.{validationData.domain}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-slate-500 w-28 shrink-0">Value</span>
                    <span className="text-cyan-300 break-all">{cnameTarget}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  disabled={isValidating}
                  onClick={() => generateCertificate(validationData)}
                  className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold px-5 py-3 rounded-xl transition shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isValidating && <Spinner />}
                  {isValidating ? 'Validating…' : 'Continue Validation'}
                </button>
                <button
                  disabled={isValidating}
                  onClick={() => setCurrentView('list')}
                  className="px-5 py-3 rounded-xl bg-slate-700/60 hover:bg-slate-600/60 text-slate-300 border border-slate-600/50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Back
                </button>
              </div>
              {error && (
                <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === 'detail' && selectedCertificate) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow shadow-blue-500/30">
              <LockIcon />
            </div>
            <span className="text-white font-bold text-lg">SSL Generator</span>
          </div>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-2xl font-bold text-white">SSL Certificate</h1>
              <p className="text-slate-400 text-sm mt-0.5">{selectedCertificate.domain}</p>
            </div>
            <button
              onClick={() => { setCertKeys(null); setCurrentView('list'); }}
              className="text-sm px-4 py-2 rounded-xl bg-slate-700/60 hover:bg-slate-600/60 text-slate-300 border border-slate-600/50 transition"
            >
              ← Back
            </button>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            <div className="md:col-span-2 space-y-4">
              <section className="bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-slate-700/50">
                <div className="px-5 py-4 border-b border-slate-700/50">
                  <h2 className="font-semibold text-white">Step 4: Install SSL Certificate</h2>
                </div>
                <div className="px-5 py-4 text-sm text-slate-400">
                  Use the private key and certificate files to install SSL on your hosting account or server.
                </div>
                <div className="px-5 pb-5">
                  <button
                    onClick={() => viewCertificateKeys(selectedCertificate.id)}
                    className="px-4 py-2.5 rounded-xl bg-slate-700/60 hover:bg-slate-600/60 text-slate-200 border border-slate-600/50 text-sm transition"
                  >
                    View Private Key and Certificate
                  </button>
                </div>
              </section>
              {certKeys && (
                <section className="bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-slate-700/50">
                  <div className="px-5 py-4 border-b border-slate-700/50">
                    <h2 className="font-semibold text-white">Private Key and Certificate</h2>
                  </div>
                  <div className="px-5 py-4 space-y-4">
                    {[
                      { label: 'PRIVATE KEY', value: certKeys.privateKey },
                      { label: 'CERTIFICATE', value: certKeys.certificate },
                      { label: 'CA BUNDLE', value: certKeys.caBundle }
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <div className="text-xs font-semibold text-slate-500 mb-2 tracking-wider">{label}</div>
                        <textarea
                          readOnly
                          className="w-full bg-slate-900/60 border border-slate-600/50 rounded-xl px-3 py-2 text-xs font-mono text-slate-300 h-40 focus:outline-none resize-none"
                          value={value || '(not available)'}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )}
              <section className="bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-slate-700/50">
                <div className="px-5 py-4 border-b border-slate-700/50">
                  <h2 className="font-semibold text-white">Step 5: Verify Installation on {selectedCertificate.domain}</h2>
                </div>
                <div className="px-5 py-4 text-sm">
                  <div className="grid grid-cols-3 gap-y-3 text-slate-300">
                    <div className="text-slate-500 font-medium">Status</div>
                    <div className="col-span-2">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusBadgeClass(selectedCertificate.status)}`}>
                        {selectedCertificate.status}
                      </span>
                    </div>
                    <div className="text-slate-500 font-medium">Issuer</div>
                    <div className="col-span-2">Let&apos;s Encrypt</div>
                    <div className="text-slate-500 font-medium">Expires at</div>
                    <div className="col-span-2">{formatDate(selectedCertificate.expiresAt)}</div>
                  </div>
                </div>
              </section>
              <section className="bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-slate-700/50">
                <div className="px-5 py-4 border-b border-slate-700/50">
                  <h2 className="font-semibold text-white">Step 6: Make Your Website Use HTTPS</h2>
                </div>
                <div className="px-5 py-4 text-sm text-slate-400">
                  <ol className="list-decimal pl-5 space-y-1.5">
                    <li>Make sure all URLs use HTTPS and your address bar shows a secure lock.</li>
                    <li>Force all visitors to use HTTPS with your server or application settings.</li>
                  </ol>
                </div>
              </section>
              <button
                onClick={() => deleteCertificate(selectedCertificate.id)}
                className="text-sm text-red-400 hover:text-red-300 transition"
              >
                Delete Certificate Order
              </button>
            </div>
            <aside className="bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-5 text-sm h-fit">
              <h2 className="font-semibold text-white mb-4">Certificate Details</h2>
              <div className="space-y-3">
                {[
                  { label: 'DOMAIN', value: selectedCertificate.domain },
                  { label: 'CERTIFICATE PROVIDER', value: "Let's Encrypt" },
                  { label: 'STATUS', value: selectedCertificate.status },
                  { label: 'CREATED AT', value: formatDate(selectedCertificate.createdAt) },
                  { label: 'ISSUE DATE', value: formatDate(selectedCertificate.issuedAt) },
                  { label: 'EXPIRATION DATE', value: formatDate(selectedCertificate.expiresAt) }
                ].map(({ label, value }) => (
                  <div key={label}>
                    <span className="block text-xs text-slate-500 mb-0.5 tracking-wider">{label}</span>
                    <span className="text-slate-300">{value}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-3 border-t border-slate-700/50">
                  <label htmlFor="send-expiration-reminders" className="text-xs text-slate-500 tracking-wider">
                    EXPIRATION REMINDERS
                  </label>
                  <input id="send-expiration-reminders" type="checkbox" defaultChecked className="w-4 h-4 accent-blue-500" />
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow shadow-blue-500/30">
              <LockIcon />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white leading-none">SSL Generator</h1>
              <p className="text-slate-500 text-xs mt-0.5">Your SSL Certificates</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setCurrentView('new')}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold px-4 py-2.5 rounded-xl transition shadow-lg shadow-blue-500/20 text-sm"
            >
              <span className="text-base">+</span> New Certificate
            </button>
            <button
              onClick={logout}
              className="text-sm px-4 py-2.5 rounded-xl bg-slate-700/60 hover:bg-slate-600/60 text-slate-300 border border-slate-600/50 transition"
            >
              Logout
            </button>
          </div>
        </div>
        <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl shadow-2xl border border-slate-700/50">
          <div className="px-5 py-4 border-b border-slate-700/50 flex flex-wrap gap-2">
            {['ALL', 'ACTION_REQUIRED', 'ISSUED', 'EXPIRED', 'REVOKED', 'FAILED'].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                aria-pressed={filter === status}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border transition ${
                  filter === status
                    ? 'bg-blue-600 text-white border-blue-500 shadow shadow-blue-500/20'
                    : 'text-slate-400 border-slate-600/50 hover:border-slate-500 hover:text-slate-300'
                }`}
              >
                {status.replace('_', ' ')}
              </button>
            ))}
          </div>
          {success && (
            <div className="mx-5 mt-4 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">
              {success}
            </div>
          )}
          {error && (
            <div className="mx-5 mt-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Domain</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Provider</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Issued</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Expired</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Action Required</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Failed</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Expires At</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Manage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {filteredCertificates().map((item) => (
                  <tr key={item.id} className="hover:bg-slate-700/20 transition">
                    <td className="px-5 py-3.5 text-white font-medium">{item.domain}</td>
                    <td className="px-5 py-3.5 text-slate-400">Let&apos;s Encrypt</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusBadgeClass(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-400">{item.issuedAt ? <span className="text-emerald-400">Yes</span> : '—'}</td>
                    <td className="px-5 py-3.5 text-slate-400">{item.status === 'EXPIRED' ? <span className="text-orange-400">Yes</span> : '—'}</td>
                    <td className="px-5 py-3.5 text-slate-400">{item.status === 'ACTION_REQUIRED' ? <span className="text-amber-400">Yes</span> : '—'}</td>
                    <td className="px-5 py-3.5 text-slate-400">{item.status === 'FAILED' ? <span className="text-red-400">Yes</span> : '—'}</td>
                    <td className="px-5 py-3.5 text-slate-400">{formatDate(item.expiresAt)}</td>
                    <td className="px-5 py-3.5">
                      <button
                        className="px-3.5 py-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-600/60 text-slate-300 border border-slate-600/50 text-xs font-medium transition"
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
                          setCertKeys(null);
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
                    <td colSpan="9" className="px-5 py-12 text-center text-slate-500">
                      <div className="inline-flex flex-col items-center gap-2">
                        <svg className="w-10 h-10 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                        </svg>
                        <span>No certificates found</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

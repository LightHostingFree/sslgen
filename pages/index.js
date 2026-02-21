import { useCallback, useEffect, useState } from 'react';

const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

const GearIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const ShieldCheckIcon = () => (
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

const PageShell = ({ children, maxWidth = 'max-w-6xl', token, logout }) => (
  <div className="min-h-screen bg-indigo-50 flex flex-col">
    <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <span className="font-bold text-gray-800 text-sm">SSL Generator</span>
      </div>
      {token && (
        <button onClick={logout} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium transition">
          Logout
        </button>
      )}
    </nav>
    <div className={`${maxWidth} mx-auto w-full px-4 py-6 flex-1`}>{children}</div>
    <footer className="text-center text-xs text-gray-400 py-4 border-t border-gray-200 bg-white">
      Made with ❤️ by Mayank Baswal
    </footer>
  </div>
);
const SERVER_REQUEST_MAX_DURATION_MS = 300000;
const REQUEST_TIMEOUT_MS = SERVER_REQUEST_MAX_DURATION_MS + 10000;

function normalizeHostname(hostname) {
  return String(hostname || '').replace(/\.$/, '').toLowerCase();
}

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
  const [mounted, setMounted] = useState(false);
  const [authView, setAuthView] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [domain, setDomain] = useState('');
  const [wildcard, setWildcard] = useState(false);
  const [includeWww, setIncludeWww] = useState(true);
  const [ca, setCa] = useState('');
  const [eabKeyId, setEabKeyId] = useState('');
  const [eabHmacKey, setEabHmacKey] = useState('');
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
  const [dnsOpen, setDnsOpen] = useState(true);
  const [dnsCheckResult, setDnsCheckResult] = useState(null);
  const [isDnsChecking, setIsDnsChecking] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem('token') || '';
    setToken(saved);
    setMounted(true);
    const params = new URLSearchParams(window.location.search);
    const rt = params.get('reset');
    if (rt) {
      setResetToken(rt);
      setAuthView('reset');
    }
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

  async function forgotPassword() {
    setError('');
    setSuccess('');
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: forgotEmail })
    });
    const data = await safeJsonParse(res);
    if (!res.ok) return setError(data.error || 'Request failed');
    setSuccess(data.message || 'Reset link sent. Check your email.');
  }

  async function resetPassword() {
    setError('');
    setSuccess('');
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: resetToken, password: newPassword })
    });
    const data = await safeJsonParse(res);
    if (!res.ok) return setError(data.error || 'Request failed');
    setSuccess(data.message || 'Password reset. You can now log in.');
    setResetToken('');
    setNewPassword('');
    window.history.replaceState({}, '', '/');
    setTimeout(() => { setAuthView('login'); setSuccess(''); }, 3000);
  }

  async function loadCertificates(activeToken = token, statusFilter = filter) {
    // Guard against invalid token to prevent fetch failures
    if (!activeToken) {
      return;
    }
    
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
    setValidationData({ domain: data.domain || domain, cname: data.cname, includeWww, wildcard, createdAt: new Date().toISOString(), ca, eabKeyId, eabHmacKey });
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
        body: JSON.stringify({ domain: order.domain, wildcard: order.wildcard, includeWww: order.includeWww, ca: order.ca, eabKeyId: order.eabKeyId, eabHmacKey: order.eabHmacKey }),
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

  const checkDns = useCallback(async (domainToCheck) => {
    setIsDnsChecking(true);
    try {
      const res = await fetch(`/api/check-dns?domain=${encodeURIComponent(domainToCheck)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await safeJsonParse(res);
      if (res.ok) setDnsCheckResult(data);
    } finally {
      setIsDnsChecking(false);
    }
  }, [token]);

  useEffect(() => {
    if (currentView === 'validate' && validationData?.domain) {
      setDnsCheckResult(null);
      checkDns(validationData.domain);
    }
  }, [currentView, validationData?.domain, checkDns]);

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

  async function toggleReminders(id, enabled) {
    const res = await fetch(`/api/certificates/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ remindersEnabled: enabled })
    });
    const data = await safeJsonParse(res);
    if (!res.ok) return setError(data.error || 'Failed to update reminder setting');
    setSelectedCertificate((prev) => ({ ...prev, remindersEnabled: enabled }));
  }

  function logout() {
    window.localStorage.removeItem('token');
    setToken('');
    setCertificates([]);
  }

  function toggleAuthView() {
    setError('');
    setAuthView((prev) => (prev === 'login' ? 'register' : 'login'));
  }

  function formatDate(value) {
    if (!value) return '-';
    return new Date(value).toLocaleDateString();
  }

  function formatDateTime(value) {
    if (!value) return '-';
    const d = new Date(value);
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const hours = String(d.getUTCHours()).padStart(2, '0');
    const minutes = String(d.getUTCMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes} UTC`;
  }

  function handleCaChange(value) {
    setCa(value);
    setEabKeyId('');
    setEabHmacKey('');
  }

  function filteredCertificates() {
    if (filter === 'ALL') return certificates;
    return certificates.filter((certificate) => certificate.status === filter);
  }

  function statusBadgeClass(status) {
    if (status === 'ISSUED') return 'bg-green-100 text-green-700 border border-green-200';
    if (status === 'ACTION_REQUIRED') return 'bg-amber-100 text-amber-700 border border-amber-200';
    if (status === 'FAILED') return 'bg-red-100 text-red-600 border border-red-200';
    if (status === 'EXPIRED') return 'bg-red-100 text-red-500 border border-red-200';
    if (status === 'REVOKED') return 'bg-purple-100 text-purple-600 border border-purple-200';
    return 'bg-gray-100 text-gray-500 border border-gray-200';
  }

  function statusLabel(status) {
    if (!status) return '';
    const map = {
      ISSUED: 'Issued',
      FAILED: 'Failed',
      EXPIRED: 'Expired',
      REVOKED: 'Revoked',
      ACTION_REQUIRED: 'Action Required'
    };
    return map[status] || status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  if (!mounted) return null;

  if (!token) {
    const isRegister = authView === 'register';
    const isForgot = authView === 'forgot';
    const isReset = authView === 'reset';

    if (isReset) {
      return (
        <div className="min-h-screen bg-indigo-50 flex items-center justify-center p-6">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 mb-4 shadow-lg shadow-indigo-300">
                <ShieldCheckIcon />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">SSL Generator</h1>
              <p className="text-gray-500 mt-1 text-sm">Free SSL certificates for your domains</p>
            </div>
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
              <h2 className="text-lg font-bold text-gray-800 mb-1">Set new password</h2>
              <p className="text-sm text-gray-500 mb-6">Enter your new password below.</p>
              <div className="space-y-3">
                <input
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition text-sm"
                  placeholder="New password (min 8 characters)"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <button
                onClick={resetPassword}
                className="mt-5 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-3 rounded-xl transition shadow-md shadow-indigo-200 text-sm"
              >
                Reset Password
              </button>
              {error && (
                <div className="mt-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>
              )}
              {success && (
                <div className="mt-4 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">{success}</div>
              )}
              <p className="mt-5 text-center text-sm text-gray-500">
                <button onClick={() => { setError(''); setSuccess(''); setAuthView('login'); }} className="text-indigo-600 hover:text-indigo-800 font-semibold transition">
                  Back to Sign In
                </button>
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (isForgot) {
      return (
        <div className="min-h-screen bg-indigo-50 flex items-center justify-center p-6">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 mb-4 shadow-lg shadow-indigo-300">
                <ShieldCheckIcon />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">SSL Generator</h1>
              <p className="text-gray-500 mt-1 text-sm">Free SSL certificates for your domains</p>
            </div>
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
              <h2 className="text-lg font-bold text-gray-800 mb-1">Forgot your password?</h2>
              <p className="text-sm text-gray-500 mb-6">Enter your email and we&apos;ll send you a reset link.</p>
              <div className="space-y-3">
                <input
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition text-sm"
                  placeholder="Email address"
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                />
              </div>
              <button
                onClick={forgotPassword}
                className="mt-5 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-3 rounded-xl transition shadow-md shadow-indigo-200 text-sm"
              >
                Send Reset Link
              </button>
              {error && (
                <div className="mt-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>
              )}
              {success && (
                <div className="mt-4 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">{success}</div>
              )}
              <p className="mt-5 text-center text-sm text-gray-500">
                <button onClick={() => { setError(''); setSuccess(''); setAuthView('login'); }} className="text-indigo-600 hover:text-indigo-800 font-semibold transition">
                  Back to Sign In
                </button>
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-indigo-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 mb-4 shadow-lg shadow-indigo-300">
              <ShieldCheckIcon />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">SSL Generator</h1>
            <p className="text-gray-500 mt-1 text-sm">Free SSL certificates for your domains</p>
          </div>
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 mb-1">
              {isRegister ? 'Create an account' : 'Welcome back'}
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              {isRegister ? 'Sign up to manage your SSL certificates.' : 'Sign in to your SSL dashboard.'}
            </p>
            {!clerkPublishableKey && (
              <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is not configured
              </div>
            )}
            <div className="space-y-3">
              <input
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition text-sm"
                placeholder="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {!isRegister && (
              <div className="mt-2 text-right">
                <button
                  onClick={() => { setError(''); setSuccess(''); setForgotEmail(email); setAuthView('forgot'); }}
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium transition"
                >
                  Forgot password?
                </button>
              </div>
            )}
            <button
              onClick={() => auth(isRegister ? '/api/auth/register' : '/api/auth/login')}
              className="mt-5 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-3 rounded-xl transition shadow-md shadow-indigo-200 text-sm"
            >
              {isRegister ? 'Create Account' : 'Sign In'}
            </button>
            {error && (
              <div className="mt-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                {error}
              </div>
            )}
            <p className="mt-5 text-center text-sm text-gray-500">
              {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button
                onClick={toggleAuthView}
                className="text-indigo-600 hover:text-indigo-800 font-semibold transition"
              >
                {isRegister ? 'Sign in' : 'Register'}
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === 'new') {
    return (
      <PageShell maxWidth="max-w-2xl" token={token} logout={logout}>
        <div className="mb-4 text-xs text-gray-400 uppercase tracking-widest font-medium">
          FREE SSL CERTIFICATES
        </div>
        <div className="bg-white rounded-2xl shadow border border-gray-100">
          <div className="flex justify-between items-center px-6 py-5 border-b border-gray-100">
            <h1 className="text-lg font-bold text-gray-800">Order New SSL Certificate</h1>
            <button
              onClick={() => setCurrentView('list')}
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium transition"
            >
              ← Back
            </button>
          </div>
          <div className="px-6 py-6 space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Domain Name</label>
              <input
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition text-sm"
                placeholder="example.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1.5">Enter the root domain — www can be included automatically below.</p>
            </div>
            <label className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 cursor-pointer hover:border-indigo-300 transition bg-gray-50">
              <input
                type="checkbox"
                checked={includeWww}
                onChange={(e) => setIncludeWww(e.target.checked)}
                className="w-4 h-4 accent-indigo-600"
              />
              <span className="text-sm text-gray-700">Include www subdomain</span>
            </label>
            <div>
              <button
                onClick={() => setAdvancedOpen((value) => !value)}
                aria-expanded={advancedOpen}
                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium transition flex items-center gap-1"
              >
                <span>{advancedOpen ? '▾' : '▸'}</span> Advanced options
              </button>
              {advancedOpen && (
                <div className="mt-3 space-y-3">
                  <label className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 cursor-pointer hover:border-indigo-300 transition bg-gray-50">
                    <input
                      type="checkbox"
                      checked={wildcard}
                      onChange={(e) => setWildcard(e.target.checked)}
                      className="w-4 h-4 accent-indigo-600"
                    />
                    <span className="text-sm text-gray-700">Request wildcard certificate (*.example.com)</span>
                  </label>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Certificate Authority</label>
                    <select
                      value={ca}
                      onChange={(e) => handleCaChange(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition text-sm bg-white"
                    >
                      <option value="">Default (Let&apos;s Encrypt)</option>
                      <option value="google">Google Trust Services</option>
                    </select>
                  </div>
                  {ca === 'google' && (
                    <div className="space-y-3 px-4 py-4 rounded-xl border border-indigo-100 bg-indigo-50">
                      <p className="text-xs text-indigo-600 font-semibold uppercase tracking-wider">Google Trust Services — EAB Credentials</p>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">EAB Key ID</label>
                        <input
                          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition text-sm"
                          placeholder="eab-key-id"
                          value={eabKeyId}
                          onChange={(e) => setEabKeyId(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">EAB HMAC Key</label>
                        <input
                          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition text-sm"
                          placeholder="eab-hmac-key"
                          value={eabHmacKey}
                          onChange={(e) => setEabHmacKey(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={createOrder}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-xl transition shadow-md shadow-indigo-200 text-sm"
            >
              + Create Order
            </button>
            {error && (
              <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                {error}
              </div>
            )}
          </div>
        </div>
      </PageShell>
    );
  }

  if (currentView === 'validate' && validationData) {
    const cnameTarget = validationData.cname.split(' -> ')[1] || validationData.cname;
    const cnameMatches = dnsCheckResult?.cname && normalizeHostname(dnsCheckResult.cname) === normalizeHostname(cnameTarget);
    const isReady = cnameMatches;
    return (
      <PageShell token={token} logout={logout}>
        <div className="mb-4 text-xs text-gray-400 uppercase tracking-widest font-medium">
          FREE SSL CERTIFICATES
        </div>
        <h1 className="text-xl font-bold text-gray-800 mb-5">
          Validate your domain name <span className="text-indigo-600">{validationData.domain}</span>
        </h1>
        <div className="flex flex-col lg:flex-row gap-5 items-start">
          <div className="flex-1 min-w-0 space-y-4">
            <div className={`flex gap-3 px-4 py-4 rounded-xl text-sm text-gray-700 ${isReady ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <svg className={`w-5 h-5 shrink-0 mt-0.5 ${isReady ? 'text-green-500' : 'text-red-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {isReady
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008zm9-3.75a9 9 0 11-18 0 9 9 0 0118 0z" />
                }
              </svg>
              <div>
                {isReady
                  ? <p className="font-semibold text-gray-800">Your CNAME record is set up correctly. You can now request your certificate.</p>
                  : <><p className="font-semibold text-gray-800">Please set up the following CNAME record on your domain name.</p>
                    <p className="text-gray-500 mt-0.5">This record is necessary for the certificate provider to verify you own the domain name.</p></>
                }
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
              <button
                onClick={() => setDnsOpen((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-2.5">
                  {isReady
                    ? <span className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-xs leading-none">✓</span>
                    : <span className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center text-white font-bold text-xs leading-none">✕</span>
                  }
                  <span className="font-semibold text-gray-800 text-sm">Setup DNS Record for {validationData.domain}</span>
                </div>
                <svg className={`w-5 h-5 text-gray-400 transition-transform ${dnsOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {dnsOpen && (
                <div className="border-t border-gray-200">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-gray-100">
                      <tr>
                        <td className="px-4 py-3 font-semibold text-gray-700 w-48">Record Name</td>
                        <td className="px-4 py-3 text-gray-600">_acme-challenge</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-semibold text-gray-700">Domain</td>
                        <td className="px-4 py-3 text-gray-600">{validationData.domain}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-semibold text-gray-700">Destination</td>
                        <td className="px-4 py-3 text-gray-600 break-all">{cnameTarget}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-semibold text-gray-700">Current Destination</td>
                        <td className="px-4 py-3">
                          {isDnsChecking && !dnsCheckResult ? (
                            <span className="flex items-center gap-2 text-gray-400"><Spinner />Checking…</span>
                          ) : dnsCheckResult?.cname ? (
                            <span className="flex items-center gap-2 text-gray-600 break-all">
                              {dnsCheckResult.cname}
                              {cnameMatches
                                ? <span className="px-2 py-0.5 rounded bg-green-500 text-white text-xs font-semibold shrink-0">Ready</span>
                                : <span className="px-2 py-0.5 rounded bg-red-500 text-white text-xs font-semibold shrink-0">Not Ready</span>
                              }
                            </span>
                          ) : (
                            <span className="flex items-center gap-2 text-gray-500">
                              (no CNAME found)
                              <span className="px-2 py-0.5 rounded bg-red-500 text-white text-xs font-semibold">Not Ready</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  {dnsCheckResult && !dnsCheckResult.hasNameservers && (
                    <div className="mx-4 mb-4 mt-2 flex gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-gray-700">
                      <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                      </svg>
                      <div>
                        <p className="font-semibold text-gray-800">We did not detect any nameservers on your domain name.</p>
                        <p className="text-gray-500 mt-0.5">Please make sure that your domain name is active and set up correctly with the provider of the domain name.</p>
                      </div>
                    </div>
                  )}
                  {dnsCheckResult?.cname && !cnameMatches && (
                    <div className="mx-4 mb-4 mt-2 flex gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-gray-700">
                      <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                      </svg>
                      <div>
                        <p className="font-semibold text-gray-800">Your CNAME record is pointing to the wrong destination.</p>
                        <p className="text-gray-500 mt-0.5">Please update your <span className="font-mono">_acme-challenge</span> CNAME record to point to <span className="font-mono break-all">{cnameTarget}</span>.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                disabled={isDnsChecking}
                onClick={() => checkDns(validationData.domain)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {isDnsChecking && <Spinner />}
                {isDnsChecking ? 'Checking…' : 'Check Again'}
              </button>
            </div>
            <p className="text-sm text-gray-500">Please note that DNS changes can take a few hours to take effect.</p>
            {error && (
              <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                {error}
              </div>
            )}
            <div className="flex gap-3">
              <button
                disabled={isValidating || !isReady}
                onClick={() => generateCertificate(validationData)}
                className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold px-5 py-2.5 rounded-xl transition shadow-md shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
                {isValidating && <Spinner />}
                {isValidating ? 'Validating…' : 'Request Certificate'}
              </button>
              <button
                disabled={isValidating}
                onClick={() => setCurrentView('list')}
                className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Back
              </button>
            </div>
          </div>
          <aside className="w-full lg:w-64 lg:shrink-0 bg-white rounded-2xl border border-gray-100 shadow p-5 text-sm">
            <h2 className="font-bold text-gray-800 mb-4">Certificate Details</h2>
            <div className="space-y-4">
              {[
                { label: 'DOMAIN', value: validationData.domain },
                { label: 'CERTIFICATE PROVIDER', value: validationData.ca === 'google' ? 'Google Trust Services' : "Let's Encrypt" },
                { label: 'STATUS', value: 'Action Required' },
                { label: 'CREATED AT', value: formatDateTime(validationData.createdAt) }
              ].map(({ label, value }) => (
                <div key={label}>
                  <span className="block text-xs text-gray-400 mb-0.5 tracking-wider font-semibold">{label}</span>
                  <span className="text-gray-700">{value}</span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </PageShell>
    );
  }

  if (currentView === 'detail' && selectedCertificate) {
    return (
      <PageShell token={token} logout={logout}>
        <div className="mb-4 text-xs text-gray-400 uppercase tracking-widest font-medium">
          FREE SSL CERTIFICATES
        </div>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-800">SSL Certificate — {selectedCertificate.domain}</h1>
          </div>
          <button
            onClick={() => { setCertKeys(null); setCurrentView('list'); }}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium transition"
          >
            ← Back to Certificates
          </button>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          <div className="md:col-span-2 space-y-4">
            {selectedCertificate.status === 'ISSUED' && (
            <section className="bg-white rounded-2xl border border-gray-100 shadow">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-bold text-gray-800">Step 4: Install SSL Certificate</h2>
              </div>
              <div className="px-5 py-4 text-sm text-gray-600">
                Use the private key and certificate files to install SSL on your hosting account or server.
              </div>
              <div className="px-5 pb-5">
                <button
                  onClick={() => viewCertificateKeys(selectedCertificate.id)}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition shadow shadow-indigo-200"
                >
                  View Private Key and Certificate
                </button>
              </div>
            </section>
            )}
            {certKeys && (
              <section className="bg-white rounded-2xl border border-gray-100 shadow">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="font-bold text-gray-800">Private Key and Certificate</h2>
                </div>
                <div className="px-5 py-4 space-y-4">
                  {[
                    { label: 'PRIVATE KEY', value: certKeys.privateKey },
                    { label: 'CERTIFICATE', value: certKeys.certificate },
                    { label: 'CA BUNDLE', value: certKeys.caBundle }
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div className="text-xs font-bold text-gray-400 mb-2 tracking-wider">{label}</div>
                      <textarea
                        readOnly
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono text-gray-700 h-40 focus:outline-none resize-none bg-gray-50"
                        value={value || '(not available)'}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}
            <section className="bg-white rounded-2xl border border-gray-100 shadow">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-bold text-gray-800">Step 5: Verify Installation on {selectedCertificate.domain}</h2>
              </div>
              <div className="px-5 py-4 text-sm">
                <div className="grid grid-cols-3 gap-y-3 text-gray-700">
                  <div className="text-gray-400 font-medium">Status</div>
                  <div className="col-span-2">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${statusBadgeClass(selectedCertificate.status)}`}>
                      {statusLabel(selectedCertificate.status)}
                    </span>
                  </div>
                  <div className="text-gray-400 font-medium">Issuer</div>
                  <div className="col-span-2">Let&apos;s Encrypt</div>
                  <div className="text-gray-400 font-medium">Expires at</div>
                  <div className="col-span-2">{formatDate(selectedCertificate.expiresAt)}</div>
                </div>
              </div>
            </section>
            <section className="bg-white rounded-2xl border border-gray-100 shadow">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-bold text-gray-800">Step 6: Make Your Website Use HTTPS</h2>
              </div>
              <div className="px-5 py-4 text-sm text-gray-600">
                <ol className="list-decimal pl-5 space-y-1.5">
                  <li>Make sure all URLs use HTTPS and your address bar shows a secure lock.</li>
                  <li>Force all visitors to use HTTPS with your server or application settings.</li>
                </ol>
              </div>
            </section>
            <button
              onClick={() => deleteCertificate(selectedCertificate.id)}
              className="text-sm text-red-500 hover:text-red-700 transition font-medium"
            >
              Delete Certificate Order
            </button>
          </div>
          <aside className="bg-white rounded-2xl border border-gray-100 shadow p-5 text-sm h-fit">
            <h2 className="font-bold text-gray-800 mb-4">Certificate Details</h2>
            <div className="space-y-3">
              {[
                { label: 'DOMAIN', value: selectedCertificate.domain },
                { label: 'CERTIFICATE PROVIDER', value: "Let's Encrypt" },
                { label: 'STATUS', value: statusLabel(selectedCertificate.status) },
                { label: 'CREATED AT', value: formatDate(selectedCertificate.createdAt) },
                { label: 'ISSUE DATE', value: formatDate(selectedCertificate.issuedAt) },
                { label: 'EXPIRATION DATE', value: formatDate(selectedCertificate.expiresAt) }
              ].map(({ label, value }) => (
                <div key={label}>
                  <span className="block text-xs text-gray-400 mb-0.5 tracking-wider font-semibold">{label}</span>
                  <span className="text-gray-700">{value}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <label htmlFor="send-expiration-reminders" className="text-xs text-gray-400 tracking-wider font-semibold">
                  EXPIRATION REMINDERS
                </label>
                <input
                  id="send-expiration-reminders"
                  type="checkbox"
                  checked={selectedCertificate.remindersEnabled !== false}
                  onChange={(e) => toggleReminders(selectedCertificate.id, e.target.checked)}
                  className="w-4 h-4 accent-indigo-600"
                />
              </div>
            </div>
          </aside>
        </div>
      </PageShell>
    );
  }

  const FILTER_LABELS = {
    ALL: 'All',
    ACTION_REQUIRED: 'Action Required',
    ISSUED: 'Issued',
    EXPIRED: 'Expired',
    REVOKED: 'Revoked',
    FAILED: 'Failed'
  };

  return (
    <PageShell token={token} logout={logout}>
      <div className="mb-1 text-xs text-gray-400 uppercase tracking-widest font-medium">Free SSL Certificates</div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-gray-800">SSL Certificates</h1>
      </div>
      {success && (
        <div className="mb-4 px-4 py-2.5 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">
          {success}
        </div>
      )}
      {error && (
        <div className="mb-4 px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
          {error}
        </div>
      )}
      <div className="bg-white rounded-2xl shadow border border-gray-100 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between px-5 py-3 border-b border-gray-100 gap-2">
          <span className="text-sm font-bold text-gray-700">SSL Certificates</span>
          <div className="flex flex-wrap gap-1">
            {Object.entries(FILTER_LABELS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                aria-pressed={filter === key}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  filter === key
                    ? 'text-indigo-600 bg-indigo-50'
                    : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Domain</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Provider</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Expires At</th>
                <th className="px-5 py-3 text-right text-xs font-bold text-gray-400 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredCertificates().map((item) => (
                <tr key={item.id} className="hover:bg-indigo-50/40 transition">
                  <td className="px-5 py-3.5 text-indigo-600 font-semibold text-sm">{item.domain}</td>
                  <td className="px-5 py-3.5 text-gray-500 text-sm">Let&apos;s Encrypt</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${statusBadgeClass(item.status)}`}>
                      {statusLabel(item.status)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 text-sm">{formatDate(item.expiresAt)}</td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition shadow shadow-indigo-200"
                      onClick={() => {
                        if (item.status === 'ACTION_REQUIRED') {
                          setValidationData({
                            domain: item.domain,
                            cname: `_acme-challenge.${item.domain} -> ${item.cnameTarget}`,
                            includeWww: true,
                            wildcard: false,
                            createdAt: item.createdAt
                          });
                          setCurrentView('validate');
                          return;
                        }
                        setSelectedCertificate(item);
                        setCertKeys(null);
                        setCurrentView('detail');
                      }}
                    >
                      <GearIcon /> Manage
                    </button>
                  </td>
                </tr>
              ))}
              {!filteredCertificates().length && (
                <tr>
                  <td colSpan="5" className="px-5 py-12 text-center text-gray-400 text-sm">
                    <div className="inline-flex flex-col items-center gap-2">
                      <svg className="w-10 h-10 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
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
        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between">
          <button
            onClick={() => setCurrentView('new')}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-xl transition shadow shadow-indigo-200 text-sm"
          >
            <span className="text-base leading-none">+</span> New SSL Certificate
          </button>
          <span className="text-xs text-gray-400">
            {filteredCertificates().length} certificate{filteredCertificates().length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </PageShell>
  );
}

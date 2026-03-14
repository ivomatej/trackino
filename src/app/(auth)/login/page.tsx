'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();

  // MFA stav
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  const [accessToken, setAccessToken] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      setError(error === 'Invalid login credentials'
        ? 'Nesprávný e-mail nebo heslo'
        : error
      );
      setLoading(false);
      return;
    }

    // Zkontroluj AAL úroveň
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalData?.nextLevel === 'aal2' && aalData.nextLevel !== aalData.currentLevel) {
      // Načti TOTP faktory
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = factors?.totp?.[0];
      if (totp) {
        setMfaFactorId(totp.id);
        // Ulož access token pro recovery API call
        const { data: sessionData } = await supabase.auth.getSession();
        setAccessToken(sessionData?.session?.access_token ?? '');
        setMfaRequired(true);
        setLoading(false);
        return;
      }
    }

    router.push('/');
  };

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMfaLoading(true);

    try {
      const { error: challengeErr } = await supabase.auth.mfa.challengeAndVerify({
        factorId: mfaFactorId,
        code: totpCode.replace(/\s/g, ''),
      });

      if (challengeErr) {
        setError('Neplatný ověřovací kód. Zkuste znovu.');
        setMfaLoading(false);
        return;
      }

      router.push('/');
    } catch {
      setError('Chyba při ověřování. Zkuste znovu.');
      setMfaLoading(false);
    }
  };

  const handleRecoveryUse = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMfaLoading(true);

    try {
      const res = await fetch('/api/mfa/recovery-codes/use', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ code: recoveryCode.trim().toUpperCase() }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Neplatný záchranný kód');
        setMfaLoading(false);
        return;
      }

      // Recovery kód byl úspěšný – přejdi dál (session je platná na aal1)
      router.push('/');
    } catch {
      setError('Chyba při ověřování záchranného kódu.');
      setMfaLoading(false);
    }
  };

  // ─── MFA Verify UI ────────────────────────────────────────────
  if (mfaRequired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-4">
        <div className="w-full max-w-[400px]">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#2563eb] mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-[#0f172a]">Trackino</h1>
            <p className="text-[#475569] mt-1">Dvoufaktorové ověření</p>
          </div>

          <div className="bg-white rounded-xl shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)] border border-[#e2e8f0] p-6">
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-[#fee2e2] text-[#dc2626] text-sm">
                {error}
              </div>
            )}

            {!recoveryMode ? (
              <form onSubmit={handleMfaVerify}>
                <div className="flex items-center gap-3 mb-5 p-3 rounded-lg bg-[#eff6ff] border border-[#bfdbfe]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="11" width="14" height="10" rx="2" ry="2" />
                    <path d="M12 15v2" />
                    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                  </svg>
                  <p className="text-sm text-[#1e40af]">
                    Zadejte 6místný kód z vaší autentizační aplikace.
                  </p>
                </div>

                <div className="mb-5">
                  <label className="block text-sm font-medium text-[#0f172a] mb-1.5">
                    Ověřovací kód
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9 ]*"
                    maxLength={7}
                    value={totpCode}
                    onChange={e => setTotpCode(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="123456"
                    autoFocus
                    className="w-full px-3 py-2.5 rounded-lg border border-[#e2e8f0] bg-white text-[#0f172a] text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] text-center text-2xl font-mono tracking-widest"
                  />
                </div>

                <button
                  type="submit"
                  disabled={mfaLoading || totpCode.length < 6}
                  className="w-full py-2.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-medium rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-3"
                >
                  {mfaLoading ? 'Ověřuji...' : 'Ověřit'}
                </button>

                <button
                  type="button"
                  onClick={() => setRecoveryMode(true)}
                  className="w-full text-center text-sm text-[#475569] hover:text-[#2563eb] transition-colors"
                >
                  Použít záchranný kód
                </button>
              </form>
            ) : (
              <form onSubmit={handleRecoveryUse}>
                <div className="flex items-center gap-3 mb-5 p-3 rounded-lg bg-[#fffbeb] border border-[#fde68a]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <p className="text-sm text-[#92400e]">
                    Záchranný kód lze použít jen jednou.
                  </p>
                </div>

                <div className="mb-5">
                  <label className="block text-sm font-medium text-[#0f172a] mb-1.5">
                    Záchranný kód
                  </label>
                  <input
                    type="text"
                    value={recoveryCode}
                    onChange={e => setRecoveryCode(e.target.value.toUpperCase())}
                    placeholder="XXXX-XXXX-XXXX"
                    autoFocus
                    className="w-full px-3 py-2.5 rounded-lg border border-[#e2e8f0] bg-white text-[#0f172a] text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] font-mono tracking-widest"
                  />
                </div>

                <button
                  type="submit"
                  disabled={mfaLoading || recoveryCode.replace(/-/g, '').length < 12}
                  className="w-full py-2.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-medium rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-3"
                >
                  {mfaLoading ? 'Ověřuji...' : 'Použít záchranný kód'}
                </button>

                <button
                  type="button"
                  onClick={() => { setRecoveryMode(false); setError(''); }}
                  className="w-full text-center text-sm text-[#475569] hover:text-[#2563eb] transition-colors"
                >
                  ← Zpět na ověřovací kód
                </button>
              </form>
            )}
          </div>

          <button
            onClick={() => { setMfaRequired(false); setError(''); setTotpCode(''); setRecoveryCode(''); setRecoveryMode(false); }}
            className="w-full text-center text-sm text-[#475569] hover:text-[#0f172a] transition-colors mt-4"
          >
            ← Zpět na přihlášení
          </button>
        </div>
      </div>
    );
  }

  // ─── Přihlašovací formulář ─────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-4">
      <div className="w-full max-w-[400px]">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#2563eb] mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#0f172a]">Trackino</h1>
          <p className="text-[#475569] mt-1">Přihlaste se do svého účtu</p>
        </div>

        {/* Formulář */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)] border border-[#e2e8f0] p-6">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-[#fee2e2] text-[#dc2626] text-sm">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium text-[#0f172a] mb-1.5">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-lg border border-[#e2e8f0] bg-white text-[#0f172a] text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent placeholder:text-[#94a3b8] transition-shadow"
              placeholder="vas@email.cz"
            />
          </div>

          <div className="mb-6">
            <label htmlFor="password" className="block text-sm font-medium text-[#0f172a] mb-1.5">
              Heslo
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-lg border border-[#e2e8f0] bg-white text-[#0f172a] text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent placeholder:text-[#94a3b8] transition-shadow"
              placeholder="Zadejte heslo"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-medium rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Přihlašování...' : 'Přihlásit se'}
          </button>
        </form>

        <p className="text-center text-sm text-[#475569] mt-6">
          Nemáte účet?{' '}
          <Link href="/register" className="text-[#2563eb] hover:underline font-medium">
            Zaregistrovat se
          </Link>
        </p>
      </div>
    </div>
  );
}

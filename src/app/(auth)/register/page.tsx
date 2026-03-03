'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [workspaceCode, setWorkspaceCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { signUp } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Heslo musí mít alespoň 6 znaků');
      return;
    }

    const code = workspaceCode.trim().toUpperCase();

    setLoading(true);

    // Uložit kód před registrací, aby byl dostupný při SIGNED_IN eventu
    if (code) {
      localStorage.setItem('trackino_pending_join_code', code);
    }

    const { error: signUpError } = await signUp(email, password, displayName);

    if (signUpError) {
      // Při chybě odstranit uložený kód
      localStorage.removeItem('trackino_pending_join_code');
      setError(signUpError);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
    }
  };

  if (success) {
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
          </div>

          <div className="bg-white rounded-xl shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)] border border-[#e2e8f0] p-6 text-center">
            {/* Zelená fajfka */}
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#dcfce7] mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-[#0f172a] mb-2">Registrace úspěšná!</h2>
            <p className="text-sm text-[#475569] mb-4">
              Účet byl vytvořen pro <strong>{email}</strong>.
            </p>
            {workspaceCode.trim() && (
              <div className="mb-4 p-3 rounded-lg bg-[#fffbeb] border border-[#fde68a]">
                <p className="text-xs text-[#92400e]">
                  <strong>Čeká na schválení:</strong> Správce workspace musí váš přístup schválit, než budete moci pracovat.
                </p>
              </div>
            )}
            <Link
              href="/login"
              className="inline-block w-full py-2.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-medium rounded-lg text-sm transition-colors text-center"
            >
              Přihlásit se
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
          <p className="text-[#475569] mt-1">Vytvořte si nový účet</p>
        </div>

        {/* Formulář */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)] border border-[#e2e8f0] p-6">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-[#fee2e2] text-[#dc2626] text-sm">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="displayName" className="block text-sm font-medium text-[#0f172a] mb-1.5">
              Zobrazované jméno
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-lg border border-[#e2e8f0] bg-white text-[#0f172a] text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent placeholder:text-[#94a3b8] transition-shadow"
              placeholder="Jan Novák"
            />
          </div>

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
              className="w-full px-3 py-2.5 rounded-lg border border-[#e2e8f0] bg-white text-[#0f172a] text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent placeholder:text-[#94a3b8] transition-shadow"
              placeholder="vas@email.cz"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="password" className="block text-sm font-medium text-[#0f172a] mb-1.5">
              Heslo
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2.5 rounded-lg border border-[#e2e8f0] bg-white text-[#0f172a] text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent placeholder:text-[#94a3b8] transition-shadow"
              placeholder="Minimálně 6 znaků"
            />
          </div>

          <div className="mb-6">
            <label htmlFor="workspaceCode" className="block text-sm font-medium text-[#0f172a] mb-1.5">
              Kód workspace
              <span className="text-[#94a3b8] font-normal ml-1">(volitelné)</span>
            </label>
            <input
              id="workspaceCode"
              type="text"
              value={workspaceCode}
              onChange={(e) => setWorkspaceCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              className="w-full px-3 py-2.5 rounded-lg border border-[#e2e8f0] bg-white text-[#0f172a] text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent placeholder:text-[#94a3b8] transition-shadow font-mono tracking-widest"
              placeholder="ABC123"
              maxLength={6}
            />
            <p className="mt-1 text-xs text-[#94a3b8]">
              Zadejte kód, který vám poskytl správce workspace.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-medium rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Registrace...' : 'Zaregistrovat se'}
          </button>
        </form>

        <p className="text-center text-sm text-[#475569] mt-6">
          Máte účet?{' '}
          <Link href="/login" className="text-[#2563eb] hover:underline font-medium">
            Přihlásit se
          </Link>
        </p>
      </div>
    </div>
  );
}

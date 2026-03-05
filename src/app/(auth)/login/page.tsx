'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();

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
    } else {
      router.push('/');
    }
  };

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

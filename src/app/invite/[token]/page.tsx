'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Invitation, UserRole } from '@/types/database';

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [invitation, setInvitation] = useState<(Invitation & { workspace_name?: string }) | null>(null);
  const [status, setStatus] = useState<'loading' | 'found' | 'accepted' | 'error' | 'expired'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  // Načtení pozvánky
  useEffect(() => {
    async function fetchInvitation() {
      const { data, error } = await supabase
        .from('trackino_invitations')
        .select('*')
        .eq('token', token)
        .single();

      if (error || !data) {
        setStatus('expired');
        return;
      }

      const inv = data as Invitation;
      if (inv.accepted) {
        setStatus('expired');
        setErrorMsg('Tato pozvánka byla již použita.');
        return;
      }

      // Načíst název workspace
      const { data: ws } = await supabase
        .from('trackino_workspaces')
        .select('name')
        .eq('id', inv.workspace_id)
        .single();

      setInvitation({ ...inv, workspace_name: ws?.name ?? '' });
      setStatus('found');
    }

    if (token) fetchInvitation();
  }, [token]);

  // Přijmout pozvánku (po přihlášení)
  const acceptInvitation = async () => {
    if (!user || !invitation) return;
    setStatus('loading');

    // Zkontrolovat zda už není členem
    const { data: existing } = await supabase
      .from('trackino_workspace_members')
      .select('id')
      .eq('workspace_id', invitation.workspace_id)
      .eq('user_id', user.id)
      .single();

    if (existing) {
      // Už je členem, jen označit pozvánku jako přijatou
      await supabase.from('trackino_invitations').update({ accepted: true }).eq('id', invitation.id);
      setStatus('accepted');
      setTimeout(() => router.push('/'), 2000);
      return;
    }

    // Přidat jako člena
    const { error: memberError } = await supabase
      .from('trackino_workspace_members')
      .insert({
        workspace_id: invitation.workspace_id,
        user_id: user.id,
        role: invitation.role as UserRole,
      });

    if (memberError) {
      setStatus('error');
      setErrorMsg(memberError.message);
      return;
    }

    // Označit pozvánku jako přijatou
    await supabase.from('trackino_invitations').update({ accepted: true }).eq('id', invitation.id);

    setStatus('accepted');
    setTimeout(() => router.push('/'), 2000);
  };

  // Pokud není přihlášený, přesměrovat na login s redirect zpět
  useEffect(() => {
    if (!authLoading && !user && status === 'found') {
      router.push(`/login?redirect=/invite/${token}`);
    }
  }, [authLoading, user, status, token, router]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg-main)' }}>
      <div className="w-full max-w-md text-center">
        {/* Logo */}
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--primary)] mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Trackino</h1>

        {status === 'loading' && (
          <div className="mt-6">
            <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>Načítání pozvánky...</p>
          </div>
        )}

        {status === 'found' && invitation && (
          <div className="mt-6 p-6 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              Pozvánka do workspace
            </h2>
            <p className="text-2xl font-bold mb-1" style={{ color: 'var(--primary)' }}>
              {invitation.workspace_name}
            </p>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
              Role: {invitation.role === 'admin' ? 'Administrátor' : invitation.role === 'manager' ? 'Team Manager' : 'Člen'}
            </p>

            {user ? (
              <button
                onClick={acceptInvitation}
                className="w-full py-3 rounded-lg text-white font-semibold text-sm transition-colors"
                style={{ background: 'var(--primary)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--primary-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--primary)'}
              >
                Přijmout pozvánku
              </button>
            ) : (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Pro přijetí pozvánky se přihlaste nebo zaregistrujte...
              </p>
            )}
          </div>
        )}

        {status === 'accepted' && (
          <div className="mt-6 p-6 rounded-xl border" style={{ background: 'var(--success-light)', borderColor: 'var(--success)' }}>
            <p className="text-sm font-medium" style={{ color: 'var(--success)' }}>
              Pozvánka přijata! Přesměrovávám...
            </p>
          </div>
        )}

        {(status === 'expired' || status === 'error') && (
          <div className="mt-6 p-6 rounded-xl border" style={{ background: 'var(--danger-light)', borderColor: 'var(--danger)' }}>
            <p className="text-sm font-medium" style={{ color: 'var(--danger)' }}>
              {errorMsg || 'Tato pozvánka je neplatná nebo expirovala.'}
            </p>
            <button
              onClick={() => router.push('/login')}
              className="mt-4 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
            >
              Přejít na přihlášení
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

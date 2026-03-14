'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { Workspace } from '@/types/database';

interface Props {
  currentWorkspace: Workspace;
  onMessage: (msg: string) => void;
  refreshWorkspace: () => Promise<void>;
}

export default function TabSecurity({ currentWorkspace, onMessage, refreshWorkspace }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  async function toggleMfaRequired(value: boolean) {
    setSaving(true);
    try {
      const { data: { session } } = await import('@/lib/supabase').then(m => m.supabase.auth.getSession());
      const token = session?.access_token ?? '';

      const res = await fetch(`/api/workspaces/${currentWorkspace.id}/mfa`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ mfa_required: value }),
      });

      if (!res.ok) {
        const data = await res.json();
        onMessage(`Chyba: ${data.error ?? 'Nepodařilo se uložit nastavení'}`);
        return;
      }

      await refreshWorkspace();
      onMessage(value ? 'MFA bylo aktivováno pro celý workspace.' : 'MFA bylo deaktivováno.');
    } catch {
      onMessage('Chyba: Nepodařilo se uložit nastavení');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
        Bezpečnost
      </h2>

      {/* MFA sekce */}
      <div
        className="rounded-xl p-4 mb-4"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div
              className="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center mt-0.5"
              style={{ background: 'var(--primary-light, #eff6ff)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Vyžadovat MFA pro všechny členy
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Všichni členové workspace budou muset mít aktivní dvoufaktorové ověření (TOTP). Dokud MFA nenastaví, nebudou moci plně přistupovat k aplikaci.
              </p>
            </div>
          </div>

          {/* Toggle */}
          <button
            role="switch"
            aria-checked={currentWorkspace.mfa_required}
            disabled={saving}
            onClick={() => toggleMfaRequired(!currentWorkspace.mfa_required)}
            className="flex-shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: currentWorkspace.mfa_required ? 'var(--primary)' : 'var(--border)',
            }}
          >
            <span
              className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
              style={{
                transform: currentWorkspace.mfa_required ? 'translateX(1.375rem)' : 'translateX(0.25rem)',
              }}
            />
          </button>
        </div>

        {currentWorkspace.mfa_required && (
          <div
            className="mt-3 p-3 rounded-lg flex items-start gap-2"
            style={{ background: 'var(--warning-light, #fffbeb)', border: '1px solid var(--warning-border, #fde68a)' }}
          >
            <svg className="flex-shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p className="text-xs" style={{ color: '#92400e' }}>
              MFA je aktivní. Členové bez nastaveného MFA budou přesměrováni na stránku profilu k jeho nastavení.
            </p>
          </div>
        )}
      </div>

      {/* Informace o MFA */}
      <div
        className="rounded-xl p-4"
        style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)' }}
      >
        <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
          Co je dvoufaktorové ověření (MFA)?
        </p>
        <ul className="space-y-1.5">
          {[
            'MFA přidává druhý stupeň ověření po zadání hesla.',
            'Členové použijí autentizační aplikaci (Google Authenticator, Authy apod.).',
            'Každý člen si nastaví MFA individuálně ve svém profilu.',
            'V případě ztráty přístupu lze použít záchranné kódy nebo kontaktovat správce.',
          ].map((text, i) => (
            <li key={i} className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              <svg className="flex-shrink-0 mt-0.5" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

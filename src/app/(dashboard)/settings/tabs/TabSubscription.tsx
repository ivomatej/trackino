'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Workspace, WorkspaceSubscription, WorkspaceMember, Tariff } from '@/types/database';

interface Props {
  currentWorkspace: Workspace;
  isMasterAdmin: boolean;
  currentMembership: WorkspaceMember | null;
  onMessage: (msg: string) => void;
  refreshWorkspace: () => Promise<void>;
}

export default function TabSubscription({ currentWorkspace, isMasterAdmin, currentMembership, onMessage, refreshWorkspace }: Props) {
  const [subscriptions, setSubscriptions] = useState<WorkspaceSubscription[]>([]);
  const [subLoading, setSubLoading] = useState(false);
  const [changingTariff, setChangingTariff] = useState(false);

  useEffect(() => {
    fetchSubscriptions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWorkspace.id]);

  async function fetchSubscriptions() {
    setSubLoading(true);
    try {
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth() + 1;

      const { data: existing } = await supabase
        .from('trackino_workspace_subscriptions')
        .select('id')
        .eq('workspace_id', currentWorkspace.id)
        .eq('year', y)
        .eq('month', m)
        .single();

      if (!existing) {
        const { count } = await supabase
          .from('trackino_workspace_members')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', currentWorkspace.id)
          .eq('approved', true);

        await supabase.from('trackino_workspace_subscriptions').insert({
          workspace_id: currentWorkspace.id,
          year: y,
          month: m,
          tariff: currentWorkspace.tariff,
          active_members: count ?? 0,
        });
      }

      const { data } = await supabase
        .from('trackino_workspace_subscriptions')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      setSubscriptions((data ?? []) as WorkspaceSubscription[]);
    } catch {
      setSubscriptions([]);
    }
    setSubLoading(false);
  }

  async function changeTariff(newTariff: Tariff) {
    if (!confirm(`Přejít na tarif ${newTariff.toUpperCase()}? Tato akce změní dostupné funkce workspace.`)) return;
    setChangingTariff(true);
    await supabase.from('trackino_workspaces').update({ tariff: newTariff }).eq('id', currentWorkspace.id);
    await refreshWorkspace();
    setChangingTariff(false);
    onMessage(`Tarif změněn na ${newTariff.toUpperCase()}.`);
    setTimeout(() => onMessage(''), 3000);
  }

  return (
    <div className="space-y-5">
      {/* Aktuální plán */}
      <div className="rounded-xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: currentWorkspace.tariff === 'max' ? '#7c3aed22' : currentWorkspace.tariff === 'pro' ? '#2563eb22' : '#6b728022' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ color: currentWorkspace.tariff === 'max' ? '#7c3aed' : currentWorkspace.tariff === 'pro' ? '#2563eb' : '#6b7280' }}>
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                {currentWorkspace.tariff === 'max' ? 'Max plan' : currentWorkspace.tariff === 'pro' ? 'Pro plan' : 'Free plan'}
              </h3>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {currentWorkspace.tariff === 'max' ? 'Plná sada funkcí + audit log'
                  : currentWorkspace.tariff === 'pro' ? 'Rozšířené funkce pro týmy'
                  : 'Základní funkce zdarma'}
              </p>
            </div>
          </div>
          {(isMasterAdmin || currentWorkspace.tariff !== 'max') && (
            <div className="flex gap-2 flex-wrap">
              {(['free', 'pro', 'max'] as Tariff[]).filter(t => t !== currentWorkspace.tariff).map(t => (
                <button
                  key={t}
                  onClick={() => changeTariff(t)}
                  disabled={changingTariff}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  Přejít na {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Platební údaje – placeholder */}
      <div className="rounded-xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Platební metoda</h3>
        <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--bg-hover)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text-muted)' }}>
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
          </svg>
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Správa platebních metod – připravujeme</span>
        </div>
      </div>

      {/* Historie */}
      <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Historie faktur</h3>
        </div>
        {subLoading ? (
          <div className="py-8 text-center">
            <div className="w-5 h-5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : subscriptions.length === 0 ? (
          <p className="px-5 py-6 text-sm text-center" style={{ color: 'var(--text-muted)' }}>Zatím žádná historie.</p>
        ) : (
          <div>
            <div className="grid px-5 py-2 text-xs font-semibold uppercase tracking-wider border-b"
              style={{ gridTemplateColumns: '1fr 120px 140px', color: 'var(--text-muted)', borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
              <span>Období</span><span>Tarif</span><span>Aktivní uživatelé</span>
            </div>
            {subscriptions.map(sub => (
              <div key={sub.id} className="grid px-5 py-3 border-b last:border-b-0 text-sm"
                style={{ gridTemplateColumns: '1fr 120px 140px', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {new Date(sub.year, sub.month - 1).toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' })}
                </span>
                <span className="font-medium capitalize">{sub.tariff}</span>
                <span>{sub.active_members} uživatelů</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Zrušení */}
      {currentWorkspace.tariff !== 'free' && (isMasterAdmin || currentMembership?.role === 'owner') && (
        <div className="rounded-xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Zrušení tarifu</h3>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            Přechod na Free plán omezí dostupné funkce workspace. Záznamy a data zůstanou zachovány.
          </p>
          <button
            onClick={() => changeTariff('free')}
            disabled={changingTariff}
            className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50"
            style={{ borderColor: '#ef4444', color: '#ef4444' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            Přejít na Free plán
          </button>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace, WorkspaceProvider } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import DashboardLayout from '@/components/DashboardLayout';
import { useRouter } from 'next/navigation';
import type { FeedbackEntry } from '@/types/database';

// ─── Interní komponenta ───────────────────────────────────────────────────────

function FeedbackContent() {
  const { user } = useAuth();
  const { currentWorkspace, currentMembership, hasModule, loading: wsLoading } = useWorkspace();
  const { isWorkspaceAdmin, isMasterAdmin } = usePermissions();
  const router = useRouter();

  const [feedbackList, setFeedbackList] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Může zobrazit seznam připomínek?
  const canViewFeedback = useMemo(
    () => isMasterAdmin || isWorkspaceAdmin || (currentMembership?.can_receive_feedback ?? false),
    [isMasterAdmin, isWorkspaceAdmin, currentMembership]
  );

  // Redirect pokud modul není dostupný (čekáme na načtení workspace)
  useEffect(() => {
    if (!wsLoading && !hasModule('feedback')) router.replace('/');
  }, [wsLoading, hasModule, router]);

  // ── Fetch dat ──────────────────────────────────────────────────────────────

  const fetchFeedback = useCallback(async () => {
    if (!currentWorkspace || !canViewFeedback) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('trackino_feedback')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .order('created_at', { ascending: false });
    setFeedbackList((data ?? []) as FeedbackEntry[]);
    setLoading(false);
  }, [currentWorkspace, canViewFeedback]);

  useEffect(() => { fetchFeedback(); }, [fetchFeedback]);

  // ── Odeslání připomínky ────────────────────────────────────────────────────

  const sendFeedback = async () => {
    if (!currentWorkspace || !message.trim()) return;
    setSending(true);
    await supabase.from('trackino_feedback').insert({
      workspace_id: currentWorkspace.id,
      // Záměrně bez user_id – plná anonymita
      message: message.trim(),
      is_resolved: false,
    });
    setSending(false);
    setSent(true);
    setMessage('');
    setShowForm(false);
    // Skrýt potvrzení po 4 sekundách
    setTimeout(() => setSent(false), 4000);
  };

  // ── Označení jako vyřízeno ─────────────────────────────────────────────────

  const toggleResolved = async (fb: FeedbackEntry) => {
    setResolving(fb.id);
    await supabase.from('trackino_feedback')
      .update({ is_resolved: !fb.is_resolved })
      .eq('id', fb.id);
    setFeedbackList(prev => prev.map(f => f.id === fb.id ? { ...f, is_resolved: !f.is_resolved } : f));
    setResolving(null);
  };

  // ── Smazání ───────────────────────────────────────────────────────────────

  const deleteFeedback = async (id: string) => {
    if (!confirm('Trvale smazat tuto připomínku?')) return;
    setDeleting(id);
    await supabase.from('trackino_feedback').delete().eq('id', id);
    setFeedbackList(prev => prev.filter(f => f.id !== id));
    setDeleting(null);
  };

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  const unresolved = feedbackList.filter(f => !f.is_resolved);
  const resolved = feedbackList.filter(f => f.is_resolved);

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto overflow-x-hidden">
        {/* Záhlaví */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="min-w-0">
            <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Připomínky</h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Sdílejte anonymně svůj podnět nebo návrh se svým týmem
            </p>
          </div>
          <button
            onClick={() => { setShowForm(true); setSent(false); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white flex-shrink-0"
            style={{ background: 'var(--primary)' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nová připomínka
          </button>
        </div>

        {/* Potvrzení odeslání */}
        {sent && (
          <div className="mb-5 p-4 rounded-xl flex items-center gap-3" style={{ background: 'var(--success-light)', borderLeft: '4px solid var(--success)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--success)', flexShrink: 0 }}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span className="text-sm font-medium" style={{ color: 'var(--success)' }}>
              Vaše připomínka byla odeslána anonymně. Děkujeme za zpětnou vazbu!
            </span>
          </div>
        )}

        {/* ── Formulář pro odeslání připomínky ── */}
        {showForm && (
          <div className="mb-6 rounded-xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            {/* Upozornění na anonymitu */}
            <div className="mb-4 p-3 rounded-lg flex items-start gap-2" style={{ background: 'var(--bg-hover)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                <strong>Plně anonymní.</strong> Vaše jméno ani žádné osobní údaje nejsou odesílány. Nikdo nemůže zjistit, kdo zprávu napsal.
              </p>
            </div>

            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={4}
              placeholder="Napište svou připomínku, návrh nebo podnět..."
              className="w-full px-3 py-2.5 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] mb-4"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)', resize: 'none' }}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowForm(false); setMessage(''); }}
                className="px-4 py-2 rounded-lg text-sm border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              >
                Zrušit
              </button>
              <button
                onClick={sendFeedback}
                disabled={sending || !message.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ background: 'var(--primary)' }}
              >
                {sending ? 'Odesílám...' : 'Odeslat anonymně'}
              </button>
            </div>
          </div>
        )}

        {/* ── Seznam připomínek (jen pro oprávněné) ── */}
        {canViewFeedback ? (
          <div>
            {feedbackList.length === 0 ? (
              <div className="rounded-xl border p-10 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Zatím žádné připomínky.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Nevyřízené */}
                {unresolved.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>
                      Nevyřízené
                      <span
                        className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold text-white normal-case"
                        style={{ background: 'var(--danger)' }}
                      >
                        {unresolved.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {unresolved.map(fb => (
                        <FeedbackCard
                          key={fb.id}
                          fb={fb}
                          onToggle={toggleResolved}
                          onDelete={deleteFeedback}
                          resolving={resolving}
                          deleting={deleting}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Vyřízené */}
                {resolved.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide mb-2 mt-4" style={{ color: 'var(--text-muted)' }}>
                      Vyřízené
                      <span
                        className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold text-white normal-case"
                        style={{ background: 'var(--success)' }}
                      >
                        {resolved.length}
                      </span>
                    </div>
                    <div className="space-y-2 opacity-60">
                      {resolved.map(fb => (
                        <FeedbackCard
                          key={fb.id}
                          fb={fb}
                          onToggle={toggleResolved}
                          onDelete={deleteFeedback}
                          resolving={resolving}
                          deleting={deleting}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Uživatel nemá přístup k přehledu – informační panel */
          !showForm && (
            <div className="rounded-xl border p-8 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Sdílejte svůj podnět</p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Klikněte na <strong>Nová připomínka</strong> a odešlete svůj anonymní podnět nebo návrh.
                Vaše zpráva bude doručena odpovědné osobě v rámci vašeho týmu.
              </p>
            </div>
          )
        )}
      </div>
    </DashboardLayout>
  );
}

// ─── Karta připomínky ─────────────────────────────────────────────────────────

function FeedbackCard({
  fb,
  onToggle,
  onDelete,
  resolving,
  deleting,
}: {
  fb: FeedbackEntry;
  onToggle: (fb: FeedbackEntry) => void;
  onDelete: (id: string) => void;
  resolving: string | null;
  deleting: string | null;
}) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{
        background: 'var(--bg-card)',
        borderColor: fb.is_resolved ? 'var(--border)' : 'var(--border)',
      }}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox vyřízení */}
        <button
          onClick={() => onToggle(fb)}
          disabled={resolving === fb.id}
          className="mt-0.5 flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors disabled:opacity-50"
          style={{
            borderColor: fb.is_resolved ? 'var(--success)' : 'var(--border)',
            background: fb.is_resolved ? 'var(--success)' : 'transparent',
          }}
          title={fb.is_resolved ? 'Označit jako nevyřízené' : 'Označit jako vyřízené'}
        >
          {fb.is_resolved && (
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </button>

        {/* Obsah */}
        <div className="flex-1 min-w-0">
          <p className="text-sm whitespace-pre-wrap" style={{ color: fb.is_resolved ? 'var(--text-muted)' : 'var(--text-primary)' }}>
            {fb.message}
          </p>
          <span className="text-xs mt-1 block" style={{ color: 'var(--text-muted)' }}>
            {new Date(fb.created_at).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>

        {/* Smazat */}
        <button
          onClick={() => onDelete(fb.id)}
          disabled={deleting === fb.id}
          className="flex-shrink-0 p-1 rounded transition-colors disabled:opacity-50"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          title="Smazat"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Outer page component ────────────────────────────────────────────────────

export default function FeedbackPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, user, router]);

  if (authLoading || !user) return null;

  return (
    <WorkspaceProvider>
      <FeedbackContent />
    </WorkspaceProvider>
  );
}

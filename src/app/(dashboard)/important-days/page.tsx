'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace, WorkspaceProvider } from '@/contexts/WorkspaceContext';
import DashboardLayout from '@/components/DashboardLayout';
import { useRouter } from 'next/navigation';
import type { ImportantDay, ImportantDayRecurring } from '@/types/database';

// ─── Barvy ────────────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b',
  '#10b981', '#14b8a6', '#3b82f6', '#0ea5e9', '#84cc16',
  '#f97316', '#64748b',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string): string {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}.${m}.${y}`;
}

function recurringLabel(r: ImportantDayRecurring): string {
  switch (r) {
    case 'weekly':  return 'Každý týden';
    case 'monthly': return 'Každý měsíc';
    case 'yearly':  return 'Každý rok';
    default:        return '';
  }
}

// ─── Hlavní komponenta ────────────────────────────────────────────────────────

function ImportantDaysContent() {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();

  const [entries, setEntries] = useState<ImportantDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState<ImportantDay | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // SQL banner dismiss (localStorage)
  const [sqlBannerDismissed, setSqlBannerDismissed] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSqlBannerDismissed(localStorage.getItem('trackino_important_days_sql_done') === '1');
    }
  }, []);
  const dismissSqlBanner = () => {
    localStorage.setItem('trackino_important_days_sql_done', '1');
    setSqlBannerDismissed(true);
  };

  // Formulář
  const [fTitle, setFTitle] = useState('');
  const [fStartDate, setFStartDate] = useState('');
  const [fEndDate, setFEndDate] = useState('');
  const [fColor, setFColor] = useState('#6366f1');
  const [fRecurring, setFRecurring] = useState<ImportantDayRecurring>('none');
  const [fNote, setFNote] = useState('');

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchEntries = useCallback(async () => {
    if (!user || !currentWorkspace) return;
    setLoading(true);
    const { data } = await supabase
      .from('trackino_important_days')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .eq('user_id', user.id)
      .order('start_date', { ascending: true });
    setEntries((data ?? []) as ImportantDay[]);
    setLoading(false);
  }, [user, currentWorkspace]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // ── Formulář ───────────────────────────────────────────────────────────────

  const openNew = () => {
    setEditEntry(null);
    setFTitle('');
    const today = new Date().toISOString().slice(0, 10);
    setFStartDate(today);
    setFEndDate(today);
    setFColor('#6366f1');
    setFRecurring('none');
    setFNote('');
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (entry: ImportantDay) => {
    setEditEntry(entry);
    setFTitle(entry.title);
    setFStartDate(entry.start_date);
    setFEndDate(entry.end_date);
    setFColor(entry.color);
    setFRecurring(entry.recurring_type);
    setFNote(entry.note ?? '');
    setFormError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!user || !currentWorkspace) return;
    if (!fTitle.trim()) { setFormError('Zadej název.'); return; }
    if (!fStartDate) { setFormError('Zadej datum od.'); return; }
    if (fRecurring === 'none' && fEndDate && fEndDate < fStartDate) {
      setFormError('Datum do nesmí být před datem od.'); return;
    }
    setSaving(true);
    setFormError('');

    const endDate = fRecurring !== 'none' ? fStartDate : (fEndDate || fStartDate);
    const isRecurring = fRecurring !== 'none';
    const payload = {
      workspace_id: currentWorkspace.id,
      user_id: user.id,
      title: fTitle.trim(),
      start_date: fStartDate,
      end_date: endDate,
      color: fColor,
      is_recurring: isRecurring,
      recurring_type: fRecurring,
      note: fNote.trim(),
      updated_at: new Date().toISOString(),
    };

    let error;
    if (editEntry) {
      ({ error } = await supabase
        .from('trackino_important_days')
        .update(payload)
        .eq('id', editEntry.id));
    } else {
      ({ error } = await supabase
        .from('trackino_important_days')
        .insert(payload));
    }

    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        setFormError('Tabulka neexistuje – spusť SQL migraci v Supabase (viz banner nahoře). Detail: ' + error.message);
      } else {
        setFormError('Chyba: ' + error.message);
      }
      setSaving(false);
      return;
    }

    setShowForm(false);
    fetchEntries();
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Opravdu smazat tento záznam?')) return;
    await supabase.from('trackino_important_days').delete().eq('id', id);
    fetchEntries();
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>

      {/* SQL migrace banner (skryje se po kliknutí „Migrace spuštěna – skrýt") */}
      {!sqlBannerDismissed && (
        <details
          className="mb-5 rounded-xl border overflow-hidden"
          style={{ borderColor: '#f59e0b66', background: 'var(--bg-card)' }}
        >
          <summary
            className="cursor-pointer px-4 py-3 text-sm font-medium flex items-center gap-2"
            style={{ color: '#d97706', listStyle: 'none' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            Vyžadována SQL migrace v Supabase – klikni pro zobrazení
          </summary>
          <div className="px-4 pb-4 pt-1">
            <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
              Zkopíruj a spusť v Supabase SQL editoru:
            </p>
            <pre
              className="rounded-lg p-3 text-xs overflow-x-auto"
              style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', fontFamily: 'monospace' }}
            >{`CREATE TABLE IF NOT EXISTS trackino_important_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES trackino_workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  start_date text NOT NULL,
  end_date text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  is_recurring boolean NOT NULL DEFAULT false,
  recurring_type text NOT NULL DEFAULT 'none'
    CHECK (recurring_type IN ('none','weekly','monthly','yearly')),
  note text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE trackino_important_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth full" ON trackino_important_days
  FOR ALL TO authenticated USING (true) WITH CHECK (true);`}</pre>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Po spuštění migrace bude stránka plně funkční.</p>
              <button
                onClick={dismissSqlBanner}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white flex-shrink-0"
                style={{ background: '#d97706' }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#b45309'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#d97706'}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Migrace spuštěna – skrýt
              </button>
            </div>
          </div>
        </details>
      )}

      {/* Hlavička */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Důležité dny</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Osobní záznamy důležitých dat a opakujících se událostí
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: 'var(--primary)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Přidat
        </button>
      </div>

      {/* Obsah */}
      {loading ? (
        <div className="flex justify-center py-16" style={{ color: 'var(--text-muted)' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
            <line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" />
            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" /><line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
            <line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" />
            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" /><line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
          </svg>
        </div>
      ) : entries.length === 0 ? (
        <div
          className="rounded-xl border p-12 text-center"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }}>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <path d="M8 14h.01" /><path d="M12 14h.01" /><path d="M16 14h.01" />
            <path d="M8 18h.01" /><path d="M12 18h.01" />
          </svg>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Zatím žádné záznamy. Přidej svůj první důležitý den.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map(entry => (
            <div
              key={entry.id}
              className="rounded-xl border p-4 flex items-start gap-4"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}
            >
              {/* Barevný pruh vlevo */}
              <div
                className="flex-shrink-0 w-1.5 self-stretch rounded-full"
                style={{ background: entry.color }}
              />

              {/* Barevný puntík */}
              <div
                className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-base"
                style={{ background: entry.color + '22', border: `2px solid ${entry.color}44` }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={entry.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                  <path d="M8 14h.01" /><path d="M12 14h.01" />
                </svg>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{entry.title}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {entry.is_recurring ? (
                    <span>
                      {recurringLabel(entry.recurring_type)} – od {formatDate(entry.start_date)}
                    </span>
                  ) : entry.start_date === entry.end_date ? (
                    formatDate(entry.start_date)
                  ) : (
                    `${formatDate(entry.start_date)} – ${formatDate(entry.end_date)}`
                  )}
                </div>
                {entry.note && (
                  <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{entry.note}</div>
                )}
              </div>

              {/* Badge opakování */}
              {entry.is_recurring && (
                <span
                  className="flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{ background: entry.color + '22', color: entry.color }}
                >
                  {recurringLabel(entry.recurring_type)}
                </span>
              )}

              {/* Akce */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => openEdit(entry)}
                  className="p-1.5 rounded-lg transition-colors"
                  title="Upravit"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(entry.id)}
                  className="p-1.5 rounded-lg transition-colors"
                  title="Smazat"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-light)'; e.currentTarget.style.color = 'var(--danger)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal formulář */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div
            className="w-full max-w-md rounded-xl shadow-xl border p-6"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
          >
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              {editEntry ? 'Upravit záznam' : 'Nový důležitý den'}
            </h2>

            <div className="space-y-4">
              {/* Název */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Název *</label>
                <input
                  type="text"
                  value={fTitle}
                  onChange={e => setFTitle(e.target.value)}
                  placeholder="Např. Narozeniny, Výroční schůzka…"
                  className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-input, var(--bg-hover))', color: 'var(--text-primary)' }}
                  autoFocus
                />
              </div>

              {/* Opakování */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Opakování</label>
                <div className="relative">
                  <select
                    value={fRecurring}
                    onChange={e => setFRecurring(e.target.value as ImportantDayRecurring)}
                    className="w-full px-3 py-2 pr-8 rounded-lg border text-base sm:text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg-input, var(--bg-hover))', color: 'var(--text-primary)' }}
                  >
                    <option value="none">Jednorázově</option>
                    <option value="weekly">Každý týden (stejný den v týdnu)</option>
                    <option value="monthly">Každý měsíc (stejný den v měsíci)</option>
                    <option value="yearly">Každý rok (stejné datum)</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text-muted)' }}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Datum(a) */}
              {fRecurring === 'none' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Od *</label>
                    <input
                      type="date"
                      value={fStartDate}
                      onChange={e => { setFStartDate(e.target.value); if (!fEndDate || e.target.value > fEndDate) setFEndDate(e.target.value); }}
                      className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm"
                      style={{ borderColor: 'var(--border)', background: 'var(--bg-input, var(--bg-hover))', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Do</label>
                    <input
                      type="date"
                      value={fEndDate}
                      min={fStartDate}
                      onChange={e => setFEndDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm"
                      style={{ borderColor: 'var(--border)', background: 'var(--bg-input, var(--bg-hover))', color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Datum začátku opakování *
                  </label>
                  <input
                    type="date"
                    value={fStartDate}
                    onChange={e => setFStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg-input, var(--bg-hover))', color: 'var(--text-primary)' }}
                  />
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    {fRecurring === 'weekly' && 'Opakuje se každý týden ve stejný den v týdnu.'}
                    {fRecurring === 'monthly' && 'Opakuje se každý měsíc ve stejný den v měsíci.'}
                    {fRecurring === 'yearly' && 'Opakuje se každý rok ve stejné datum.'}
                  </p>
                </div>
              )}

              {/* Barva */}
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Barva</label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setFColor(c)}
                      className="w-7 h-7 rounded-full transition-all hover:scale-110"
                      style={{
                        background: c,
                        outline: fColor === c ? '2px solid #000' : 'none',
                        outlineOffset: '2px',
                      }}
                      title={c}
                    />
                  ))}
                </div>
              </div>

              {/* Poznámka */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Poznámka</label>
                <textarea
                  value={fNote}
                  onChange={e => setFNote(e.target.value)}
                  rows={2}
                  placeholder="Volitelná poznámka…"
                  className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm resize-none"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-input, var(--bg-hover))', color: 'var(--text-primary)' }}
                />
              </div>

              {/* Chyba */}
              {formError && (
                <p className="text-xs rounded-lg px-3 py-2" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>{formError}</p>
              )}
            </div>

            {/* Tlačítka */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg text-sm border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'transparent' }}
              >
                Zrušit
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-60"
                style={{ background: 'var(--primary)' }}
              >
                {saving ? 'Ukládám…' : editEntry ? 'Uložit' : 'Přidat'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page + Providers ─────────────────────────────────────────────────────────

function ImportantDaysPage() {
  const { currentWorkspace } = useWorkspace();
  const router = useRouter();

  useEffect(() => {
    if (currentWorkspace && !currentWorkspace) router.push('/');
  }, [currentWorkspace, router]);

  return (
    <DashboardLayout>
      <div className="p-6">
        <ImportantDaysContent />
      </div>
    </DashboardLayout>
  );
}

export default function ImportantDaysPageWrapper() {
  return (
    <WorkspaceProvider>
      <ImportantDaysPage />
    </WorkspaceProvider>
  );
}

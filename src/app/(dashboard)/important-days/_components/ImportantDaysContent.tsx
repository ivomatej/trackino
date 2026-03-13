'use client';

import { useImportantDays } from './useImportantDays';
import ImportantDayItem from './ImportantDayItem';
import ImportantDayForm from './ImportantDayForm';

export default function ImportantDaysContent() {
  const {
    entries, loading,
    showForm, setShowForm,
    editEntry, saving, formError,
    sqlBannerDismissed, dismissSqlBanner,
    fTitle, setFTitle,
    fStartDate, setFStartDate,
    fEndDate, setFEndDate,
    fColor, setFColor,
    fRecurring, setFRecurring,
    fNote, setFNote,
    openNew, openEdit,
    handleSave, handleDelete,
  } = useImportantDays();

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
            <ImportantDayItem
              key={entry.id}
              entry={entry}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Modal formulář */}
      {showForm && (
        <ImportantDayForm
          editEntry={editEntry}
          saving={saving}
          formError={formError}
          fTitle={fTitle} setFTitle={setFTitle}
          fStartDate={fStartDate} setFStartDate={setFStartDate}
          fEndDate={fEndDate} setFEndDate={setFEndDate}
          fColor={fColor} setFColor={setFColor}
          fRecurring={fRecurring} setFRecurring={setFRecurring}
          fNote={fNote} setFNote={setFNote}
          onSave={handleSave}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

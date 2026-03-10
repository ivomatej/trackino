'use client';
// ─── Calendar Module – CalendarFormModal ─────────────────────────────────────
// Přesunuto z page.tsx (ř. 5546–5621)

import { useCalendarContext } from '../CalendarContext';
import { DEFAULT_COLORS } from '../utils';

export default function CalendarFormModal() {
  const {
    showCalendarForm, setShowCalendarForm,
    editingCalendar,
    calendarForm, setCalendarForm,
    savingCalendar, saveCalendar, deleteCalendar,
  } = useCalendarContext();

  if (!showCalendarForm) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-sm rounded-xl shadow-xl border p-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            {editingCalendar ? 'Upravit kalendář' : 'Nový kalendář'}
          </h2>
          <button onClick={() => setShowCalendarForm(false)} className="p-1 rounded" style={{ color: 'var(--text-muted)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Název *</label>
            <input
              type="text"
              value={calendarForm.name}
              onChange={e => setCalendarForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Název kalendáře"
              className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Barva</label>
            <div className="flex items-center gap-2 flex-wrap">
              {DEFAULT_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setCalendarForm(f => ({ ...f, color: c }))}
                  className="w-7 h-7 rounded-full transition-all"
                  style={{
                    background: c,
                    boxShadow: calendarForm.color === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : 'none',
                    transform: calendarForm.color === c ? 'scale(1.15)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-6">
          {editingCalendar && !editingCalendar.is_default ? (
            <button
              onClick={async () => {
                if (confirm('Odstranit tento kalendář? Budou smazány i všechny jeho události.')) {
                  await deleteCalendar(editingCalendar.id);
                  setShowCalendarForm(false);
                }
              }}
              className="px-3 py-2 rounded-lg text-sm transition-colors"
              style={{ color: '#ef4444' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#fee2e244')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              Odstranit
            </button>
          ) : <div />}
          <div className="flex gap-2">
            <button onClick={() => setShowCalendarForm(false)} className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
              Zrušit
            </button>
            <button
              onClick={saveCalendar}
              disabled={savingCalendar || !calendarForm.name.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
              style={{ background: 'var(--primary)' }}
            >
              {savingCalendar ? 'Ukládám...' : editingCalendar ? 'Uložit' : 'Přidat'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

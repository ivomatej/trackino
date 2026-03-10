'use client';
// ─── Calendar Module – CalSettingsModal ──────────────────────────────────────
// Přesunuto z page.tsx (ř. 4876–4953)

import { useCalendarContext } from '../CalendarContext';

export default function CalSettingsModal() {
  const {
    showCalSettings, setShowCalSettings,
    calSettingsForm, setCalSettingsForm,
    saveCalSettings,
  } = useCalendarContext();

  if (!showCalSettings) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md rounded-xl shadow-xl border p-6 overflow-y-auto" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', maxHeight: '90vh' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Nastavení kalendáře</h2>
          <button onClick={() => setShowCalSettings(false)} className="p-1 rounded" style={{ color: 'var(--text-muted)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
          Nastavte, od které hodiny se má kalendář otevřít. Záhlaví s dny zůstane při scrollu ukotveno. Celý den (0–23 h) je dostupný scrollem.
        </p>

        <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Počáteční pozice při otevření</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Od</label>
            <div className="relative">
              <select
                value={calSettingsForm.viewStart}
                onChange={e => setCalSettingsForm(f => ({ ...f, viewStart: parseInt(e.target.value) }))}
                className="w-full appearance-none px-3 py-2 pr-8 rounded-lg border text-base sm:text-sm"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                ))}
              </select>
              <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text-muted)' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Do</label>
            <div className="relative">
              <select
                value={calSettingsForm.viewEnd}
                onChange={e => setCalSettingsForm(f => ({ ...f, viewEnd: parseInt(e.target.value) }))}
                className="w-full appearance-none px-3 py-2 pr-8 rounded-lg border text-base sm:text-sm"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
              >
                {Array.from({ length: 24 }, (_, i) => i + 1).filter(h => h > calSettingsForm.viewStart).map(h => (
                  <option key={h} value={h}>{h === 24 ? '0:00 (půlnoc)' : `${String(h).padStart(2, '0')}:00`}</option>
                ))}
              </select>
              <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text-muted)' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
          Příklad: Od 9:00 → kalendář se otevře s řádkem 9:00 hned pod záhlavím.
        </p>

        <div className="flex gap-2 justify-end mt-5">
          <button
            onClick={() => setShowCalSettings(false)}
            className="px-4 py-2 rounded-lg text-sm border"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            Zrušit
          </button>
          <button
            onClick={saveCalSettings}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: 'var(--primary)' }}
          >
            Uložit
          </button>
        </div>
      </div>
    </div>
  );
}

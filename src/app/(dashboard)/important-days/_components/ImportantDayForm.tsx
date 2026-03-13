'use client';

import type { ImportantDay, ImportantDayRecurring } from '@/types/database';
import { PRESET_COLORS } from './constants';

interface Props {
  editEntry: ImportantDay | null;
  saving: boolean;
  formError: string;
  fTitle: string; setFTitle: (v: string) => void;
  fStartDate: string; setFStartDate: (v: string) => void;
  fEndDate: string; setFEndDate: (v: string) => void;
  fColor: string; setFColor: (v: string) => void;
  fRecurring: ImportantDayRecurring; setFRecurring: (v: ImportantDayRecurring) => void;
  fNote: string; setFNote: (v: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export default function ImportantDayForm({
  editEntry, saving, formError,
  fTitle, setFTitle,
  fStartDate, setFStartDate,
  fEndDate, setFEndDate,
  fColor, setFColor,
  fRecurring, setFRecurring,
  fNote, setFNote,
  onSave, onClose,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div
        className="w-full max-w-md rounded-xl shadow-xl border p-6 overflow-x-hidden"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', transform: 'translateZ(0)' }}
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
              style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
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
                style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="min-w-0">
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Od *</label>
                <input
                  type="date"
                  value={fStartDate}
                  onChange={e => { setFStartDate(e.target.value); if (!fEndDate || e.target.value > fEndDate) setFEndDate(e.target.value); }}
                  className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)', maxWidth: '100%' }}
                />
              </div>
              <div className="min-w-0">
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Do</label>
                <input
                  type="date"
                  value={fEndDate}
                  min={fStartDate}
                  onChange={e => setFEndDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)', maxWidth: '100%' }}
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
                style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
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
              style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
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
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm border"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'transparent' }}
          >
            Zrušit
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-60"
            style={{ background: 'var(--primary)' }}
          >
            {saving ? 'Ukládám…' : editEntry ? 'Uložit' : 'Přidat'}
          </button>
        </div>
      </div>
    </div>
  );
}

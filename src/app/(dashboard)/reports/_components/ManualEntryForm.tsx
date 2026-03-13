'use client';

import type { Project, Category, Task } from '@/types/database';
import type { MemberProfile } from './types';
import { SelectWrap } from './SelectWrap';

interface ManualEntryFormProps {
  user: { id: string } | null;
  projects: Project[];
  categories: Category[];
  tasks: Task[];
  members: MemberProfile[];
  canSeeOthers: boolean;
  manualDate: string;
  setManualDate: (v: string) => void;
  manualStart: string;
  setManualStart: (v: string) => void;
  manualEnd: string;
  setManualEnd: (v: string) => void;
  manualProject: string;
  setManualProject: (v: string) => void;
  manualCategory: string;
  setManualCategory: (v: string) => void;
  manualTask: string;
  setManualTask: (v: string) => void;
  manualDesc: string;
  setManualDesc: (v: string) => void;
  manualForUser: string;
  setManualForUser: (v: string) => void;
  manualSaving: boolean;
  manualError: string;
  saveManual: () => Promise<void>;
  onClose: () => void;
}

export function ManualEntryForm({
  user, projects, categories, tasks, members, canSeeOthers,
  manualDate, setManualDate, manualStart, setManualStart, manualEnd, setManualEnd,
  manualProject, setManualProject, manualCategory, setManualCategory,
  manualTask, setManualTask, manualDesc, setManualDesc,
  manualForUser, setManualForUser, manualSaving, manualError,
  saveManual, onClose,
}: ManualEntryFormProps) {
  return (
    <div className="rounded-xl border p-5 space-y-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Ruční zadání záznamu</h2>
        <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Datum</label>
          <input
            type="date"
            value={manualDate}
            onChange={(e) => setManualDate(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Začátek</label>
          <input
            type="time"
            value={manualStart}
            onChange={(e) => setManualStart(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)] tabular-nums"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Konec</label>
          <input
            type="time"
            value={manualEnd}
            onChange={(e) => setManualEnd(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)] tabular-nums"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Projekt</label>
          <SelectWrap>
            <select
              value={manualProject}
              onChange={(e) => setManualProject(e.target.value)}
              className="w-full px-3 py-2 pr-8 rounded-lg border text-base sm:text-sm focus:outline-none appearance-none cursor-pointer"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
            >
              <option value="">— Bez projektu —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </SelectWrap>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Kategorie</label>
          <SelectWrap>
            <select
              value={manualCategory}
              onChange={(e) => setManualCategory(e.target.value)}
              className="w-full px-3 py-2 pr-8 rounded-lg border text-base sm:text-sm focus:outline-none appearance-none cursor-pointer"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
            >
              <option value="">— Bez kategorie —</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </SelectWrap>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Úkol</label>
          <SelectWrap>
            <select
              value={manualTask}
              onChange={(e) => setManualTask(e.target.value)}
              className="w-full px-3 py-2 pr-8 rounded-lg border text-base sm:text-sm focus:outline-none appearance-none cursor-pointer"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
            >
              <option value="">— Bez úkolu —</option>
              {tasks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </SelectWrap>
        </div>
        {canSeeOthers && members.length > 0 && (
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Zadat za uživatele</label>
            <SelectWrap>
              <select
                value={manualForUser}
                onChange={(e) => setManualForUser(e.target.value)}
                className="w-full px-3 py-2 pr-8 rounded-lg border text-base sm:text-sm focus:outline-none appearance-none cursor-pointer"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
              >
                <option value="me">Já (vlastní záznam)</option>
                {members.filter(m => m.user_id !== user?.id).map(m => (
                  <option key={m.user_id} value={m.user_id}>{m.display_name}</option>
                ))}
              </select>
            </SelectWrap>
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Popis (volitelné)</label>
        <input
          type="text"
          value={manualDesc}
          onChange={(e) => setManualDesc(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') saveManual(); }}
          placeholder="Co jste dělali?"
          className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
        />
      </div>

      {manualError && (
        <p className="text-xs" style={{ color: 'var(--danger)' }}>{manualError}</p>
      )}

      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="px-3 py-1.5 rounded-lg border text-sm"
          style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
        >
          Zrušit
        </button>
        <button
          onClick={saveManual}
          disabled={manualSaving}
          className="px-4 py-1.5 rounded-lg text-white text-sm font-medium disabled:opacity-50"
          style={{ background: 'var(--primary)' }}
        >
          {manualSaving ? 'Ukládám...' : 'Přidat záznam'}
        </button>
      </div>
    </div>
  );
}

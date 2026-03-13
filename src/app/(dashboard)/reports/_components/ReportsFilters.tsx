'use client';

import type { Project } from '@/types/database';
import type { MemberProfile, DatePreset } from './types';
import { PRESETS } from './types';
import { SelectWrap } from './SelectWrap';

interface ReportsFiltersProps {
  preset: DatePreset;
  setPreset: (p: DatePreset) => void;
  customFrom: string;
  setCustomFrom: (v: string) => void;
  customTo: string;
  setCustomTo: (v: string) => void;
  userFilter: string;
  setUserFilter: (v: string) => void;
  projectFilter: string;
  setProjectFilter: (v: string) => void;
  canSeeOthers: boolean;
  user: { id: string } | null;
  members: MemberProfile[];
  projects: Project[];
}

export function ReportsFilters({
  preset, setPreset,
  customFrom, setCustomFrom,
  customTo, setCustomTo,
  userFilter, setUserFilter,
  projectFilter, setProjectFilter,
  canSeeOthers, user, members, projects,
}: ReportsFiltersProps) {
  return (
    <div className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <div className="flex flex-wrap gap-3 items-end">
        {/* Časové období */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Období</label>
          <div className="flex gap-1 rounded-lg p-1" style={{ background: 'var(--bg-hover)' }}>
            {PRESETS.map(p => (
              <button
                key={p.value}
                onClick={() => setPreset(p.value)}
                className="px-2 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap"
                style={{
                  background: preset === p.value ? 'var(--bg-card)' : 'transparent',
                  color: preset === p.value ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: preset === p.value ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                {p.value === 'week' ? (
                  <><span className="hidden sm:inline">Tento </span>týden</>
                ) : p.value === 'month' ? (
                  <><span className="hidden sm:inline">Tento </span>měsíc</>
                ) : p.label}
              </button>
            ))}
          </div>
        </div>

        {preset === 'custom' && (
          <div className="w-full grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Od</label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)', maxWidth: '100%' }}
              />
            </div>
            <div className="min-w-0">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Do</label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)', maxWidth: '100%' }}
              />
            </div>
          </div>
        )}

        {/* User filter */}
        {canSeeOthers && members.length > 0 && (
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Uživatel</label>
            <SelectWrap>
              <select
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="px-3 py-2 pr-8 rounded-lg border text-base sm:text-sm focus:outline-none appearance-none cursor-pointer"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
              >
                <option value="me">Já</option>
                <option value="all">Všichni</option>
                {members.filter(m => m.user_id !== user?.id).map(m => (
                  <option key={m.user_id} value={m.user_id}>{m.display_name}</option>
                ))}
              </select>
            </SelectWrap>
          </div>
        )}

        {/* Project filter */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Projekt</label>
          <SelectWrap>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="px-3 py-2 pr-8 rounded-lg border text-base sm:text-sm focus:outline-none appearance-none cursor-pointer"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
            >
              <option value="all">Všechny projekty</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </SelectWrap>
        </div>
      </div>
    </div>
  );
}

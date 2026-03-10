'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { VacationAllowance } from '@/types/database';
import { INPUT_CLS, INPUT_STYLE } from '../constants';

interface Props {
  workspaceId: string;
}

export default function TabVacation({ workspaceId }: Props) {
  const [vacationAllowances, setVacationAllowances] = useState<VacationAllowance[]>([]);
  const [vacLoading, setVacLoading] = useState(false);
  const [newVacYear, setNewVacYear] = useState('');
  const [newVacDays, setNewVacDays] = useState('');
  const [addingVac, setAddingVac] = useState(false);

  useEffect(() => {
    fetchVacationAllowances();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  async function fetchVacationAllowances() {
    setVacLoading(true);
    const { data } = await supabase
      .from('trackino_vacation_allowances')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('year', { ascending: false });
    setVacationAllowances((data ?? []) as VacationAllowance[]);
    setVacLoading(false);
  }

  async function addVacationAllowance() {
    if (!newVacYear || !newVacDays) return;
    const year = parseInt(newVacYear);
    const days = parseInt(newVacDays);
    if (isNaN(year) || isNaN(days) || days < 0) return;
    setAddingVac(true);
    const { error } = await supabase
      .from('trackino_vacation_allowances')
      .upsert({ workspace_id: workspaceId, year, days_per_year: days }, { onConflict: 'workspace_id,year' });
    if (!error) {
      setNewVacYear('');
      setNewVacDays('');
      fetchVacationAllowances();
    }
    setAddingVac(false);
  }

  async function deleteVacationAllowance(id: string) {
    if (!confirm('Smazat tento rok dovolené?')) return;
    await supabase.from('trackino_vacation_allowances').delete().eq('id', id);
    setVacationAllowances(prev => prev.filter(v => v.id !== id));
  }

  const inputCls = INPUT_CLS;
  const inputStyle = INPUT_STYLE;

  return (
    <div className="p-5 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <h2 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Dovolená</h2>
      <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>
        Nastavte počet dní dovolené pro každý rok. V editaci člena pak zapněte přístup k dovolené pro konkrétní uživatele.
      </p>

      {/* Přidat nový rok */}
      <div className="flex gap-2 mb-4">
        <input
          type="number"
          value={newVacYear}
          onChange={(e) => setNewVacYear(e.target.value)}
          placeholder={String(new Date().getFullYear())}
          min="2020" max="2099"
          className={inputCls + ' max-w-[120px]'}
          style={inputStyle}
        />
        <div className="relative flex-1 max-w-[160px]">
          <input
            type="number"
            value={newVacDays}
            onChange={(e) => setNewVacDays(e.target.value)}
            placeholder="20"
            min="0" max="365"
            className={inputCls + ' pr-12'}
            style={inputStyle}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: 'var(--text-muted)' }}>dní</span>
        </div>
        <button
          onClick={addVacationAllowance}
          disabled={addingVac || !newVacYear || !newVacDays}
          className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
          style={{ background: 'var(--primary)' }}
        >
          {addingVac ? '...' : 'Přidat / aktualizovat'}
        </button>
      </div>

      {vacLoading ? (
        <div className="py-4 text-center"><div className="w-5 h-5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : vacationAllowances.length === 0 ? (
        <div className="py-6 text-center text-sm rounded-lg border border-dashed" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
          Zatím žádné záznamy. Přidejte počet dní pro daný rok.
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          {vacationAllowances.map(v => (
            <div key={v.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0" style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
              <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--text-primary)', minWidth: '60px' }}>{v.year}</span>
              <span className="text-lg font-semibold tabular-nums" style={{ color: 'var(--primary)' }}>{v.days_per_year}</span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>dní dovolené</span>
              <div className="flex-1" />
              <button
                onClick={() => deleteVacationAllowance(v.id)}
                className="p-1 rounded transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

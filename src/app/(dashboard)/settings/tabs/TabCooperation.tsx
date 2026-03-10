'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { CooperationType } from '@/types/database';
import { INPUT_CLS, INPUT_STYLE } from '../constants';

interface Props {
  workspaceId: string;
}

export default function TabCooperation({ workspaceId }: Props) {
  const [cooperationTypes, setCooperationTypes] = useState<CooperationType[]>([]);
  const [coopLoading, setCoopLoading] = useState(false);
  const [newCoopName, setNewCoopName] = useState('');
  const [addingCoop, setAddingCoop] = useState(false);

  useEffect(() => {
    fetchCooperationTypes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  async function fetchCooperationTypes() {
    setCoopLoading(true);
    const { data } = await supabase
      .from('trackino_cooperation_types')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('sort_order', { ascending: true });
    setCooperationTypes((data ?? []) as CooperationType[]);
    setCoopLoading(false);
  }

  async function addCooperationType() {
    if (!newCoopName.trim()) return;
    setAddingCoop(true);
    const maxOrder = cooperationTypes.length > 0 ? Math.max(...cooperationTypes.map(c => c.sort_order)) : -1;
    await supabase.from('trackino_cooperation_types').insert({
      workspace_id: workspaceId,
      name: newCoopName.trim(),
      sort_order: maxOrder + 1,
    });
    setNewCoopName('');
    fetchCooperationTypes();
    setAddingCoop(false);
  }

  async function deleteCooperationType(id: string, name: string) {
    if (!confirm(`Smazat typ spolupráce "${name}"? Uživatelé s tímto typem ztratí přiřazení.`)) return;
    await supabase.from('trackino_cooperation_types').delete().eq('id', id);
    setCooperationTypes(prev => prev.filter(c => c.id !== id));
  }

  const inputCls = INPUT_CLS;
  const inputStyle = INPUT_STYLE;

  return (
    <div className="p-5 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <h2 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Typy spolupráce</h2>
      <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>
        Definujte formy spolupráce (HPP, DPP, OSVČ…). V editaci člena pak vyberte typ pro každého uživatele.
      </p>

      {/* Přidat nový typ */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={newCoopName}
          onChange={(e) => setNewCoopName(e.target.value)}
          placeholder="HPP, DPP, OSVČ, s.r.o.…"
          className={inputCls}
          style={inputStyle}
          onKeyDown={(e) => { if (e.key === 'Enter') addCooperationType(); }}
        />
        <button
          onClick={addCooperationType}
          disabled={addingCoop || !newCoopName.trim()}
          className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50 whitespace-nowrap"
          style={{ background: 'var(--primary)' }}
        >
          {addingCoop ? '...' : 'Přidat'}
        </button>
      </div>

      {coopLoading ? (
        <div className="py-4 text-center"><div className="w-5 h-5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : cooperationTypes.length === 0 ? (
        <div className="py-6 text-center text-sm rounded-lg border border-dashed" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
          Zatím žádné typy. Přidejte HPP, DPP, OSVČ apod.
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          {cooperationTypes.map(ct => (
            <div key={ct.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0" style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
              <span className="text-sm font-medium flex-1" style={{ color: 'var(--text-primary)' }}>{ct.name}</span>
              <button
                onClick={() => deleteCooperationType(ct.id, ct.name)}
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

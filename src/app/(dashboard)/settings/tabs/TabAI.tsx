'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { AI_MODELS, CZK_PER_USD } from '@/lib/ai-providers';
import type { AiLimitType } from '@/types/database';
import type { AiMemberInfo } from '../types';
import { INPUT_CLS, INPUT_STYLE } from '../constants';

interface Props {
  workspaceId: string;
  onMessage: (msg: string) => void;
}

const LABEL_CLS = 'block text-xs font-medium mb-1';

export default function TabAI({ workspaceId, onMessage }: Props) {
  const now = new Date();
  const [aiMembers, setAiMembers] = useState<AiMemberInfo[]>([]);
  const [aiLimits, setAiLimits] = useState<{ daily: string; weekly: string; monthly: string }>({ daily: '', weekly: '', monthly: '' });
  const [aiLoading, setAiLoading] = useState(false);
  const [savingAi, setSavingAi] = useState(false);
  const [aiStatsMonth, setAiStatsMonth] = useState<{ year: number; month: number }>({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [aiUsageStats, setAiUsageStats] = useState<Record<string, { tokens: number; costUsd: number }>>({});
  const [aiUserLimits, setAiUserLimits] = useState<Record<string, { daily: string; weekly: string; monthly: string }>>({});
  const [savingAiUserLimits, setSavingAiUserLimits] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchAiSettings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  useEffect(() => {
    fetchAiStats(aiStatsMonth.year, aiStatsMonth.month);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiStatsMonth]);

  async function fetchAiSettings() {
    setAiLoading(true);
    try {
      const { data: members } = await supabase
        .from('trackino_workspace_members')
        .select('user_id, role, can_use_ai_assistant, ai_allowed_models')
        .eq('workspace_id', workspaceId)
        .eq('approved', true);

      const userIds = (members ?? []).map((m: { user_id: string }) => m.user_id);

      const { data: profiles } = await supabase
        .from('trackino_profiles')
        .select('id, display_name, email, avatar_color, is_master_admin')
        .in('id', userIds);

      const profileMap: Record<string, { display_name: string; email: string; avatar_color: string; is_master_admin: boolean }> = {};
      for (const p of profiles ?? []) {
        profileMap[(p as { id: string }).id] = p as { display_name: string; email: string; avatar_color: string; is_master_admin: boolean };
      }

      setAiMembers((members ?? []).map((m: { user_id: string; role: string; can_use_ai_assistant: boolean; ai_allowed_models: string[] | null }) => ({
        user_id: m.user_id,
        display_name: profileMap[m.user_id]?.display_name ?? profileMap[m.user_id]?.email ?? 'Neznámý',
        email: profileMap[m.user_id]?.email ?? '',
        avatar_color: profileMap[m.user_id]?.avatar_color ?? '#6366f1',
        role: m.role,
        is_master_admin: profileMap[m.user_id]?.is_master_admin ?? false,
        can_use_ai_assistant: m.can_use_ai_assistant ?? false,
        ai_allowed_models: m.ai_allowed_models ?? null,
      })));

      const { data: limits } = await supabase
        .from('trackino_ai_usage_limits')
        .select('*')
        .eq('workspace_id', workspaceId)
        .is('user_id', null);

      const limitMap: Record<string, string> = { daily: '', weekly: '', monthly: '' };
      for (const l of (limits ?? []) as { limit_type: string; token_limit: number | null }[]) {
        if (l.token_limit !== null) limitMap[l.limit_type] = String(l.token_limit);
      }
      setAiLimits({ daily: limitMap.daily, weekly: limitMap.weekly, monthly: limitMap.monthly });

      const { data: userLimits } = await supabase
        .from('trackino_ai_usage_limits')
        .select('*')
        .eq('workspace_id', workspaceId)
        .not('user_id', 'is', null);
      const ulMap: Record<string, { daily: string; weekly: string; monthly: string }> = {};
      for (const l of (userLimits ?? []) as { user_id: string; limit_type: string; token_limit: number | null }[]) {
        if (!ulMap[l.user_id]) ulMap[l.user_id] = { daily: '', weekly: '', monthly: '' };
        if (l.token_limit !== null) ulMap[l.user_id][l.limit_type as 'daily' | 'weekly' | 'monthly'] = String(l.token_limit);
      }
      setAiUserLimits(ulMap);
    } catch { /* tabulky ještě neexistují */ }
    setAiLoading(false);
    await fetchAiStats(aiStatsMonth.year, aiStatsMonth.month);
  }

  async function fetchAiStats(year: number, month: number) {
    try {
      const startOfMonth = new Date(year, month - 1, 1).toISOString();
      const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999).toISOString();
      const { data: convs } = await supabase
        .from('trackino_ai_conversations')
        .select('id, user_id')
        .eq('workspace_id', workspaceId);
      const convMap: Record<string, string> = {};
      for (const c of convs ?? []) convMap[(c as { id: string; user_id: string }).id] = (c as { id: string; user_id: string }).user_id;
      const { data: msgs } = await supabase
        .from('trackino_ai_messages')
        .select('conversation_id, total_tokens, cost_usd')
        .eq('workspace_id', workspaceId)
        .gte('created_at', startOfMonth)
        .lte('created_at', endOfMonth);
      const stats: Record<string, { tokens: number; costUsd: number }> = {};
      for (const m of msgs ?? []) {
        const msg = m as { conversation_id: string; total_tokens: number | null; cost_usd: number | null };
        const userId = convMap[msg.conversation_id];
        if (!userId) continue;
        if (!stats[userId]) stats[userId] = { tokens: 0, costUsd: 0 };
        stats[userId].tokens += msg.total_tokens ?? 0;
        stats[userId].costUsd += msg.cost_usd ?? 0;
      }
      setAiUsageStats(stats);
    } catch { /* tabulky ještě neexistují */ }
  }

  async function saveAiUserLimits(userId: string) {
    setSavingAiUserLimits(prev => ({ ...prev, [userId]: true }));
    const types: AiLimitType[] = ['daily', 'weekly', 'monthly'];
    const limits = aiUserLimits[userId] ?? { daily: '', weekly: '', monthly: '' };
    for (const lt of types) {
      const val = limits[lt];
      if (val === '') {
        await supabase.from('trackino_ai_usage_limits').delete()
          .eq('workspace_id', workspaceId).eq('user_id', userId).eq('limit_type', lt);
      } else {
        await supabase.from('trackino_ai_usage_limits').upsert({
          workspace_id: workspaceId, user_id: userId, limit_type: lt, token_limit: parseInt(val),
        }, { onConflict: 'workspace_id,user_id,limit_type' });
      }
    }
    setSavingAiUserLimits(prev => ({ ...prev, [userId]: false }));
    onMessage('Limity uživatele uloženy.');
    setTimeout(() => onMessage(''), 3000);
  }

  async function saveAiLimits() {
    setSavingAi(true);
    const types: AiLimitType[] = ['daily', 'weekly', 'monthly'];
    for (const lt of types) {
      const val = aiLimits[lt];
      if (val === '') {
        await supabase.from('trackino_ai_usage_limits').delete()
          .eq('workspace_id', workspaceId).is('user_id', null).eq('limit_type', lt);
      } else {
        await supabase.from('trackino_ai_usage_limits').upsert({
          workspace_id: workspaceId, user_id: null, limit_type: lt, token_limit: parseInt(val),
        }, { onConflict: 'workspace_id,user_id,limit_type' });
      }
    }
    setSavingAi(false);
    onMessage('Limity AI uloženy.');
    setTimeout(() => onMessage(''), 3000);
  }

  async function toggleAiAccess(userId: string, value: boolean) {
    await supabase.from('trackino_workspace_members').update({ can_use_ai_assistant: value })
      .eq('workspace_id', workspaceId).eq('user_id', userId);
    setAiMembers(prev => prev.map(m => m.user_id === userId ? { ...m, can_use_ai_assistant: value } : m));
  }

  async function toggleAiModel(userId: string, modelId: string) {
    const member = aiMembers.find(m => m.user_id === userId);
    let next: string[] | null;
    if (modelId === '__clear__') {
      next = null;
    } else {
      const current: string[] = member?.ai_allowed_models ?? AI_MODELS.map(m => m.id);
      const isChecked = current.includes(modelId);
      if (isChecked) {
        const removed = current.filter(id => id !== modelId);
        next = removed.length === 0 ? null : removed;
      } else {
        next = [...current, modelId];
        if (next.length === AI_MODELS.length) next = null;
      }
    }
    await supabase.from('trackino_workspace_members').update({ ai_allowed_models: next })
      .eq('workspace_id', workspaceId).eq('user_id', userId);
    setAiMembers(prev => prev.map(m => m.user_id === userId ? { ...m, ai_allowed_models: next } : m));
  }

  const inputCls = INPUT_CLS;
  const inputStyle = INPUT_STYLE;
  const labelCls = LABEL_CLS;

  return (
    <div className="space-y-5">
      {aiLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Limity tokenů */}
          <div className="p-5 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Limity tokenů (celý workspace)</h2>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Ponechte prázdné pro neomezený počet. Limity platí pro součet tokenů všech uživatelů workspace.</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              {(['daily', 'weekly', 'monthly'] as const).map(lt => {
                const labels: Record<string, string> = { daily: 'Denní limit (tokeny)', weekly: 'Týdenní limit (tokeny)', monthly: 'Měsíční limit (tokeny)' };
                const val = parseInt(aiLimits[lt] || '0') || 0;
                const avgCostPer1M = (0.15 + 0.60) / 2;
                const costUsd = (val / 1_000_000) * avgCostPer1M;
                const costCzk = costUsd * CZK_PER_USD;
                return (
                  <div key={lt}>
                    <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>{labels[lt]}</label>
                    <input
                      type="number"
                      min={0}
                      value={aiLimits[lt]}
                      onChange={e => setAiLimits(prev => ({ ...prev, [lt]: e.target.value }))}
                      placeholder="Neomezeno"
                      className={inputCls}
                      style={inputStyle}
                    />
                    {val > 0 && (
                      <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                        ≈ {costCzk < 1 ? (costCzk * 100).toFixed(1) + ' h' : costCzk.toFixed(1) + ' Kč'} (GPT-4o mini průměr)
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Přehled cen modelů */}
            <div className="mb-4 p-3 rounded-lg" style={{ background: 'var(--bg-hover)' }}>
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Orientační ceny OpenAI modelů (za 1 000 tokenů)</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {AI_MODELS.map(m => {
                  const inCzk = (m.inputCostPer1M / 1000) * CZK_PER_USD;
                  const outCzk = (m.outputCostPer1M / 1000) * CZK_PER_USD;
                  return (
                    <div key={m.id} className="text-xs">
                      <div className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{m.name}</div>
                      <div style={{ color: 'var(--text-muted)' }}>↓ {inCzk < 0.01 ? '<0,01' : inCzk.toFixed(3).replace('.', ',')} Kč</div>
                      <div style={{ color: 'var(--text-muted)' }}>↑ {outCzk < 0.01 ? '<0,01' : outCzk.toFixed(3).replace('.', ',')} Kč</div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] mt-2" style={{ color: 'var(--text-muted)' }}>Kurz: 1 USD = {CZK_PER_USD} Kč. ↓ = vstupní tokeny, ↑ = výstupní tokeny.</p>
            </div>

            <button
              onClick={saveAiLimits}
              disabled={savingAi}
              className="px-5 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
              style={{ background: 'var(--primary)' }}
            >
              {savingAi ? 'Ukládám...' : 'Uložit limity'}
            </button>
          </div>

          {/* Per-user přístup, statistiky a limity */}
          <div className="p-5 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
              <div>
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Přístup, statistiky a limity per uživatel</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Master admin, owner a admin mají přístup vždy. Statistiky zobrazují využití za vybraný měsíc.</p>
              </div>
              {/* Výběr měsíce pro statistiky */}
              <div className="relative flex-shrink-0">
                <select
                  value={`${aiStatsMonth.year}-${aiStatsMonth.month}`}
                  onChange={e => {
                    const [y, m] = e.target.value.split('-').map(Number);
                    setAiStatsMonth({ year: y, month: m });
                  }}
                  className="appearance-none pl-3 pr-8 py-1.5 rounded-lg border text-xs text-base sm:text-sm"
                  style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                >
                  {Array.from({ length: 7 }, (_, i) => {
                    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
                    const y = d.getFullYear(); const mo = d.getMonth() + 1;
                    const label = d.toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' });
                    return <option key={`${y}-${mo}`} value={`${y}-${mo}`}>{label}</option>;
                  })}
                </select>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}><polyline points="6 9 12 15 18 9"/></svg>
              </div>
            </div>

            <div className="space-y-3 mt-4">
              {aiMembers.map(member => {
                const roleLabels: Record<string, string> = { owner: 'Vlastník', admin: 'Admin', manager: 'Manažer', member: 'Člen' };
                const isAlwaysGranted = member.is_master_admin;
                const stats = aiUsageStats[member.user_id];
                const userLimits = aiUserLimits[member.user_id] ?? { daily: '', weekly: '', monthly: '' };
                const isSavingUserLimits = savingAiUserLimits[member.user_id] ?? false;
                return (
                  <div key={member.user_id} className="p-3 rounded-lg border" style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
                    <div className="flex items-center gap-3 mb-2">
                      {/* Avatar */}
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                        style={{ background: member.avatar_color }}>
                        {member.display_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium truncate block" style={{ color: 'var(--text-primary)' }}>{member.display_name}</span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{roleLabels[member.role] ?? member.role}</span>
                      </div>
                      {/* Statistiky měsíce */}
                      {stats && stats.tokens > 0 ? (
                        <div className="text-right flex-shrink-0">
                          <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{stats.tokens.toLocaleString('cs-CZ')} tok.</div>
                          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>≈ {(stats.costUsd * CZK_PER_USD).toFixed(2).replace('.', ',')} Kč</div>
                        </div>
                      ) : (
                        <div className="text-right flex-shrink-0">
                          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>0 tok.</div>
                        </div>
                      )}
                      {/* Toggle přístupu */}
                      <label className="flex items-center gap-2 cursor-pointer flex-shrink-0">
                        <span className="text-xs" style={{ color: isAlwaysGranted ? 'var(--success)' : 'var(--text-muted)' }}>
                          {isAlwaysGranted ? 'Vždy' : 'Přístup'}
                        </span>
                        <div
                          onClick={() => !isAlwaysGranted && toggleAiAccess(member.user_id, !member.can_use_ai_assistant)}
                          className="relative w-9 h-5 rounded-full transition-colors flex-shrink-0"
                          style={{
                            background: (isAlwaysGranted || member.can_use_ai_assistant) ? 'var(--primary)' : 'var(--border)',
                            cursor: isAlwaysGranted ? 'default' : 'pointer',
                            opacity: isAlwaysGranted ? 0.6 : 1,
                          }}
                        >
                          <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform"
                            style={{ transform: (isAlwaysGranted || member.can_use_ai_assistant) ? 'translateX(16px)' : 'translateX(0)' }} />
                        </div>
                      </label>
                    </div>

                    {/* Modely – jen pokud má přístup */}
                    {(isAlwaysGranted || member.can_use_ai_assistant) && (
                      <div className="mb-3">
                        <p className="text-[10px] mb-1.5" style={{ color: 'var(--text-muted)' }}>
                          Povolené modely: {!member.ai_allowed_models || member.ai_allowed_models.length === 0 ? 'všechny' : member.ai_allowed_models.join(', ')}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {AI_MODELS.map(m => {
                            const checked = !member.ai_allowed_models || member.ai_allowed_models.includes(m.id);
                            return (
                              <button
                                key={m.id}
                                onClick={() => toggleAiModel(member.user_id, m.id)}
                                className="px-2 py-0.5 rounded-full text-xs font-medium border transition-colors"
                                style={{
                                  background: checked ? 'var(--bg-active)' : 'transparent',
                                  borderColor: checked ? 'var(--primary)' : 'var(--border)',
                                  color: checked ? 'var(--primary)' : 'var(--text-muted)',
                                }}
                              >
                                {m.name}
                              </button>
                            );
                          })}
                          {member.ai_allowed_models && member.ai_allowed_models.length > 0 && (
                            <button
                              onClick={() => toggleAiModel(member.user_id, '__clear__')}
                              className="px-2 py-0.5 rounded-full text-xs border transition-colors"
                              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                            >
                              Reset (vše)
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Per-user token limity */}
                    <div className="border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                      <p className="text-[10px] font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Limity tokenů (osobní)</p>
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        {(['daily', 'weekly', 'monthly'] as const).map(lt => {
                          const ltLabels: Record<string, string> = { daily: 'Denní', weekly: 'Týdenní', monthly: 'Měsíční' };
                          return (
                            <div key={lt}>
                              <label className="block text-[10px] mb-0.5" style={{ color: 'var(--text-muted)' }}>{ltLabels[lt]}</label>
                              <input
                                type="number"
                                min={0}
                                value={userLimits[lt]}
                                onChange={e => setAiUserLimits(prev => ({
                                  ...prev,
                                  [member.user_id]: { ...(prev[member.user_id] ?? { daily: '', weekly: '', monthly: '' }), [lt]: e.target.value },
                                }))}
                                placeholder="Neomezeno"
                                className="w-full px-2 py-1 rounded border text-xs text-base sm:text-sm"
                                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                              />
                            </div>
                          );
                        })}
                      </div>
                      <button
                        onClick={() => saveAiUserLimits(member.user_id)}
                        disabled={isSavingUserLimits}
                        className="px-3 py-1 rounded-lg text-xs font-medium disabled:opacity-50"
                        style={{ background: 'var(--primary)', color: '#fff' }}
                      >
                        {isSavingUserLimits ? 'Ukládám...' : 'Uložit limity'}
                      </button>
                    </div>
                  </div>
                );
              })}
              {aiMembers.length === 0 && (
                <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>Žádní členové workspace.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { ALL_MODULES, TARIFF_MODULES } from '@/lib/modules';
import type { ModuleId, Tariff } from '@/types/database';
import type { MemberModuleInfo } from '../types';

interface Props {
  workspaceId: string;
  tariff: Tariff;
}

export default function TabModules({ workspaceId, tariff }: Props) {
  const [moduleMembers, setModuleMembers] = useState<MemberModuleInfo[]>([]);
  const [moduleLoading, setModuleLoading] = useState(false);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [addModuleUserId, setAddModuleUserId] = useState<string | null>(null);
  const [addModuleId, setAddModuleId] = useState<ModuleId | ''>('');
  const [addModuleEnabled, setAddModuleEnabled] = useState(true);

  const fetchModuleData = useCallback(async () => {
    setModuleLoading(true);
    try {
      const { data: members } = await supabase
        .from('trackino_workspace_members')
        .select('user_id, role, approved')
        .eq('workspace_id', workspaceId)
        .eq('approved', true);

      const userIds = (members ?? []).map((m: { user_id: string }) => m.user_id);

      const { data: profiles } = await supabase
        .from('trackino_profiles')
        .select('id, display_name, email, avatar_color')
        .in('id', userIds);

      const { data: overrides } = await supabase
        .from('trackino_user_module_overrides')
        .select('id, user_id, module_id, enabled')
        .eq('workspace_id', workspaceId);

      const profileMap: Record<string, { display_name: string; email: string; avatar_color: string }> = {};
      for (const p of profiles ?? []) {
        profileMap[(p as { id: string }).id] = p as { display_name: string; email: string; avatar_color: string };
      }

      const overridesByUser: Record<string, { id: string; module_id: ModuleId; enabled: boolean }[]> = {};
      for (const o of (overrides ?? []) as { id: string; user_id: string; module_id: ModuleId; enabled: boolean }[]) {
        if (!overridesByUser[o.user_id]) overridesByUser[o.user_id] = [];
        overridesByUser[o.user_id].push({ id: o.id, module_id: o.module_id, enabled: o.enabled });
      }

      const result: MemberModuleInfo[] = (members ?? []).map((m: { user_id: string; role: string }) => ({
        user_id: m.user_id,
        display_name: profileMap[m.user_id]?.display_name ?? profileMap[m.user_id]?.email ?? 'Neznámý',
        email: profileMap[m.user_id]?.email ?? '',
        avatar_color: profileMap[m.user_id]?.avatar_color ?? '#6366f1',
        role: m.role,
        overrides: overridesByUser[m.user_id] ?? [],
      }));

      setModuleMembers(result);
    } catch {
      setModuleMembers([]);
    }
    setModuleLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    fetchModuleData();
  }, [fetchModuleData]);

  async function addModuleOverride(userId: string) {
    if (!addModuleId) return;
    const { error } = await supabase
      .from('trackino_user_module_overrides')
      .upsert({
        workspace_id: workspaceId,
        user_id: userId,
        module_id: addModuleId,
        enabled: addModuleEnabled,
      }, { onConflict: 'workspace_id,user_id,module_id' });
    if (!error) {
      setAddModuleUserId(null);
      setAddModuleId('');
      setAddModuleEnabled(true);
      fetchModuleData();
    }
  }

  async function removeModuleOverride(overrideId: string) {
    await supabase.from('trackino_user_module_overrides').delete().eq('id', overrideId);
    fetchModuleData();
  }

  return (
    <div className="space-y-4">
      {/* Popis tarifu */}
      <div className="p-4 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Moduly dle tarifu</h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Výchozí sada modulů závisí na tarifu workspace (<strong>{tariff.toUpperCase()}</strong>).
              Pro jednotlivé uživatele lze přidat nebo odebrat konkrétní moduly bez ohledu na tarif.
            </p>
          </div>
        </div>

        {/* Přehled modulů dle tarifu */}
        <div className="mt-4 space-y-2">
          {['Sledování', 'Analýza', 'Správa'].map(group => {
            const groupModules = ALL_MODULES.filter(m => m.group === group);
            return (
              <div key={group}>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>{group}</p>
                <div className="flex flex-wrap gap-1.5">
                  {groupModules.map(m => {
                    const inTariff = (TARIFF_MODULES[tariff] ?? []).includes(m.id);
                    return (
                      <span
                        key={m.id}
                        className="px-2 py-0.5 rounded-full text-[11px] font-medium"
                        style={{
                          background: inTariff ? 'var(--bg-active)' : 'var(--bg-hover)',
                          color: inTariff ? 'var(--primary)' : 'var(--text-muted)',
                          border: `1px solid ${inTariff ? 'var(--primary)' : 'var(--border)'}`,
                        }}
                      >
                        {m.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Per-user overrides */}
      <div>
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Individuální moduly pro uživatele</h2>

        {moduleLoading ? (
          <div className="py-8 text-center">
            <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : moduleMembers.length === 0 ? (
          <div className="py-6 text-center text-sm rounded-xl border border-dashed" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
            Žádní členové k dispozici.
          </div>
        ) : (
          <div className="space-y-2">
            {moduleMembers.map(member => {
              const initials = member.display_name
                ? member.display_name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2)
                : (member.email?.charAt(0).toUpperCase() ?? '?');
              const isExpanded = expandedMember === member.user_id;
              const tariffMods = new Set<string>(TARIFF_MODULES[tariff] ?? []);

              return (
                <div key={member.user_id} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
                  {/* Řádek člena */}
                  <button
                    onClick={() => setExpandedMember(isExpanded ? null : member.user_id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ background: member.avatar_color }}
                    >
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{member.display_name}</div>
                      <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                        {{ owner: 'Vlastník', admin: 'Admin', manager: 'Team Manager', member: 'Člen' }[member.role] ?? member.role}
                      </div>
                    </div>
                    {member.overrides.length > 0 && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--bg-active)', color: 'var(--primary)' }}>
                        {member.overrides.length} {member.overrides.length === 1 ? 'výjimka' : member.overrides.length < 5 ? 'výjimky' : 'výjimek'}
                      </span>
                    )}
                    <svg
                      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      style={{ color: 'var(--text-muted)', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s', flexShrink: 0 }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {/* Rozbalený detail */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--border)' }}>
                      <p className="text-xs mt-3 mb-2" style={{ color: 'var(--text-muted)' }}>
                        Výjimky modulů pro tohoto uživatele (mají přednost před výchozím tarifem):
                      </p>

                      {member.overrides.length === 0 ? (
                        <p className="text-xs italic mb-3" style={{ color: 'var(--text-muted)' }}>Žádné výjimky – platí výchozí tarif.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {member.overrides.map(o => {
                            const mod = ALL_MODULES.find(m => m.id === o.module_id);
                            const isInTariff = tariffMods.has(o.module_id);
                            return (
                              <div
                                key={o.id}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                                style={{
                                  background: o.enabled ? '#dcfce7' : '#fee2e2',
                                  color: o.enabled ? '#166534' : '#991b1b',
                                  border: `1px solid ${o.enabled ? '#bbf7d0' : '#fecaca'}`,
                                }}
                              >
                                <span>{o.enabled ? '✓' : '✕'}</span>
                                <span>{mod?.label ?? o.module_id}</span>
                                {!isInTariff && o.enabled && (
                                  <span className="opacity-60 text-[10px]">(nad tarif)</span>
                                )}
                                {isInTariff && !o.enabled && (
                                  <span className="opacity-60 text-[10px]">(zakázáno)</span>
                                )}
                                <button
                                  onClick={() => removeModuleOverride(o.id)}
                                  className="ml-1 opacity-60 hover:opacity-100 transition-opacity"
                                  title="Odebrat výjimku"
                                >
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                  </svg>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Přidat výjimku */}
                      {addModuleUserId === member.user_id ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <select
                            value={addModuleId}
                            onChange={e => setAddModuleId(e.target.value as ModuleId)}
                            className="px-2.5 py-1.5 rounded-lg border text-base sm:text-sm"
                            style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                          >
                            <option value="">— vyberte modul —</option>
                            {ALL_MODULES.filter(m => !member.overrides.some(o => o.module_id === m.id)).map(m => (
                              <option key={m.id} value={m.id}>{m.label}</option>
                            ))}
                          </select>
                          <select
                            value={addModuleEnabled ? '1' : '0'}
                            onChange={e => setAddModuleEnabled(e.target.value === '1')}
                            className="px-2.5 py-1.5 rounded-lg border text-base sm:text-sm"
                            style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                          >
                            <option value="1">Povolit (nad tarif)</option>
                            <option value="0">Zakázat (pod tarif)</option>
                          </select>
                          <button
                            onClick={() => addModuleOverride(member.user_id)}
                            disabled={!addModuleId}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50 transition-colors"
                            style={{ background: 'var(--primary)' }}
                          >
                            Přidat
                          </button>
                          <button
                            onClick={() => { setAddModuleUserId(null); setAddModuleId(''); }}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            Zrušit
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setAddModuleUserId(member.user_id); setAddModuleId(''); setAddModuleEnabled(true); }}
                          className="flex items-center gap-1.5 text-xs font-medium transition-colors"
                          style={{ color: 'var(--primary)' }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                          Přidat výjimku modulu
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

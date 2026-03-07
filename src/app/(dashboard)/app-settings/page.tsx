'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { WorkspaceProvider, useWorkspace } from '@/contexts/WorkspaceContext';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { ALL_MODULES, TARIFF_MODULES } from '@/lib/modules';
import type { ModuleId, Tariff, SystemNotification } from '@/types/database';

// ─── typy ────────────────────────────────────────────────────────────────────

type TariffMatrix = Record<Tariff, Record<ModuleId, boolean>>;
type ActiveTab = 'tariffs' | 'notifications';

const TARIFFS: { id: Tariff; label: string; color: string; desc: string }[] = [
  { id: 'free', label: 'Free',  color: '#6b7280', desc: 'Základní funkce zdarma' },
  { id: 'pro',  label: 'Pro',   color: '#2563eb', desc: 'Rozšířené funkce pro týmy' },
  { id: 'max',  label: 'Max',   color: '#7c3aed', desc: 'Plná sada funkcí + audit' },
];

const NOTIF_COLORS = [
  { hex: '#f59e0b', label: 'Oranžová' },
  { hex: '#3b82f6', label: 'Modrá' },
  { hex: '#10b981', label: 'Zelená' },
  { hex: '#ef4444', label: 'Červená' },
  { hex: '#8b5cf6', label: 'Fialová' },
  { hex: '#6b7280', label: 'Šedá' },
];

// Sestavit výchozí matici z hardcoded TARIFF_MODULES
function buildDefaultMatrix(): TariffMatrix {
  const matrix = {} as TariffMatrix;
  for (const t of TARIFFS) {
    matrix[t.id] = {} as Record<ModuleId, boolean>;
    for (const mod of ALL_MODULES) {
      matrix[t.id][mod.id] = (TARIFF_MODULES[t.id] ?? []).includes(mod.id);
    }
  }
  return matrix;
}

// Helpers pro datetime-local
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${day}T${h}:${mi}`;
}

function fromDatetimeLocal(val: string): string | null {
  if (!val) return null;
  return new Date(val).toISOString();
}

function formatDT(iso: string | null): string {
  if (!iso) return '–';
  return new Date(iso).toLocaleString('cs-CZ', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ─── prázdný formulář oznámení ────────────────────────────────────────────────

interface NotifForm {
  title: string;
  message: string;
  color: string;
  is_active: boolean;
  show_from: string;   // datetime-local string
  show_until: string;  // datetime-local string
}

const EMPTY_NOTIF: NotifForm = {
  title: '',
  message: '',
  color: '#f59e0b',
  is_active: false,
  show_from: '',
  show_until: '',
};

// ─── hlavní obsah ─────────────────────────────────────────────────────────────

function AppSettingsContent() {
  const { profile, loading: authLoading, user } = useAuth();
  const { refreshTariffConfig } = useWorkspace();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<ActiveTab>('tariffs');

  // ── Tarify ────────────────────────────────────────────────────────────────
  const [matrix, setMatrix] = useState<TariffMatrix>(buildDefaultMatrix());
  const [loadingMatrix, setLoadingMatrix] = useState(true);
  const [savingMatrix, setSavingMatrix] = useState(false);
  const [matrixMsg, setMatrixMsg] = useState('');
  const [hasDbConfig, setHasDbConfig] = useState(false);

  // ── Oznámení ──────────────────────────────────────────────────────────────
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [showNotifForm, setShowNotifForm] = useState(false);
  const [editingNotif, setEditingNotif] = useState<SystemNotification | null>(null);
  const [notifForm, setNotifForm] = useState<NotifForm>(EMPTY_NOTIF);
  const [savingNotif, setSavingNotif] = useState(false);
  const [notifError, setNotifError] = useState('');

  // Pouze Master Admin
  const isMasterAdmin = profile?.is_master_admin === true;

  // Redirect logika:
  // AuthContext volá setLoading(false) PŘED dokončením fetchProfile (setTimeout 0).
  // Proto nestačí čekat jen na authLoading – musíme čekat i na načtení profile.
  // Sekvence: authLoading=false, user=set, profile=null (fetch ještě běží)
  //   → pokud bychom redirectovali tady, Master Admin by byl přesměrován na /
  // Správná logika:
  //   1. Pokud se stále načítá auth → čekáme
  //   2. Pokud auth hotovo ale user je null → přesměrovat (nepřihlášen)
  //   3. Pokud user je set ale profile je null → profile se ještě načítá → čekáme
  //   4. Pokud profile načten a není MasterAdmin → přesměrovat
  useEffect(() => {
    if (authLoading) return;               // auth se ještě načítá
    if (!user) { router.replace('/'); return; } // nepřihlášen
    if (profile === null) return;          // profile se ještě načítá
    if (!isMasterAdmin) router.replace('/'); // načteno, ale není MA
  }, [authLoading, user, profile, isMasterAdmin, router]);

  // ── Fetch matice tarifů ──────────────────────────────────────────────────
  const fetchConfig = useCallback(async () => {
    setLoadingMatrix(true);
    try {
      const { data } = await supabase
        .from('trackino_tariff_config')
        .select('tariff, module_id, enabled');

      if (data && data.length > 0) {
        setHasDbConfig(true);
        const m = buildDefaultMatrix();
        for (const row of data as { tariff: Tariff; module_id: ModuleId; enabled: boolean }[]) {
          if (m[row.tariff] && row.module_id in m[row.tariff]) {
            m[row.tariff][row.module_id] = row.enabled;
          }
        }
        setMatrix(m);
      } else {
        setHasDbConfig(false);
        setMatrix(buildDefaultMatrix());
      }
    } catch {
      setMatrix(buildDefaultMatrix());
    }
    setLoadingMatrix(false);
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  // ── Fetch oznámení ───────────────────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    setLoadingNotifs(true);
    const { data } = await supabase
      .from('trackino_system_notifications')
      .select('*')
      .order('created_at', { ascending: false });
    setNotifications((data ?? []) as SystemNotification[]);
    setLoadingNotifs(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'notifications') fetchNotifications();
  }, [activeTab, fetchNotifications]);

  // ── Tarif actions ────────────────────────────────────────────────────────
  const toggleModule = (tariff: Tariff, moduleId: ModuleId) => {
    setMatrix(prev => ({
      ...prev,
      [tariff]: { ...prev[tariff], [moduleId]: !prev[tariff][moduleId] },
    }));
  };

  const saveMatrix = async () => {
    setSavingMatrix(true);
    setMatrixMsg('');
    try {
      await supabase.from('trackino_tariff_config').delete().neq('tariff', '__none__');
      const rows: { tariff: string; module_id: string; enabled: boolean }[] = [];
      for (const t of TARIFFS) {
        for (const mod of ALL_MODULES) {
          rows.push({ tariff: t.id, module_id: mod.id, enabled: matrix[t.id][mod.id] });
        }
      }
      const { error } = await supabase.from('trackino_tariff_config').insert(rows);
      if (error) {
        setMatrixMsg('Chyba při ukládání: ' + error.message);
      } else {
        setHasDbConfig(true);
        setMatrixMsg('Konfigurace tarifů uložena.');
        await refreshTariffConfig();
        setTimeout(() => setMatrixMsg(''), 3000);
      }
    } catch (err) {
      setMatrixMsg('Chyba: ' + String(err));
    }
    setSavingMatrix(false);
  };

  const resetToDefaults = async () => {
    if (!confirm('Resetovat konfiguraci na výchozí hodnoty? Tím se smažou všechny úpravy tarifů.')) return;
    await supabase.from('trackino_tariff_config').delete().neq('tariff', '__none__');
    setHasDbConfig(false);
    setMatrix(buildDefaultMatrix());
    await refreshTariffConfig();
    setMatrixMsg('Konfigurace resetována na výchozí hodnoty.');
    setTimeout(() => setMatrixMsg(''), 3000);
  };

  // ── Oznámení actions ─────────────────────────────────────────────────────
  const openNewNotif = () => {
    setEditingNotif(null);
    setNotifForm(EMPTY_NOTIF);
    setNotifError('');
    setShowNotifForm(true);
  };

  const openEditNotif = (n: SystemNotification) => {
    setEditingNotif(n);
    setNotifForm({
      title: n.title,
      message: n.message,
      color: n.color,
      is_active: n.is_active,
      show_from: toDatetimeLocal(n.show_from),
      show_until: toDatetimeLocal(n.show_until),
    });
    setNotifError('');
    setShowNotifForm(true);
  };

  const saveNotif = async () => {
    if (!notifForm.message.trim()) { setNotifError('Vyplňte text oznámení.'); return; }
    setSavingNotif(true);
    setNotifError('');
    const payload = {
      title: notifForm.title.trim(),
      message: notifForm.message.trim(),
      color: notifForm.color,
      is_active: notifForm.is_active,
      show_from: fromDatetimeLocal(notifForm.show_from),
      show_until: fromDatetimeLocal(notifForm.show_until),
      updated_at: new Date().toISOString(),
    };
    let error;
    if (editingNotif) {
      ({ error } = await supabase.from('trackino_system_notifications').update(payload).eq('id', editingNotif.id));
    } else {
      ({ error } = await supabase.from('trackino_system_notifications').insert(payload));
    }
    setSavingNotif(false);
    if (error) { setNotifError('Chyba: ' + error.message); return; }
    setShowNotifForm(false);
    fetchNotifications();
  };

  const deleteNotif = async (id: string) => {
    if (!confirm('Trvale smazat toto oznámení?')) return;
    await supabase.from('trackino_system_notifications').delete().eq('id', id);
    fetchNotifications();
  };

  const toggleNotifActive = async (n: SystemNotification) => {
    await supabase.from('trackino_system_notifications')
      .update({ is_active: !n.is_active, updated_at: new Date().toISOString() })
      .eq('id', n.id);
    setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_active: !n.is_active } : x));
  };

  if (!isMasterAdmin) return null;

  const inputStyle = { borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' };
  const inputCls = 'w-full px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]';
  const groups = ['Sledování', 'Analýza', 'Správa', 'Nástroje', 'Společnost'];

  return (
    <DashboardLayout>
      <div>
        {/* Záhlaví */}
        <div className="mb-5">
          <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Nastavení aplikace</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Konfigurace modulů, tarifů a systémových oznámení. Viditelné pouze pro Master Admin.
          </p>
        </div>

        {/* Záložky */}
        <div className="flex gap-1 p-1 rounded-xl mb-6 w-fit" style={{ background: 'var(--bg-hover)' }}>
          {([
            { key: 'tariffs' as ActiveTab, label: 'Nastavení tarifů', icon: (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
              </svg>
            )},
            { key: 'notifications' as ActiveTab, label: 'Systémová oznámení', icon: (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            )},
          ] as {key: ActiveTab; label: string; icon: React.ReactNode}[]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: activeTab === tab.key ? 'var(--bg-card)' : 'transparent',
                color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: activeTab === tab.key ? 'var(--shadow-sm)' : 'none',
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── TAB: Tarify ── */}
        {activeTab === 'tariffs' && (
          <>
            <div className="mb-5 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2 flex-shrink-0">
                {hasDbConfig && (
                  <button
                    onClick={resetToDefaults}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-colors border"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    Obnovit výchozí
                  </button>
                )}
                <button
                  onClick={saveMatrix}
                  disabled={savingMatrix}
                  className="px-5 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
                  style={{ background: 'var(--primary)' }}
                >
                  {savingMatrix ? 'Ukládám...' : 'Uložit konfiguraci'}
                </button>
              </div>
            </div>

            {matrixMsg && (
              <div className="mb-4 px-4 py-2.5 rounded-lg text-sm"
                style={{
                  background: matrixMsg.startsWith('Chyba') ? '#fee2e2' : '#dcfce7',
                  color: matrixMsg.startsWith('Chyba') ? '#dc2626' : '#166534',
                }}
              >
                {matrixMsg}
              </div>
            )}

            {loadingMatrix ? (
              <div className="py-16 text-center">
                <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : (
              <>
                <div className="flex gap-3 mb-5 flex-wrap">
                  {TARIFFS.map(t => (
                    <div key={t.id} className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border"
                      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: t.color }} />
                      <div>
                        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t.label}</span>
                        <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>{t.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: 'var(--border)' }}>
                  <div style={{ minWidth: 480 }}>
                  <div className="grid gap-0 border-b"
                    style={{ gridTemplateColumns: '1fr 100px 100px 100px', borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
                    <div className="px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Modul</div>
                    {TARIFFS.map(t => (
                      <div key={t.id} className="py-3 text-center text-xs font-bold uppercase tracking-wider" style={{ color: t.color }}>{t.label}</div>
                    ))}
                  </div>

                  {groups.map((group, gi) => {
                    const groupModules = ALL_MODULES.filter(m => m.group === group);
                    return (
                      <div key={group}>
                        <div className="px-5 py-2 border-b" style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)' }}>
                          <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{group}</span>
                        </div>
                        {groupModules.map(mod => (
                          <div key={mod.id} className="grid border-b last:border-b-0 transition-colors"
                            style={{ gridTemplateColumns: '1fr 100px 100px 100px', borderColor: 'var(--border)', background: 'var(--bg-card)' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}
                          >
                            <div className="px-5 py-3.5">
                              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{mod.label}</div>
                              <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{mod.description}</div>
                            </div>
                            {TARIFFS.map(t => (
                              <div key={t.id} className="flex items-center justify-center py-3.5">
                                <button
                                  onClick={() => toggleModule(t.id, mod.id)}
                                  className="w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all"
                                  style={{
                                    background: matrix[t.id][mod.id] ? t.color : 'transparent',
                                    borderColor: matrix[t.id][mod.id] ? t.color : 'var(--border)',
                                  }}
                                  title={matrix[t.id][mod.id] ? `Zakázat ${mod.label} v tarifu ${t.label}` : `Povolit ${mod.label} v tarifu ${t.label}`}
                                >
                                  {matrix[t.id][mod.id] && (
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                  )}
                                </button>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                  </div>{/* konec min-width wrapper */}
                </div>

                <p className="text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
                  💡 Změny se projeví pro nové přihlášení nebo obnovení stránky u ostatních uživatelů.
                  Individuální výjimky nastavené v Nastavení workspace → Moduly mají vždy přednost.
                </p>
              </>
            )}
          </>
        )}

        {/* ── TAB: Systémová oznámení ── */}
        {activeTab === 'notifications' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Bannery zobrazované všem přihlášeným uživatelům v horní části aplikace.
              </p>
              <button
                onClick={openNewNotif}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-medium flex-shrink-0"
                style={{ background: 'var(--primary)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--primary)'}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Přidat oznámení
              </button>
            </div>

            {loadingNotifs ? (
              <div className="py-12 text-center">
                <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-12 text-center rounded-2xl border" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }}>
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Žádná oznámení. Přidejte první.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map(n => {
                  const now = new Date();
                  const fromOk = !n.show_from || new Date(n.show_from) <= now;
                  const untilOk = !n.show_until || new Date(n.show_until) >= now;
                  const isVisible = n.is_active && fromOk && untilOk;
                  return (
                    <div key={n.id} className="rounded-xl border overflow-hidden"
                      style={{ borderColor: 'var(--border)', background: 'var(--bg-card)', borderLeft: `4px solid ${n.color}` }}>
                      {/* Preview banneru */}
                      <div className="px-4 py-2.5 flex items-start gap-2"
                        style={{ background: n.color + '18', borderBottom: `1px solid ${n.color}33` }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5" style={{ color: n.color }}>
                          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                        <div className="flex-1 min-w-0">
                          {n.title && <span className="font-semibold text-xs mr-1.5" style={{ color: n.color }}>{n.title}:</span>}
                          <span className="text-xs" style={{ color: 'var(--text-primary)' }}>{n.message}</span>
                        </div>
                      </div>
                      {/* Meta */}
                      <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3 flex-wrap text-xs" style={{ color: 'var(--text-muted)' }}>
                          {/* Status badge */}
                          <span className="px-2 py-0.5 rounded-full font-medium"
                            style={{
                              background: isVisible ? '#dcfce7' : n.is_active ? '#fef3c7' : '#f3f4f6',
                              color: isVisible ? '#166534' : n.is_active ? '#92400e' : '#6b7280',
                            }}>
                            {isVisible ? 'Zobrazuje se' : n.is_active ? 'Aktivní (mimo čas)' : 'Neaktivní'}
                          </span>
                          <span>Od: {formatDT(n.show_from)}</span>
                          <span>Do: {formatDT(n.show_until)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Toggle aktivity */}
                          <button
                            onClick={() => toggleNotifActive(n)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                            style={{
                              borderColor: n.is_active ? '#22c55e' : 'var(--border)',
                              color: n.is_active ? '#16a34a' : 'var(--text-muted)',
                              background: n.is_active ? '#dcfce7' : 'transparent',
                            }}
                            title={n.is_active ? 'Deaktivovat' : 'Aktivovat'}
                          >
                            {n.is_active ? (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                            ) : (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                            )}
                            {n.is_active ? 'Aktivní' : 'Neaktivní'}
                          </button>
                          <button
                            onClick={() => openEditNotif(n)}
                            className="px-2 py-1.5 rounded-lg text-xs border transition-colors"
                            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >Upravit</button>
                          <button
                            onClick={() => deleteNotif(n.id)}
                            className="px-2 py-1.5 rounded-lg text-xs border transition-colors"
                            style={{ borderColor: 'var(--border)', color: 'var(--danger, #ef4444)' }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                          >Smazat</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* SQL hint */}
            <p className="text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
              💡 Časy zobrazení jsou v lokálním čase prohlížeče. Banner se zobrazí všem přihlášeným uživatelům a lze ho křížkem skrýt (skrytí se pamatuje v prohlížeči).
            </p>
          </>
        )}
      </div>

      {/* ── Modal: Přidat / upravit oznámení ── */}
      {showNotifForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50"
          onClick={e => { if (e.target === e.currentTarget) setShowNotifForm(false); }}>
          <div className="w-full max-w-lg rounded-2xl border shadow-xl"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            {/* Hlavička */}
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                {editingNotif ? 'Upravit oznámení' : 'Nové oznámení'}
              </h2>
              <button onClick={() => setShowNotifForm(false)} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Nadpis */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Nadpis (volitelný)</label>
                <input type="text" value={notifForm.title} onChange={e => setNotifForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Plánovaná údržba" className={inputCls} style={inputStyle} />
              </div>

              {/* Zpráva */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Text oznámení *</label>
                <textarea value={notifForm.message} onChange={e => setNotifForm(f => ({ ...f, message: e.target.value }))}
                  rows={3} placeholder="Aplikace bude dnes ve 22:00 nedostupná kvůli aktualizaci."
                  className={inputCls + ' resize-none'} style={inputStyle} />
              </div>

              {/* Barva */}
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Barva banneru</label>
                <div className="flex gap-2 flex-wrap">
                  {NOTIF_COLORS.map(c => (
                    <button key={c.hex} onClick={() => setNotifForm(f => ({ ...f, color: c.hex }))}
                      className="w-7 h-7 rounded-full transition-all hover:scale-110"
                      style={{ background: c.hex, outline: notifForm.color === c.hex ? '2px solid #000' : 'none', outlineOffset: '2px' }}
                      title={c.label} />
                  ))}
                </div>
              </div>

              {/* Datum od / do */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Zobrazit od</label>
                  <input type="datetime-local" value={notifForm.show_from}
                    onChange={e => setNotifForm(f => ({ ...f, show_from: e.target.value }))}
                    className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Zobrazit do</label>
                  <input type="datetime-local" value={notifForm.show_until}
                    onChange={e => setNotifForm(f => ({ ...f, show_until: e.target.value }))}
                    className={inputCls} style={inputStyle} />
                </div>
              </div>

              {/* Aktivní toggle */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setNotifForm(f => ({ ...f, is_active: !f.is_active }))}
                  className="relative w-10 h-5 rounded-full transition-colors flex-shrink-0"
                  style={{ background: notifForm.is_active ? 'var(--primary)' : 'var(--border)' }}
                >
                  <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-sm"
                    style={{ left: notifForm.is_active ? '22px' : '2px' }} />
                </button>
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  {notifForm.is_active ? 'Aktivní (zobrazuje se)' : 'Neaktivní (skryté)'}
                </span>
              </div>

              {/* Preview */}
              {notifForm.message.trim() && (
                <div className="rounded-lg px-3 py-2.5 flex items-center gap-2"
                  style={{ background: notifForm.color + '18', border: `1px solid ${notifForm.color}33` }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0" style={{ color: notifForm.color }}>
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <div>
                    {notifForm.title && <span className="font-semibold text-xs mr-1" style={{ color: notifForm.color }}>{notifForm.title}:</span>}
                    <span className="text-xs" style={{ color: 'var(--text-primary)' }}>{notifForm.message}</span>
                  </div>
                </div>
              )}

              {notifError && <p className="text-sm" style={{ color: 'var(--danger, #ef4444)' }}>{notifError}</p>}
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <button onClick={() => setShowNotifForm(false)}
                className="px-4 py-2 rounded-lg border text-sm"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                Zrušit
              </button>
              <button onClick={saveNotif} disabled={savingNotif}
                className="px-5 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
                style={{ background: 'var(--primary)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--primary)'}>
                {savingNotif ? 'Ukládám…' : editingNotif ? 'Uložit změny' : 'Přidat'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

// ─── wrapper ──────────────────────────────────────────────────────────────────

function AppSettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  if (loading || !user) return null;

  return (
    <WorkspaceProvider>
      <AppSettingsContent />
    </WorkspaceProvider>
  );
}

export default AppSettingsPage;

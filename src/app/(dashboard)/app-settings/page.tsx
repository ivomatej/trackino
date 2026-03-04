'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { WorkspaceProvider, useWorkspace } from '@/contexts/WorkspaceContext';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { ALL_MODULES, TARIFF_MODULES } from '@/lib/modules';
import type { ModuleId, Tariff } from '@/types/database';

// ─── typy ────────────────────────────────────────────────────────────────────

type TariffMatrix = Record<Tariff, Record<ModuleId, boolean>>;

const TARIFFS: { id: Tariff; label: string; color: string; desc: string }[] = [
  { id: 'free', label: 'Free',  color: '#6b7280', desc: 'Základní funkce zdarma' },
  { id: 'pro',  label: 'Pro',   color: '#2563eb', desc: 'Rozšířené funkce pro týmy' },
  { id: 'max',  label: 'Max',   color: '#7c3aed', desc: 'Plná sada funkcí + audit' },
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

// ─── hlavní obsah ─────────────────────────────────────────────────────────────

function AppSettingsContent() {
  const { profile } = useAuth();
  const { refreshTariffConfig } = useWorkspace();
  const router = useRouter();

  const [matrix, setMatrix] = useState<TariffMatrix>(buildDefaultMatrix());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [hasDbConfig, setHasDbConfig] = useState(false);

  // Pouze Master Admin
  const isMasterAdmin = profile?.is_master_admin === true;

  useEffect(() => {
    if (profile !== undefined && !isMasterAdmin) {
      router.replace('/');
    }
  }, [profile, isMasterAdmin, router]);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('trackino_tariff_config')
        .select('tariff, module_id, enabled');

      if (data && data.length > 0) {
        setHasDbConfig(true);
        // Začni z defaults a aplikuj DB config
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
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const toggleModule = (tariff: Tariff, moduleId: ModuleId) => {
    setMatrix(prev => ({
      ...prev,
      [tariff]: {
        ...prev[tariff],
        [moduleId]: !prev[tariff][moduleId],
      },
    }));
  };

  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      // Smaž všechny záznamy a vlož nové
      await supabase.from('trackino_tariff_config').delete().neq('tariff', '__none__');

      const rows: { tariff: string; module_id: string; enabled: boolean }[] = [];
      for (const t of TARIFFS) {
        for (const mod of ALL_MODULES) {
          rows.push({ tariff: t.id, module_id: mod.id, enabled: matrix[t.id][mod.id] });
        }
      }
      const { error } = await supabase.from('trackino_tariff_config').insert(rows);
      if (error) {
        setMessage('Chyba při ukládání: ' + error.message);
      } else {
        setHasDbConfig(true);
        setMessage('Konfigurace tarifů uložena.');
        await refreshTariffConfig();
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setMessage('Chyba: ' + String(err));
    }
    setSaving(false);
  };

  const resetToDefaults = async () => {
    if (!confirm('Resetovat konfiguraci na výchozí hodnoty? Tím se smažou všechny úpravy tarifů.')) return;
    await supabase.from('trackino_tariff_config').delete().neq('tariff', '__none__');
    setHasDbConfig(false);
    setMatrix(buildDefaultMatrix());
    await refreshTariffConfig();
    setMessage('Konfigurace resetována na výchozí hodnoty.');
    setTimeout(() => setMessage(''), 3000);
  };

  if (!isMasterAdmin) return null;

  const groups = ['Sledování', 'Analýza', 'Správa', 'Nástroje'];

  return (
    <DashboardLayout>
      <div>
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Nastavení aplikace</h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Konfigurace modulů dle tarifu. Viditelné pouze pro Master Admin.
            </p>
          </div>
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
              onClick={save}
              disabled={saving}
              className="px-5 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50 transition-colors"
              style={{ background: 'var(--primary)' }}
            >
              {saving ? 'Ukládám...' : 'Uložit konfiguraci'}
            </button>
          </div>
        </div>

        {/* Zpráva */}
        {message && (
          <div
            className="mb-4 px-4 py-2.5 rounded-lg text-sm"
            style={{
              background: message.startsWith('Chyba') ? 'var(--danger-light, #fee2e2)' : '#dcfce7',
              color: message.startsWith('Chyba') ? 'var(--danger, #dc2626)' : '#166534',
            }}
          >
            {message}
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center">
            <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : (
          <>
            {/* Legenda tarifů */}
            <div className="flex gap-3 mb-5 flex-wrap">
              {TARIFFS.map(t => (
                <div
                  key={t.id}
                  className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
                >
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: t.color }} />
                  <div>
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t.label}</span>
                    <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>{t.desc}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Matice modulů */}
            <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
              {/* Záhlaví */}
              <div
                className="grid gap-0 border-b"
                style={{
                  gridTemplateColumns: '1fr 100px 100px 100px',
                  borderColor: 'var(--border)',
                  background: 'var(--bg-hover)',
                }}
              >
                <div className="px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Modul
                </div>
                {TARIFFS.map(t => (
                  <div
                    key={t.id}
                    className="py-3 text-center text-xs font-bold uppercase tracking-wider"
                    style={{ color: t.color }}
                  >
                    {t.label}
                  </div>
                ))}
              </div>

              {/* Skupiny modulů */}
              {groups.map((group, gi) => {
                const groupModules = ALL_MODULES.filter(m => m.group === group);
                return (
                  <div key={group}>
                    {/* Záhlaví skupiny */}
                    <div
                      className="px-5 py-2 border-b"
                      style={{
                        background: 'var(--bg-hover)',
                        borderColor: 'var(--border)',
                        marginTop: gi > 0 ? 0 : 0,
                      }}
                    >
                      <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                        {group}
                      </span>
                    </div>

                    {/* Moduly ve skupině */}
                    {groupModules.map((mod, idx) => (
                      <div
                        key={mod.id}
                        className="grid border-b last:border-b-0 transition-colors"
                        style={{
                          gridTemplateColumns: '1fr 100px 100px 100px',
                          borderColor: 'var(--border)',
                          background: 'var(--bg-card)',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}
                      >
                        {/* Název modulu */}
                        <div className="px-5 py-3.5">
                          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{mod.label}</div>
                          <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{mod.description}</div>
                        </div>

                        {/* Checkboxy pro každý tarif */}
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
            </div>

            {/* Poznámka */}
            <p className="text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
              💡 Změny se projeví pro nové přihlášení nebo obnovení stránky u ostatních uživatelů.
              Individuální výjimky nastavené v Nastavení workspace → Moduly mají vždy přednost.
            </p>
          </>
        )}
      </div>
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

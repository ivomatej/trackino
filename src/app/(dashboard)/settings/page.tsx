'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { WorkspaceProvider, useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import DashboardLayout from '@/components/DashboardLayout';
import WorkspaceSelector from '@/components/WorkspaceSelector';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import type { WorkspaceBilling, RequiredFields, Tariff } from '@/types/database';

function SettingsContent() {
  const { currentWorkspace, loading, refreshWorkspace } = useWorkspace();
  const { canAccessSettings, isMasterAdmin } = usePermissions();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'general' | 'billing' | 'fields'>('general');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Workspace fields
  const [wsName, setWsName] = useState('');
  const [tariff, setTariff] = useState<Tariff>('free');
  const [weekStart, setWeekStart] = useState(1);
  const [dateFormat, setDateFormat] = useState('dd.MM.yyyy');
  const [numberFormat, setNumberFormat] = useState('cs');
  const [currency, setCurrency] = useState('CZK');

  // Required fields
  const [requiredFields, setRequiredFields] = useState<RequiredFields>({
    project: false, category: false, task: false, description: false, tag: false,
  });

  // Globální viditelnost štítků
  const [hideTagsGlobally, setHideTagsGlobally] = useState(false);

  // Billing
  const [billing, setBilling] = useState<Partial<WorkspaceBilling>>({});

  useEffect(() => {
    if (currentWorkspace) {
      setWsName(currentWorkspace.name);
      setTariff(currentWorkspace.tariff);
      setWeekStart(currentWorkspace.week_start_day);
      setDateFormat(currentWorkspace.date_format);
      setNumberFormat(currentWorkspace.number_format);
      setCurrency(currentWorkspace.currency);
      setRequiredFields(currentWorkspace.required_fields);
      setHideTagsGlobally(currentWorkspace.hide_tags_globally ?? false);
      fetchBilling(currentWorkspace.id);
    }
  }, [currentWorkspace]);

  async function fetchBilling(workspaceId: string) {
    const { data } = await supabase
      .from('trackino_workspace_billing')
      .select('*')
      .eq('workspace_id', workspaceId)
      .single();

    if (data) {
      setBilling(data as WorkspaceBilling);
    }
  }

  async function saveGeneral() {
    if (!currentWorkspace) return;
    setSaving(true);
    setMessage('');

    const updates: Record<string, unknown> = {
      tariff,
      week_start_day: weekStart,
      date_format: dateFormat,
      number_format: numberFormat,
      currency,
      hide_tags_globally: hideTagsGlobally,
    };

    // Jméno workspace může měnit jen Master Admin
    if (isMasterAdmin) {
      updates.name = wsName;
    }

    const { error } = await supabase
      .from('trackino_workspaces')
      .update(updates)
      .eq('id', currentWorkspace.id);

    setSaving(false);
    if (error) {
      setMessage('Chyba při ukládání: ' + error.message);
    } else {
      setMessage('Nastavení uloženo.');
      await refreshWorkspace();
      setTimeout(() => setMessage(''), 3000);
    }
  }

  async function saveBilling() {
    if (!currentWorkspace) return;
    setSaving(true);
    setMessage('');

    const { error } = await supabase
      .from('trackino_workspace_billing')
      .upsert({
        workspace_id: currentWorkspace.id,
        company_name: billing.company_name ?? '',
        representative_name: billing.representative_name ?? '',
        address: billing.address ?? '',
        postal_code: billing.postal_code ?? '',
        ico: billing.ico ?? '',
        dic: billing.dic ?? '',
        email: billing.email ?? '',
        phone: billing.phone ?? '',
        billing_note: billing.billing_note ?? '',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'workspace_id' });

    setSaving(false);
    if (error) {
      setMessage('Chyba při ukládání: ' + error.message);
    } else {
      setMessage('Fakturační údaje uloženy.');
      setTimeout(() => setMessage(''), 3000);
    }
  }

  async function saveRequiredFields() {
    if (!currentWorkspace) return;
    setSaving(true);
    setMessage('');

    const { error } = await supabase
      .from('trackino_workspaces')
      .update({ required_fields: requiredFields })
      .eq('id', currentWorkspace.id);

    setSaving(false);
    if (error) {
      setMessage('Chyba při ukládání: ' + error.message);
    } else {
      setMessage('Povinná pole uložena.');
      await refreshWorkspace();
      setTimeout(() => setMessage(''), 3000);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-main)' }}>
        <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentWorkspace) return <WorkspaceSelector />;

  if (!canAccessSettings) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl">
          <h1 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Nastavení</h1>
          <p style={{ color: 'var(--text-muted)' }}>Nemáte oprávnění k nastavení workspace.</p>
        </div>
      </DashboardLayout>
    );
  }

  const tabs = [
    { id: 'general' as const, label: 'Obecné' },
    { id: 'billing' as const, label: 'Fakturační údaje' },
    { id: 'fields' as const, label: 'Povinná pole' },
  ];

  const inputCls = "w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent";
  const selectCls = "w-full px-3 py-2 pr-8 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent appearance-none cursor-pointer";
  const inputStyle = { borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' };
  const labelCls = "block text-xs font-medium mb-1";

  // Select wrapper SVG arrow
  const SelectWrap = ({ children }: { children: React.ReactNode }) => (
    <div className="relative">
      {children}
      <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text-muted)' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="max-w-2xl">
        <h1 className="text-xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>Nastavení workspace</h1>

        {/* Taby */}
        <div className="flex gap-1 mb-6 p-1 rounded-lg" style={{ background: 'var(--bg-hover)' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setMessage(''); }}
              className="px-4 py-2 rounded-md text-sm font-medium transition-colors flex-1"
              style={{
                background: activeTab === tab.id ? 'var(--bg-card)' : 'transparent',
                color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: activeTab === tab.id ? 'var(--shadow-sm)' : 'none',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Zpráva */}
        {message && (
          <div
            className="mb-4 px-4 py-2 rounded-lg text-sm"
            style={{
              background: message.startsWith('Chyba') ? 'var(--danger-light)' : 'var(--success-light)',
              color: message.startsWith('Chyba') ? 'var(--danger)' : 'var(--success)',
            }}
          >
            {message}
          </div>
        )}

        {/* TAB: Obecné */}
        {activeTab === 'general' && (
          <div className="space-y-5">
            <div className="p-5 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Obecné nastavení</h2>

              <div className="space-y-4">
                {/* Název workspace */}
                <div>
                  <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>
                    Název workspace {!isMasterAdmin && <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>(jen Master Admin)</span>}
                  </label>
                  <input
                    type="text"
                    value={wsName}
                    onChange={(e) => setWsName(e.target.value)}
                    disabled={!isMasterAdmin}
                    className={inputCls + ' disabled:opacity-50'}
                    style={inputStyle}
                  />
                </div>

                {/* Tarif */}
                <div>
                  <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Tarif</label>
                  <SelectWrap>
                    <select value={tariff} onChange={(e) => setTariff(e.target.value as Tariff)} className={selectCls} style={inputStyle}>
                      <option value="free">Free</option>
                      <option value="pro">Pro</option>
                      <option value="max">Max</option>
                    </select>
                  </SelectWrap>
                </div>

                {/* Začátek týdne */}
                <div>
                  <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Začátek týdne</label>
                  <SelectWrap>
                    <select value={weekStart} onChange={(e) => setWeekStart(Number(e.target.value))} className={selectCls} style={inputStyle}>
                      <option value={1}>Pondělí</option>
                      <option value={0}>Neděle</option>
                      <option value={6}>Sobota</option>
                    </select>
                  </SelectWrap>
                </div>

                {/* Formát data */}
                <div>
                  <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Formát data</label>
                  <SelectWrap>
                    <select value={dateFormat} onChange={(e) => setDateFormat(e.target.value)} className={selectCls} style={inputStyle}>
                      <option value="dd.MM.yyyy">dd.MM.yyyy (31.12.2025)</option>
                      <option value="MM/dd/yyyy">MM/dd/yyyy (12/31/2025)</option>
                      <option value="yyyy-MM-dd">yyyy-MM-dd (2025-12-31)</option>
                    </select>
                  </SelectWrap>
                </div>

                {/* Formát čísel */}
                <div>
                  <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Formát čísel</label>
                  <SelectWrap>
                    <select value={numberFormat} onChange={(e) => setNumberFormat(e.target.value)} className={selectCls} style={inputStyle}>
                      <option value="cs">1 234,56 (český)</option>
                      <option value="en">1,234.56 (anglický)</option>
                    </select>
                  </SelectWrap>
                </div>

                {/* Měna */}
                <div>
                  <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Měna</label>
                  <SelectWrap>
                    <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={selectCls} style={inputStyle}>
                      <option value="CZK">CZK (Kč)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="USD">USD ($)</option>
                    </select>
                  </SelectWrap>
                </div>

                {/* Globální skrytí štítků */}
                <label
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors"
                  style={{ background: hideTagsGlobally ? 'var(--bg-active)' : 'transparent' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = hideTagsGlobally ? 'var(--bg-active)' : 'transparent'}
                >
                  <input
                    type="checkbox"
                    checked={hideTagsGlobally}
                    onChange={(e) => setHideTagsGlobally(e.target.checked)}
                    className="w-4 h-4 rounded"
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <div>
                    <span className="text-sm block" style={{ color: 'var(--text-primary)' }}>Skrýt štítky pro všechny</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>TagPicker se nebude zobrazovat v Time Trackeru</span>
                  </div>
                </label>
              </div>

              <button
                onClick={saveGeneral}
                disabled={saving}
                className="mt-5 px-5 py-2 rounded-lg text-white font-medium text-sm transition-colors disabled:opacity-50"
                style={{ background: 'var(--primary)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--primary-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--primary)'}
              >
                {saving ? 'Ukládám...' : 'Uložit'}
              </button>
            </div>
          </div>
        )}

        {/* TAB: Fakturační údaje */}
        {activeTab === 'billing' && (
          <div className="p-5 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Fakturační údaje</h2>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Název firmy</label>
                  <input type="text" value={billing.company_name ?? ''} onChange={(e) => setBilling(p => ({ ...p, company_name: e.target.value }))} className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Jméno jednatele</label>
                  <input type="text" value={billing.representative_name ?? ''} onChange={(e) => setBilling(p => ({ ...p, representative_name: e.target.value }))} className={inputCls} style={inputStyle} />
                </div>
              </div>

              <div>
                <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Adresa</label>
                <input type="text" value={billing.address ?? ''} onChange={(e) => setBilling(p => ({ ...p, address: e.target.value }))} className={inputCls} style={inputStyle} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>PSČ</label>
                  <input type="text" value={billing.postal_code ?? ''} onChange={(e) => setBilling(p => ({ ...p, postal_code: e.target.value }))} className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>IČ</label>
                  <input type="text" value={billing.ico ?? ''} onChange={(e) => setBilling(p => ({ ...p, ico: e.target.value }))} className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>DIČ</label>
                  <input type="text" value={billing.dic ?? ''} onChange={(e) => setBilling(p => ({ ...p, dic: e.target.value }))} className={inputCls} style={inputStyle} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>E-mail</label>
                  <input type="email" value={billing.email ?? ''} onChange={(e) => setBilling(p => ({ ...p, email: e.target.value }))} className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Telefon</label>
                  <input type="tel" value={billing.phone ?? ''} onChange={(e) => setBilling(p => ({ ...p, phone: e.target.value }))} className={inputCls} style={inputStyle} />
                </div>
              </div>

              <div>
                <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Poznámka k fakturaci</label>
                <textarea
                  value={billing.billing_note ?? ''}
                  onChange={(e) => setBilling(p => ({ ...p, billing_note: e.target.value }))}
                  rows={3}
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
            </div>

            <button
              onClick={saveBilling}
              disabled={saving}
              className="mt-5 px-5 py-2 rounded-lg text-white font-medium text-sm transition-colors disabled:opacity-50"
              style={{ background: 'var(--primary)' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--primary-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--primary)'}
            >
              {saving ? 'Ukládám...' : 'Uložit'}
            </button>
          </div>
        )}

        {/* TAB: Povinná pole */}
        {activeTab === 'fields' && (
          <div className="p-5 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Povinná pole pro trackování</h2>
            <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>
              Zvolte, které položky musí uživatel vyplnit, aby mohl spustit timer nebo uložit manuální záznam.
            </p>

            <div className="space-y-3">
              {[
                { key: 'project' as const, label: 'Projekt' },
                { key: 'category' as const, label: 'Kategorie' },
                { key: 'task' as const, label: 'Úkol' },
                { key: 'description' as const, label: 'Popisek' },
                { key: 'tag' as const, label: 'Štítek' },
              ].map(field => (
                <label
                  key={field.key}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors"
                  style={{ background: requiredFields[field.key] ? 'var(--bg-active)' : 'transparent' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = requiredFields[field.key] ? 'var(--bg-active)' : 'transparent'}
                >
                  <input
                    type="checkbox"
                    checked={requiredFields[field.key]}
                    onChange={(e) => setRequiredFields(prev => ({ ...prev, [field.key]: e.target.checked }))}
                    className="w-4 h-4 rounded"
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{field.label}</span>
                </label>
              ))}
            </div>

            <button
              onClick={saveRequiredFields}
              disabled={saving}
              className="mt-5 px-5 py-2 rounded-lg text-white font-medium text-sm transition-colors disabled:opacity-50"
              style={{ background: 'var(--primary)' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--primary-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--primary)'}
            >
              {saving ? 'Ukládám...' : 'Uložit'}
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  if (authLoading || !user) return null;

  return (
    <WorkspaceProvider>
      <SettingsContent />
    </WorkspaceProvider>
  );
}

export default SettingsPage;

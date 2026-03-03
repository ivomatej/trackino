'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { WorkspaceProvider, useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import DashboardLayout from '@/components/DashboardLayout';
import WorkspaceSelector from '@/components/WorkspaceSelector';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import type { WorkspaceBilling, RequiredFields, Tariff, VacationAllowance, CooperationType } from '@/types/database';

function SettingsContent() {
  const { currentWorkspace, loading, refreshWorkspace } = useWorkspace();
  const { canAccessSettings, isMasterAdmin } = usePermissions();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'general' | 'billing' | 'fields' | 'vacation' | 'cooperation'>('general');
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

  // Billing profiles
  const [billingProfiles, setBillingProfiles] = useState<WorkspaceBilling[]>([]);
  const [editingBillingProfile, setEditingBillingProfile] = useState<Partial<WorkspaceBilling> | null>(null);
  const [billingProfileSaving, setBillingProfileSaving] = useState(false);

  // Vacation allowances
  const [vacationAllowances, setVacationAllowances] = useState<VacationAllowance[]>([]);
  const [vacLoading, setVacLoading] = useState(false);
  const [newVacYear, setNewVacYear] = useState('');
  const [newVacDays, setNewVacDays] = useState('');
  const [addingVac, setAddingVac] = useState(false);

  // Cooperation types
  const [cooperationTypes, setCooperationTypes] = useState<CooperationType[]>([]);
  const [coopLoading, setCoopLoading] = useState(false);
  const [newCoopName, setNewCoopName] = useState('');
  const [addingCoop, setAddingCoop] = useState(false);

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
      fetchBillingProfiles(currentWorkspace.id);
      fetchVacationAllowances(currentWorkspace.id);
      fetchCooperationTypes(currentWorkspace.id);
    }
  }, [currentWorkspace]);

  async function fetchVacationAllowances(workspaceId: string) {
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
    if (!currentWorkspace || !newVacYear || !newVacDays) return;
    const year = parseInt(newVacYear);
    const days = parseInt(newVacDays);
    if (isNaN(year) || isNaN(days) || days < 0) return;
    setAddingVac(true);
    const { error } = await supabase
      .from('trackino_vacation_allowances')
      .upsert({ workspace_id: currentWorkspace.id, year, days_per_year: days }, { onConflict: 'workspace_id,year' });
    if (!error) {
      setNewVacYear('');
      setNewVacDays('');
      fetchVacationAllowances(currentWorkspace.id);
    }
    setAddingVac(false);
  }

  async function deleteVacationAllowance(id: string) {
    if (!confirm('Smazat tento rok dovolené?')) return;
    await supabase.from('trackino_vacation_allowances').delete().eq('id', id);
    setVacationAllowances(prev => prev.filter(v => v.id !== id));
  }

  async function fetchCooperationTypes(workspaceId: string) {
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
    if (!currentWorkspace || !newCoopName.trim()) return;
    setAddingCoop(true);
    const maxOrder = cooperationTypes.length > 0 ? Math.max(...cooperationTypes.map(c => c.sort_order)) : -1;
    await supabase.from('trackino_cooperation_types').insert({
      workspace_id: currentWorkspace.id,
      name: newCoopName.trim(),
      sort_order: maxOrder + 1,
    });
    setNewCoopName('');
    fetchCooperationTypes(currentWorkspace.id);
    setAddingCoop(false);
  }

  async function deleteCooperationType(id: string, name: string) {
    if (!confirm(`Smazat typ spolupráce "${name}"? Uživatelé s tímto typem ztratí přiřazení.`)) return;
    await supabase.from('trackino_cooperation_types').delete().eq('id', id);
    setCooperationTypes(prev => prev.filter(c => c.id !== id));
  }

  async function fetchBillingProfiles(workspaceId: string) {
    const { data } = await supabase
      .from('trackino_workspace_billing')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('is_default', { ascending: false });
    setBillingProfiles((data ?? []) as WorkspaceBilling[]);
  }

  async function saveBillingProfile() {
    if (!currentWorkspace || !editingBillingProfile) return;
    setBillingProfileSaving(true);
    const profileData = {
      workspace_id: currentWorkspace.id,
      name: editingBillingProfile.name?.trim() || 'Fakturační profil',
      company_name: editingBillingProfile.company_name ?? '',
      representative_name: editingBillingProfile.representative_name ?? '',
      address: editingBillingProfile.address ?? '',
      postal_code: editingBillingProfile.postal_code ?? '',
      ico: editingBillingProfile.ico ?? '',
      dic: editingBillingProfile.dic ?? '',
      is_vat_payer: editingBillingProfile.is_vat_payer ?? false,
      email: editingBillingProfile.email ?? '',
      phone: editingBillingProfile.phone ?? '',
      billing_note: editingBillingProfile.billing_note ?? '',
      is_default: editingBillingProfile.is_default ?? false,
      updated_at: new Date().toISOString(),
    };
    let error;
    if (editingBillingProfile.id) {
      ({ error } = await supabase.from('trackino_workspace_billing').update(profileData).eq('id', editingBillingProfile.id));
    } else {
      ({ error } = await supabase.from('trackino_workspace_billing').insert(profileData));
    }
    setBillingProfileSaving(false);
    if (!error) {
      setEditingBillingProfile(null);
      fetchBillingProfiles(currentWorkspace.id);
      setMessage('Fakturační profil uložen.');
      setTimeout(() => setMessage(''), 3000);
    } else {
      setMessage('Chyba: ' + error.message);
    }
  }

  async function deleteBillingProfile(id: string) {
    if (!currentWorkspace) return;
    if (!confirm('Smazat tento fakturační profil? Členové s tímto profilem ztratí přiřazení.')) return;
    await supabase.from('trackino_workspace_billing').delete().eq('id', id);
    fetchBillingProfiles(currentWorkspace.id);
  }

  async function setProfileAsDefault(id: string) {
    if (!currentWorkspace) return;
    await supabase.from('trackino_workspace_billing').update({ is_default: false }).eq('workspace_id', currentWorkspace.id);
    await supabase.from('trackino_workspace_billing').update({ is_default: true }).eq('id', id);
    fetchBillingProfiles(currentWorkspace.id);
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
    { id: 'billing' as const, label: 'Fakturace' },
    { id: 'fields' as const, label: 'Povinná pole' },
    { id: 'vacation' as const, label: 'Dovolená' },
    { id: 'cooperation' as const, label: 'Spolupráce' },
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

        {/* TAB: Fakturační profily */}
        {activeTab === 'billing' && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Fakturační profily</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Vytvořte jeden nebo více profilů a přiřaďte je členům týmu v sekci Tým.
                </p>
              </div>
              <button
                onClick={() => setEditingBillingProfile({ is_default: billingProfiles.length === 0 })}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white"
                style={{ background: 'var(--primary)' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Přidat profil
              </button>
            </div>

            {billingProfiles.length === 0 ? (
              <div className="p-8 rounded-xl border text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }}>
                  <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
                </svg>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Zatím žádné fakturační profily. Přidejte první profil.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {billingProfiles.map(profile => (
                  <div key={profile.id} className="p-4 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{profile.name}</span>
                          {profile.is_default && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: '#dbeafe', color: '#1e40af' }}>Výchozí</span>
                          )}
                        </div>
                        {profile.company_name && (
                          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            {profile.company_name}
                            {profile.ico ? ` · IČ: ${profile.ico}` : ''}
                            {profile.dic ? ` · DIČ: ${profile.dic}` : ''}
                          </p>
                        )}
                        {(profile.address || profile.postal_code) && (
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {[profile.postal_code, profile.address].filter(Boolean).join(' ')}
                          </p>
                        )}
                        {(profile.email || profile.phone) && (
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {[profile.email, profile.phone].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {!profile.is_default && (
                          <button
                            onClick={() => setProfileAsDefault(profile.id)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                            style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-active)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                          >
                            Nastavit jako výchozí
                          </button>
                        )}
                        <button
                          onClick={() => setEditingBillingProfile(profile)}
                          title="Upravit"
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => deleteBillingProfile(profile.id)}
                          title="Smazat"
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6M14 11v6M9 6V4h6v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ═══ MODAL: Upravit / Přidat fakturační profil ═══ */}
            {editingBillingProfile !== null && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setEditingBillingProfile(null)} />
                <div className="relative w-full max-w-lg rounded-2xl shadow-2xl z-10 flex flex-col" style={{ maxHeight: '90vh', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0">
                    <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {editingBillingProfile.id ? 'Upravit profil' : 'Nový fakturační profil'}
                    </h3>
                    <button onClick={() => setEditingBillingProfile(null)} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-4">
                    <div>
                      <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Název profilu *</label>
                      <input type="text" value={editingBillingProfile.name ?? ''} onChange={(e) => setEditingBillingProfile(p => ({ ...p, name: e.target.value }))} placeholder="např. Hlavní s.r.o., Pobočka Praha…" className={inputCls} style={inputStyle} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Název firmy</label>
                        <input type="text" value={editingBillingProfile.company_name ?? ''} onChange={(e) => setEditingBillingProfile(p => ({ ...p, company_name: e.target.value }))} className={inputCls} style={inputStyle} />
                      </div>
                      <div>
                        <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Jméno jednatele</label>
                        <input type="text" value={editingBillingProfile.representative_name ?? ''} onChange={(e) => setEditingBillingProfile(p => ({ ...p, representative_name: e.target.value }))} className={inputCls} style={inputStyle} />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Adresa</label>
                      <input type="text" value={editingBillingProfile.address ?? ''} onChange={(e) => setEditingBillingProfile(p => ({ ...p, address: e.target.value }))} className={inputCls} style={inputStyle} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>PSČ</label>
                        <input type="text" value={editingBillingProfile.postal_code ?? ''} onChange={(e) => setEditingBillingProfile(p => ({ ...p, postal_code: e.target.value }))} className={inputCls} style={inputStyle} />
                      </div>
                      <div>
                        <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>IČ</label>
                        <input type="text" value={editingBillingProfile.ico ?? ''} onChange={(e) => setEditingBillingProfile(p => ({ ...p, ico: e.target.value }))} className={inputCls} style={inputStyle} />
                      </div>
                      <div>
                        <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>DIČ</label>
                        <input type="text" value={editingBillingProfile.dic ?? ''} onChange={(e) => setEditingBillingProfile(p => ({ ...p, dic: e.target.value }))} className={inputCls} style={inputStyle} />
                      </div>
                    </div>
                    {/* Plátce DPH */}
                    <label
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer"
                      style={{ background: editingBillingProfile.is_vat_payer ? 'var(--bg-active)' : 'var(--bg-hover)' }}
                    >
                      <input
                        type="checkbox"
                        checked={editingBillingProfile.is_vat_payer ?? false}
                        onChange={(e) => setEditingBillingProfile(p => ({ ...p, is_vat_payer: e.target.checked }))}
                        className="w-4 h-4 rounded"
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      <div>
                        <span className="text-sm block" style={{ color: 'var(--text-primary)' }}>Jsme plátci DPH</span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Tato firma je plátcem DPH</span>
                      </div>
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>E-mail</label>
                        <input type="email" value={editingBillingProfile.email ?? ''} onChange={(e) => setEditingBillingProfile(p => ({ ...p, email: e.target.value }))} className={inputCls} style={inputStyle} />
                      </div>
                      <div>
                        <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Telefon</label>
                        <input type="tel" value={editingBillingProfile.phone ?? ''} onChange={(e) => setEditingBillingProfile(p => ({ ...p, phone: e.target.value }))} className={inputCls} style={inputStyle} />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Poznámka k fakturaci</label>
                      <textarea rows={2} value={editingBillingProfile.billing_note ?? ''} onChange={(e) => setEditingBillingProfile(p => ({ ...p, billing_note: e.target.value }))} className={inputCls} style={inputStyle} />
                    </div>
                    <label
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer"
                      style={{ background: editingBillingProfile.is_default ? 'var(--bg-active)' : 'var(--bg-hover)' }}
                    >
                      <input
                        type="checkbox"
                        checked={editingBillingProfile.is_default ?? false}
                        onChange={(e) => setEditingBillingProfile(p => ({ ...p, is_default: e.target.checked }))}
                        className="w-4 h-4 rounded"
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      <div>
                        <span className="text-sm block" style={{ color: 'var(--text-primary)' }}>Výchozí profil</span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Použije se pro členy bez přiřazeného profilu</span>
                      </div>
                    </label>
                  </div>
                  <div className="flex gap-3 px-6 py-4 border-t flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
                    <button onClick={() => setEditingBillingProfile(null)} className="flex-1 py-2.5 rounded-xl border text-sm font-medium" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                      Zrušit
                    </button>
                    <button
                      onClick={saveBillingProfile}
                      disabled={billingProfileSaving}
                      className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-50"
                      style={{ background: 'var(--primary)' }}
                    >
                      {billingProfileSaving ? 'Ukládám...' : (editingBillingProfile.id ? 'Uložit změny' : 'Vytvořit profil')}
                    </button>
                  </div>
                </div>
              </div>
            )}
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

        {/* TAB: Dovolená */}
        {activeTab === 'vacation' && (
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
        )}

        {/* TAB: Typy spolupráce */}
        {activeTab === 'cooperation' && (
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

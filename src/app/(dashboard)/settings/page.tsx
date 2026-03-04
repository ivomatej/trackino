'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { WorkspaceProvider, useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/usePermissions';
import DashboardLayout from '@/components/DashboardLayout';
import WorkspaceSelector from '@/components/WorkspaceSelector';
import { supabase } from '@/lib/supabase';
import { formatPhone, normalizePhone } from '@/lib/utils';

// Kurátor seznam běžných časových zón
const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: 'Europe/Prague',        label: 'Praha / Bratislava (UTC+1/+2)' },
  { value: 'Europe/Warsaw',        label: 'Varšava (UTC+1/+2)' },
  { value: 'Europe/Berlin',        label: 'Berlín / Vídeň / Curych (UTC+1/+2)' },
  { value: 'Europe/Paris',         label: 'Paříž / Brusel (UTC+1/+2)' },
  { value: 'Europe/Rome',          label: 'Řím / Madrid (UTC+1/+2)' },
  { value: 'Europe/London',        label: 'Londýn (UTC+0/+1)' },
  { value: 'Europe/Lisbon',        label: 'Lisabon (UTC+0/+1)' },
  { value: 'Europe/Bucharest',     label: 'Bukurešť / Sofia (UTC+2/+3)' },
  { value: 'Europe/Helsinki',      label: 'Helsinky / Tallinn (UTC+2/+3)' },
  { value: 'Europe/Moscow',        label: 'Moskva (UTC+3)' },
  { value: 'UTC',                  label: 'UTC (±0)' },
  { value: 'America/New_York',     label: 'New York / Toronto (UTC-5/-4)' },
  { value: 'America/Chicago',      label: 'Chicago (UTC-6/-5)' },
  { value: 'America/Denver',       label: 'Denver (UTC-7/-6)' },
  { value: 'America/Los_Angeles',  label: 'Los Angeles / Vancouver (UTC-8/-7)' },
  { value: 'America/Sao_Paulo',    label: 'São Paulo (UTC-3/-2)' },
  { value: 'Africa/Cairo',         label: 'Káhira (UTC+2/+3)' },
  { value: 'Asia/Dubai',           label: 'Dubaj (UTC+4)' },
  { value: 'Asia/Kolkata',         label: 'Indie (UTC+5:30)' },
  { value: 'Asia/Bangkok',         label: 'Bangkok / Jakarta (UTC+7)' },
  { value: 'Asia/Singapore',       label: 'Singapur / Kuala Lumpur (UTC+8)' },
  { value: 'Asia/Shanghai',        label: 'Peking / Shanghai (UTC+8)' },
  { value: 'Asia/Tokyo',           label: 'Tokio / Soul (UTC+9)' },
  { value: 'Australia/Sydney',     label: 'Sydney (UTC+10/+11)' },
];
import { useRouter } from 'next/navigation';
import type { WorkspaceBilling, RequiredFields, Tariff, VacationAllowance, CooperationType, ModuleId, WorkspaceSubscription } from '@/types/database';
import { ALL_MODULES, TARIFF_MODULES } from '@/lib/modules';

// Typy pro správu modulů
interface MemberModuleInfo {
  user_id: string;
  display_name: string;
  email: string;
  avatar_color: string;
  role: string;
  overrides: { id: string; module_id: ModuleId; enabled: boolean }[];
}

function SettingsContent() {
  const { currentWorkspace, currentMembership, loading, refreshWorkspace } = useWorkspace();
  const { canAccessSettings, isMasterAdmin } = usePermissions();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'general' | 'subscription' | 'billing' | 'fields' | 'vacation' | 'cooperation' | 'modules' | 'society'>('general');
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

  // Časová zóna workspace
  const [timezone, setTimezone] = useState('Europe/Prague');

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

  // Moduly – správa per-user override
  const [moduleMembers, setModuleMembers] = useState<MemberModuleInfo[]>([]);
  const [moduleLoading, setModuleLoading] = useState(false);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [addModuleUserId, setAddModuleUserId] = useState<string | null>(null);
  const [addModuleId, setAddModuleId] = useState<ModuleId | ''>('');
  const [addModuleEnabled, setAddModuleEnabled] = useState(true);

  // Předplatné (subscription billing history)
  const [subscriptions, setSubscriptions] = useState<WorkspaceSubscription[]>([]);
  const [subLoading, setSubLoading] = useState(false);
  const [changingTariff, setChangingTariff] = useState(false);

  // Společnost – per-workspace modulové nastavení
  const [societyModules, setSocietyModules] = useState({
    knowledge_base: true, documents: true, company_rules: true, office_rules: true,
  });
  const [savingSociety, setSavingSociety] = useState(false);

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
      setTimezone(currentWorkspace.timezone ?? 'Europe/Prague');
      const sc = currentWorkspace.society_modules_enabled ?? {};
      setSocietyModules({
        knowledge_base: sc.knowledge_base !== false,
        documents: sc.documents !== false,
        company_rules: sc.company_rules !== false,
        office_rules: sc.office_rules !== false,
      });
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
      city: editingBillingProfile.city ?? '',
      country: editingBillingProfile.country ?? '',
      postal_code: editingBillingProfile.postal_code ?? '',
      ico: editingBillingProfile.ico ?? '',
      dic: editingBillingProfile.dic ?? '',
      is_vat_payer: editingBillingProfile.is_vat_payer ?? false,
      email: editingBillingProfile.email ?? '',
      phone: normalizePhone(editingBillingProfile.phone ?? ''),
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

  // ── Předplatné (subscription) ────────────────────────────────────────────
  async function fetchSubscriptions(workspaceId: string) {
    setSubLoading(true);
    try {
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth() + 1;

      // Zkontroluj existenci záznamu pro aktuální měsíc
      const { data: existing } = await supabase
        .from('trackino_workspace_subscriptions')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('year', y)
        .eq('month', m)
        .single();

      if (!existing) {
        // Spočti aktivní členy
        const { count } = await supabase
          .from('trackino_workspace_members')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
          .eq('approved', true);

        // Vlož snapshot
        await supabase.from('trackino_workspace_subscriptions').insert({
          workspace_id: workspaceId,
          year: y,
          month: m,
          tariff: currentWorkspace!.tariff,
          active_members: count ?? 0,
        });
      }

      // Načti historii
      const { data } = await supabase
        .from('trackino_workspace_subscriptions')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      setSubscriptions((data ?? []) as WorkspaceSubscription[]);
    } catch {
      setSubscriptions([]);
    }
    setSubLoading(false);
  }

  async function changeTariff(newTariff: Tariff) {
    if (!currentWorkspace) return;
    if (!confirm(`Přejít na tarif ${newTariff.toUpperCase()}? Tato akce změní dostupné funkce workspace.`)) return;
    setChangingTariff(true);
    await supabase.from('trackino_workspaces').update({ tariff: newTariff }).eq('id', currentWorkspace.id);
    await refreshWorkspace();
    setChangingTariff(false);
    setMessage(`Tarif změněn na ${newTariff.toUpperCase()}.`);
    setTimeout(() => setMessage(''), 3000);
  }

  // ── Společnost moduly ────────────────────────────────────────────────────
  async function saveSocietyModules() {
    if (!currentWorkspace) return;
    setSavingSociety(true);
    await supabase
      .from('trackino_workspaces')
      .update({ society_modules_enabled: societyModules })
      .eq('id', currentWorkspace.id);
    await refreshWorkspace();
    setSavingSociety(false);
    setMessage('Nastavení sekce Společnost uloženo.');
    setTimeout(() => setMessage(''), 3000);
  }

  // Načtení dat pro záložku Moduly
  const fetchModuleData = useCallback(async () => {
    if (!currentWorkspace) return;
    setModuleLoading(true);
    try {
      // Načíst členy se profily
      const { data: members } = await supabase
        .from('trackino_workspace_members')
        .select('user_id, role, approved')
        .eq('workspace_id', currentWorkspace.id)
        .eq('approved', true);

      const userIds = (members ?? []).map((m: { user_id: string }) => m.user_id);

      const { data: profiles } = await supabase
        .from('trackino_profiles')
        .select('id, display_name, email, avatar_color')
        .in('id', userIds);

      const { data: overrides } = await supabase
        .from('trackino_user_module_overrides')
        .select('id, user_id, module_id, enabled')
        .eq('workspace_id', currentWorkspace.id);

      const profileMap: Record<string, { display_name: string; email: string; avatar_color: string }> = {};
      for (const p of profiles ?? []) {
        profileMap[p.id] = p as { display_name: string; email: string; avatar_color: string };
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
      // Tabulka overrides ještě nemusí existovat
      setModuleMembers([]);
    }
    setModuleLoading(false);
  }, [currentWorkspace]);

  // Načíst data modulů při přepnutí na záložku Moduly
  useEffect(() => {
    if (activeTab === 'modules') {
      fetchModuleData();
    }
    if (activeTab === 'subscription' && currentWorkspace) {
      fetchSubscriptions(currentWorkspace.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, fetchModuleData, currentWorkspace?.id]);

  async function addModuleOverride(userId: string) {
    if (!currentWorkspace || !addModuleId) return;
    const { error } = await supabase
      .from('trackino_user_module_overrides')
      .upsert({
        workspace_id: currentWorkspace.id,
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
      timezone,
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
        <div>
          <h1 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Nastavení</h1>
          <p style={{ color: 'var(--text-muted)' }}>Nemáte oprávnění k nastavení workspace.</p>
        </div>
      </DashboardLayout>
    );
  }

  const tabs = [
    { id: 'general' as const, label: 'Obecné' },
    { id: 'society' as const, label: 'Společnost' },
    { id: 'subscription' as const, label: 'Předplatné' },
    { id: 'billing' as const, label: 'Fakturace' },
    { id: 'fields' as const, label: 'Povinná pole' },
    { id: 'vacation' as const, label: 'Dovolená' },
    { id: 'cooperation' as const, label: 'Spolupráce' },
    { id: 'modules' as const, label: 'Moduly' },
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
      <div className="max-w-3xl">
        <h1 className="text-xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>Nastavení workspace</h1>

        {/* Taby */}
        <div className="flex gap-1 mb-6 p-1 rounded-lg overflow-x-auto" style={{ background: 'var(--bg-hover)' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setMessage(''); }}
              className="px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0"
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

                {/* Časová zóna */}
                <div>
                  <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Časová zóna</label>
                  <SelectWrap>
                    <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={selectCls} style={inputStyle}>
                      {TIMEZONE_OPTIONS.map(tz => (
                        <option key={tz.value} value={tz.value}>{tz.label}</option>
                      ))}
                    </select>
                  </SelectWrap>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    Určuje, co se považuje za „dnešní datum" v Plánovači, Dovolené a reportech.
                  </p>
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
                        {(profile.address || profile.city || profile.postal_code) && (
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {[profile.address, profile.postal_code && profile.city ? `${profile.postal_code} ${profile.city}` : (profile.postal_code || profile.city), profile.country].filter(Boolean).join(', ')}
                          </p>
                        )}
                        {(profile.email || profile.phone) && (
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {[profile.email, profile.phone ? formatPhone(profile.phone) : null].filter(Boolean).join(' · ')}
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
                      <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Adresa (ulice + číslo popisné)</label>
                      <input type="text" value={editingBillingProfile.address ?? ''} onChange={(e) => setEditingBillingProfile(p => ({ ...p, address: e.target.value }))} placeholder="např. Václavské náměstí 1" className={inputCls} style={inputStyle} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>PSČ</label>
                        <input type="text" value={editingBillingProfile.postal_code ?? ''} onChange={(e) => setEditingBillingProfile(p => ({ ...p, postal_code: e.target.value }))} placeholder="110 00" className={inputCls} style={inputStyle} />
                      </div>
                      <div>
                        <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Město</label>
                        <input type="text" value={editingBillingProfile.city ?? ''} onChange={(e) => setEditingBillingProfile(p => ({ ...p, city: e.target.value }))} placeholder="Praha" className={inputCls} style={inputStyle} />
                      </div>
                      <div>
                        <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Stát</label>
                        <input type="text" value={editingBillingProfile.country ?? ''} onChange={(e) => setEditingBillingProfile(p => ({ ...p, country: e.target.value }))} placeholder="Česká republika" className={inputCls} style={inputStyle} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        {/* TAB: Moduly */}
        {activeTab === 'modules' && (
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
                                  className="px-2.5 py-1.5 rounded-lg border text-xs"
                                  style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                                >
                                  <option value="">— vyberte modul —</option>
                                  {ALL_MODULES.filter(m => !member.overrides.some(o => o.module_id === m.id)).map(m => (
                                    <option key={m.id} value={m.id}>{m.label}</option>
                                  ))}
                                </select>
                                <select
                                  value={addModuleEnabled ? '1' : '0'}
                                  onChange={e => setAddModuleEnabled(e.target.value === '1')}
                                  className="px-2.5 py-1.5 rounded-lg border text-xs"
                                  style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
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
        )}

        {/* ── TAB: Předplatné ── */}
        {activeTab === 'subscription' && (
          <div className="space-y-5">
            {/* Aktuální plán */}
            <div className="rounded-2xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: currentWorkspace.tariff === 'max' ? '#7c3aed22' : currentWorkspace.tariff === 'pro' ? '#2563eb22' : '#6b728022' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                      style={{ color: currentWorkspace.tariff === 'max' ? '#7c3aed' : currentWorkspace.tariff === 'pro' ? '#2563eb' : '#6b7280' }}>
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                      {currentWorkspace.tariff === 'max' ? 'Max plan' : currentWorkspace.tariff === 'pro' ? 'Pro plan' : 'Free plan'}
                    </h3>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {currentWorkspace.tariff === 'max' ? 'Plná sada funkcí + audit log'
                        : currentWorkspace.tariff === 'pro' ? 'Rozšířené funkce pro týmy'
                        : 'Základní funkce zdarma'}
                    </p>
                  </div>
                </div>
                {(isMasterAdmin || currentWorkspace.tariff !== 'max') && (
                  <div className="flex gap-2 flex-wrap">
                    {(['free', 'pro', 'max'] as Tariff[]).filter(t => t !== currentWorkspace.tariff).map(t => (
                      <button
                        key={t}
                        onClick={() => changeTariff(t)}
                        disabled={changingTariff}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50"
                        style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        Přejít na {t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Platební údaje – placeholder */}
            <div className="rounded-2xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Platební metoda</h3>
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--bg-hover)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text-muted)' }}>
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                </svg>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Správa platebních metod – připravujeme</span>
              </div>
            </div>

            {/* Historie */}
            <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Historie faktur</h3>
              </div>
              {subLoading ? (
                <div className="py-8 text-center">
                  <div className="w-5 h-5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              ) : subscriptions.length === 0 ? (
                <p className="px-5 py-6 text-sm text-center" style={{ color: 'var(--text-muted)' }}>Zatím žádná historie.</p>
              ) : (
                <div>
                  <div className="grid px-5 py-2 text-xs font-semibold uppercase tracking-wider border-b"
                    style={{ gridTemplateColumns: '1fr 120px 140px', color: 'var(--text-muted)', borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
                    <span>Období</span><span>Tarif</span><span>Aktivní uživatelé</span>
                  </div>
                  {subscriptions.map(sub => (
                    <div key={sub.id} className="grid px-5 py-3 border-b last:border-b-0 text-sm"
                      style={{ gridTemplateColumns: '1fr 120px 140px', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {new Date(sub.year, sub.month - 1).toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' })}
                      </span>
                      <span className="font-medium capitalize">{sub.tariff}</span>
                      <span>{sub.active_members} uživatelů</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Zrušení */}
            {currentWorkspace.tariff !== 'free' && (isMasterAdmin || currentMembership?.role === 'owner') && (
              <div className="rounded-2xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Zrušení tarifu</h3>
                <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                  Přechod na Free plán omezí dostupné funkce workspace. Záznamy a data zůstanou zachovány.
                </p>
                <button
                  onClick={() => changeTariff('free')}
                  disabled={changingTariff}
                  className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50"
                  style={{ borderColor: '#ef4444', color: '#ef4444' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  Přejít na Free plán
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Společnost ── */}
        {activeTab === 'society' && (
          <div className="space-y-5">
            <div className="rounded-2xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <h2 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Sekce Společnost</h2>
              <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>
                Sekce Společnost obsahuje firemní dokumenty, pravidla a znalostní bázi. Moduly jsou dostupné od tarifu Pro.
                Jako správce workspace můžete jednotlivé moduly vypnout – uživatelé je pak neuvidí v navigaci.
              </p>

              <div className="space-y-3">
                {[
                  { key: 'knowledge_base' as const, label: 'Znalostní báze', desc: 'Interní wiki a znalostní databáze týmu' },
                  { key: 'documents' as const, label: 'Dokumenty', desc: 'Správa firemních dokumentů, souborů a odkazů' },
                  { key: 'company_rules' as const, label: 'Firemní pravidla', desc: 'Editovatelná textová stránka s firemními pravidly' },
                  { key: 'office_rules' as const, label: 'Pravidla v kanceláři', desc: 'Editovatelná textová stránka s kancelářskými pravidly' },
                ].map(mod => (
                  <label
                    key={mod.key}
                    className="flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors"
                    style={{
                      background: societyModules[mod.key] ? 'var(--bg-active)' : 'var(--bg-hover)',
                      border: `1px solid ${societyModules[mod.key] ? 'var(--primary)' : 'var(--border)'}`,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={societyModules[mod.key]}
                      onChange={e => setSocietyModules(prev => ({ ...prev, [mod.key]: e.target.checked }))}
                      className="mt-0.5 flex-shrink-0 w-4 h-4 accent-[var(--primary)]"
                    />
                    <div>
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{mod.label}</span>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{mod.desc}</p>
                    </div>
                  </label>
                ))}
              </div>

              <div className="mt-5">
                <button
                  onClick={saveSocietyModules}
                  disabled={savingSociety}
                  className="px-5 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
                  style={{ background: 'var(--primary)' }}
                >
                  {savingSociety ? 'Ukládám...' : 'Uložit nastavení'}
                </button>
              </div>
            </div>
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

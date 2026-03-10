'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { formatPhone, normalizePhone } from '@/lib/utils';
import type { WorkspaceBilling } from '@/types/database';
import { INPUT_CLS, INPUT_STYLE, LABEL_CLS } from '../constants';

interface Props {
  workspaceId: string;
  onMessage: (msg: string) => void;
}

export default function TabBilling({ workspaceId, onMessage }: Props) {
  const [billingProfiles, setBillingProfiles] = useState<WorkspaceBilling[]>([]);
  const [editingBillingProfile, setEditingBillingProfile] = useState<Partial<WorkspaceBilling> | null>(null);
  const [billingProfileSaving, setBillingProfileSaving] = useState(false);

  useEffect(() => {
    fetchBillingProfiles();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  async function fetchBillingProfiles() {
    const { data } = await supabase
      .from('trackino_workspace_billing')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('is_default', { ascending: false });
    setBillingProfiles((data ?? []) as WorkspaceBilling[]);
  }

  async function saveBillingProfile() {
    if (!editingBillingProfile) return;
    setBillingProfileSaving(true);
    const profileData = {
      workspace_id: workspaceId,
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
      fetchBillingProfiles();
      onMessage('Fakturační profil uložen.');
      setTimeout(() => onMessage(''), 3000);
    } else {
      onMessage('Chyba: ' + error.message);
    }
  }

  async function deleteBillingProfile(id: string) {
    if (!confirm('Smazat tento fakturační profil? Členové s tímto profilem ztratí přiřazení.')) return;
    await supabase.from('trackino_workspace_billing').delete().eq('id', id);
    fetchBillingProfiles();
  }

  async function setProfileAsDefault(id: string) {
    await supabase.from('trackino_workspace_billing').update({ is_default: false }).eq('workspace_id', workspaceId);
    await supabase.from('trackino_workspace_billing').update({ is_default: true }).eq('id', id);
    fetchBillingProfiles();
  }

  return (
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

      {/* MODAL: Upravit / Přidat fakturační profil */}
      {editingBillingProfile !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setEditingBillingProfile(null)} />
          <div className="relative w-full max-w-lg rounded-xl shadow-xl z-10 flex flex-col" style={{ maxHeight: '90vh', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
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
                <label className={LABEL_CLS} style={{ color: 'var(--text-secondary)' }}>Název profilu *</label>
                <input type="text" value={editingBillingProfile.name ?? ''} onChange={(e) => setEditingBillingProfile(p => ({ ...p, name: e.target.value }))} placeholder="např. Hlavní s.r.o., Pobočka Praha…" className={INPUT_CLS} style={INPUT_STYLE} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={LABEL_CLS} style={{ color: 'var(--text-secondary)' }}>Název firmy</label>
                  <input type="text" value={editingBillingProfile.company_name ?? ''} onChange={(e) => setEditingBillingProfile(p => ({ ...p, company_name: e.target.value }))} className={INPUT_CLS} style={INPUT_STYLE} />
                </div>
                <div>
                  <label className={LABEL_CLS} style={{ color: 'var(--text-secondary)' }}>Jméno jednatele</label>
                  <input type="text" value={editingBillingProfile.representative_name ?? ''} onChange={(e) => setEditingBillingProfile(p => ({ ...p, representative_name: e.target.value }))} className={INPUT_CLS} style={INPUT_STYLE} />
                </div>
              </div>
              <div>
                <label className={LABEL_CLS} style={{ color: 'var(--text-secondary)' }}>Adresa (ulice + číslo popisné)</label>
                <input type="text" value={editingBillingProfile.address ?? ''} onChange={(e) => setEditingBillingProfile(p => ({ ...p, address: e.target.value }))} placeholder="např. Václavské náměstí 1" className={INPUT_CLS} style={INPUT_STYLE} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={LABEL_CLS} style={{ color: 'var(--text-secondary)' }}>PSČ</label>
                  <input type="text" value={editingBillingProfile.postal_code ?? ''} onChange={(e) => setEditingBillingProfile(p => ({ ...p, postal_code: e.target.value }))} placeholder="110 00" className={INPUT_CLS} style={INPUT_STYLE} />
                </div>
                <div>
                  <label className={LABEL_CLS} style={{ color: 'var(--text-secondary)' }}>Město</label>
                  <input type="text" value={editingBillingProfile.city ?? ''} onChange={(e) => setEditingBillingProfile(p => ({ ...p, city: e.target.value }))} placeholder="Praha" className={INPUT_CLS} style={INPUT_STYLE} />
                </div>
                <div>
                  <label className={LABEL_CLS} style={{ color: 'var(--text-secondary)' }}>Stát</label>
                  <input type="text" value={editingBillingProfile.country ?? ''} onChange={(e) => setEditingBillingProfile(p => ({ ...p, country: e.target.value }))} placeholder="Česká republika" className={INPUT_CLS} style={INPUT_STYLE} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={LABEL_CLS} style={{ color: 'var(--text-secondary)' }}>IČ</label>
                  <input type="text" value={editingBillingProfile.ico ?? ''} onChange={(e) => setEditingBillingProfile(p => ({ ...p, ico: e.target.value }))} className={INPUT_CLS} style={INPUT_STYLE} />
                </div>
                <div>
                  <label className={LABEL_CLS} style={{ color: 'var(--text-secondary)' }}>DIČ</label>
                  <input type="text" value={editingBillingProfile.dic ?? ''} onChange={(e) => setEditingBillingProfile(p => ({ ...p, dic: e.target.value }))} className={INPUT_CLS} style={INPUT_STYLE} />
                </div>
              </div>
              <label className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer" style={{ background: editingBillingProfile.is_vat_payer ? 'var(--bg-active)' : 'var(--bg-hover)' }}>
                <input type="checkbox" checked={editingBillingProfile.is_vat_payer ?? false} onChange={(e) => setEditingBillingProfile(p => ({ ...p, is_vat_payer: e.target.checked }))} className="w-4 h-4 rounded" style={{ accentColor: 'var(--primary)' }} />
                <div>
                  <span className="text-sm block" style={{ color: 'var(--text-primary)' }}>Jsme plátci DPH</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Tato firma je plátcem DPH</span>
                </div>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={LABEL_CLS} style={{ color: 'var(--text-secondary)' }}>E-mail</label>
                  <input type="email" value={editingBillingProfile.email ?? ''} onChange={(e) => setEditingBillingProfile(p => ({ ...p, email: e.target.value }))} className={INPUT_CLS} style={INPUT_STYLE} />
                </div>
                <div>
                  <label className={LABEL_CLS} style={{ color: 'var(--text-secondary)' }}>Telefon</label>
                  <input type="tel" value={editingBillingProfile.phone ?? ''} onChange={(e) => setEditingBillingProfile(p => ({ ...p, phone: e.target.value }))} className={INPUT_CLS} style={INPUT_STYLE} />
                </div>
              </div>
              <div>
                <label className={LABEL_CLS} style={{ color: 'var(--text-secondary)' }}>Poznámka k fakturaci</label>
                <textarea rows={2} value={editingBillingProfile.billing_note ?? ''} onChange={(e) => setEditingBillingProfile(p => ({ ...p, billing_note: e.target.value }))} className={INPUT_CLS} style={INPUT_STYLE} />
              </div>
              <label className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer" style={{ background: editingBillingProfile.is_default ? 'var(--bg-active)' : 'var(--bg-hover)' }}>
                <input type="checkbox" checked={editingBillingProfile.is_default ?? false} onChange={(e) => setEditingBillingProfile(p => ({ ...p, is_default: e.target.checked }))} className="w-4 h-4 rounded" style={{ accentColor: 'var(--primary)' }} />
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
  );
}

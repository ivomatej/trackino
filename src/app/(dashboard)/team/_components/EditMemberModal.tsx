'use client';

import type { CooperationType, WorkspaceBilling, MemberRate } from '@/types/database';
import type { MemberWithProfile } from './types';
import { AVATAR_COLORS, TrashIcon, inputCls, inputStyle, fmtDateShort } from './types';

// Sub-komponenta pro checkbox oprávnění (zkracuje opakující se JSX)
function PermissionToggle({
  label, description, checked, onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors"
      style={{ background: checked ? 'var(--bg-active)' : 'var(--bg-hover)' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = checked ? 'var(--bg-active)' : 'var(--bg-hover)'; }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded flex-shrink-0"
        style={{ accentColor: 'var(--primary)' }}
      />
      <div>
        <span className="text-sm block" style={{ color: 'var(--text-primary)' }}>{label}</span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{description}</span>
      </div>
    </label>
  );
}

interface Props {
  editingMember: MemberWithProfile | null;
  setEditingMember: (v: MemberWithProfile | null) => void;
  editName: string; setEditName: (v: string) => void;
  editEmail: string; setEditEmail: (v: string) => void;
  editPhone: string; setEditPhone: (v: string) => void;
  editPosition: string; setEditPosition: (v: string) => void;
  editBirthDate: string; setEditBirthDate: (v: string) => void;
  editColor: string; setEditColor: (v: string) => void;
  editInitials: string;
  editSaving: boolean;
  saveMemberEdit: () => void;
  editCanUseVacation: boolean; setEditCanUseVacation: (v: boolean) => void;
  editCanInvoice: boolean; setEditCanInvoice: (v: boolean) => void;
  editCanManageBilling: boolean; setEditCanManageBilling: (v: boolean) => void;
  editCanViewAudit: boolean; setEditCanViewAudit: (v: boolean) => void;
  editCanProcessRequests: boolean; setEditCanProcessRequests: (v: boolean) => void;
  editCanReceiveFeedback: boolean; setEditCanReceiveFeedback: (v: boolean) => void;
  editCanManageDocuments: boolean; setEditCanManageDocuments: (v: boolean) => void;
  editCanManageSubscriptions: boolean; setEditCanManageSubscriptions: (v: boolean) => void;
  editCanManageDomains: boolean; setEditCanManageDomains: (v: boolean) => void;
  editCanManageTasks: boolean; setEditCanManageTasks: (v: boolean) => void;
  editCanViewBirthdays: boolean; setEditCanViewBirthdays: (v: boolean) => void;
  editCooperationTypeId: string; setEditCooperationTypeId: (v: string) => void;
  editBillingProfileId: string; setEditBillingProfileId: (v: string) => void;
  cooperationTypes: CooperationType[];
  billingProfiles: WorkspaceBilling[];
  memberRates: MemberRate[];
  ratesLoading: boolean;
  showAddRate: boolean; setShowAddRate: (v: boolean) => void;
  newRateAmount: string; setNewRateAmount: (v: string) => void;
  newRateFrom: string; setNewRateFrom: (v: string) => void;
  addingRate: boolean;
  addMemberRate: () => void;
  deleteMemberRate: (id: string) => void;
  rateValidToEdits: Record<string, string>;
  setRateValidToEdits: (fn: (prev: Record<string, string>) => Record<string, string>) => void;
  savingRateId: string | null;
  saveRateValidTo: (rateId: string) => void;
  currencySymbol: string;
}

export default function EditMemberModal({
  editingMember, setEditingMember,
  editName, setEditName, editEmail, setEditEmail,
  editPhone, setEditPhone, editPosition, setEditPosition,
  editBirthDate, setEditBirthDate, editColor, setEditColor, editInitials,
  editSaving, saveMemberEdit,
  editCanUseVacation, setEditCanUseVacation,
  editCanInvoice, setEditCanInvoice,
  editCanManageBilling, setEditCanManageBilling,
  editCanViewAudit, setEditCanViewAudit,
  editCanProcessRequests, setEditCanProcessRequests,
  editCanReceiveFeedback, setEditCanReceiveFeedback,
  editCanManageDocuments, setEditCanManageDocuments,
  editCanManageSubscriptions, setEditCanManageSubscriptions,
  editCanManageDomains, setEditCanManageDomains,
  editCanManageTasks, setEditCanManageTasks,
  editCanViewBirthdays, setEditCanViewBirthdays,
  editCooperationTypeId, setEditCooperationTypeId,
  editBillingProfileId, setEditBillingProfileId,
  cooperationTypes, billingProfiles,
  memberRates, ratesLoading,
  showAddRate, setShowAddRate,
  newRateAmount, setNewRateAmount, newRateFrom, setNewRateFrom,
  addingRate, addMemberRate, deleteMemberRate,
  rateValidToEdits, setRateValidToEdits, savingRateId, saveRateValidTo,
  currencySymbol,
}: Props) {
  if (!editingMember) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setEditingMember(null)} />
      <div
        className="relative w-full max-w-md rounded-xl shadow-xl z-10 flex flex-col"
        style={{ maxHeight: '90vh', background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0">
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Upravit uživatele</h3>
          <button
            onClick={() => setEditingMember(null)}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 pb-4">
          {/* Avatar + color picker */}
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 transition-colors" style={{ background: editColor }}>
              {editInitials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Barva avatara</div>
              <div className="flex flex-wrap gap-1.5">
                {AVATAR_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setEditColor(c)}
                    className="w-5 h-5 rounded-full transition-all flex-shrink-0"
                    style={{ background: c, outline: editColor === c ? '2px solid #000' : 'none', outlineOffset: '2px' }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Jméno + Email */}
          <div className="mb-3">
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Jméno</label>
            <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Jan Novák" className={inputCls} style={inputStyle} />
          </div>
          <div className="mb-3">
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>E-mail</label>
            <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="jan@firma.cz" className={inputCls} style={inputStyle} />
          </div>

          {/* Telefon + Pozice */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Telefon</label>
              <input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="+420 123 456 789" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Pozice</label>
              <input type="text" value={editPosition} onChange={(e) => setEditPosition(e.target.value)} placeholder="např. Grafik" className={inputCls} style={inputStyle} />
            </div>
          </div>

          {/* Datum narození */}
          <div className="mb-3">
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Datum narození</label>
            <input type="date" value={editBirthDate} onChange={(e) => setEditBirthDate(e.target.value)} className={inputCls} style={inputStyle} />
            <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
              Zobrazí se v kalendáři Narozeniny uživatelům s příslušným oprávněním.
            </p>
          </div>

          {/* Typ spolupráce */}
          {cooperationTypes.length > 0 && (
            <div className="mb-3">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Typ spolupráce</label>
              <div className="relative">
                <select
                  value={editCooperationTypeId}
                  onChange={(e) => setEditCooperationTypeId(e.target.value)}
                  className={inputCls + ' pr-8 appearance-none cursor-pointer'}
                  style={inputStyle}
                >
                  <option value="">— Nevybráno —</option>
                  {cooperationTypes.map(ct => (
                    <option key={ct.id} value={ct.id}>{ct.name}</option>
                  ))}
                </select>
                <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text-muted)' }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>
          )}

          {/* Oprávnění */}
          <div className="mb-4">
            <PermissionToggle
              label="Může čerpat dovolenou"
              description="Zaměstnanec s nárokem na dovolenou (HPP apod.)"
              checked={editCanUseVacation}
              onChange={setEditCanUseVacation}
            />
          </div>

          <div className="mb-4 space-y-2">
            <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Fakturace</div>
            <PermissionToggle label="Může fakturovat" description="Uživatel může podávat žádosti o proplacení faktury" checked={editCanInvoice} onChange={setEditCanInvoice} />
            <PermissionToggle label="Správce fakturace" description="Může stahovat faktury a označovat je jako proplacené" checked={editCanManageBilling} onChange={setEditCanManageBilling} />
            <PermissionToggle label="Audit log" description="Může zobrazit historii úprav záznamů podřízených" checked={editCanViewAudit} onChange={setEditCanViewAudit} />
            <PermissionToggle label="Zpracovává žádosti" description="Může schvalovat a zamítat žádosti zaměstnanců" checked={editCanProcessRequests} onChange={setEditCanProcessRequests} />
            <PermissionToggle label="Přijímá připomínky" description="Může zobrazit anonymní připomínky od kolegů" checked={editCanReceiveFeedback} onChange={setEditCanReceiveFeedback} />
            <PermissionToggle label="Spravuje dokumenty" description="Může nahrávat, mazat a spravovat složky v Dokumentech" checked={editCanManageDocuments} onChange={setEditCanManageDocuments} />
            <PermissionToggle label="Spravuje předplatná" description="Může přidávat, upravovat a mazat firemní předplatná" checked={editCanManageSubscriptions} onChange={setEditCanManageSubscriptions} />
            <PermissionToggle label="Spravuje domény" description="Může přidávat, upravovat a mazat firemní domény" checked={editCanManageDomains} onChange={setEditCanManageDomains} />
            <PermissionToggle label="Spravuje úkoly" description="Může vytvářet, editovat, mazat a přesouvat úkoly" checked={editCanManageTasks} onChange={setEditCanManageTasks} />
            <PermissionToggle label="Vidí narozeniny kolegů" description="Zobrazí se kalendář Narozeniny s datumy narozenin kolegů" checked={editCanViewBirthdays} onChange={setEditCanViewBirthdays} />

            {/* Fakturační profil */}
            {billingProfiles.length > 0 && (
              <div className="mt-3">
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Fakturační profil</label>
                <select value={editBillingProfileId} onChange={(e) => setEditBillingProfileId(e.target.value)} className={inputCls} style={inputStyle}>
                  <option value="">— Výchozí profil workspace —</option>
                  {billingProfiles.map(bp => (
                    <option key={bp.id} value={bp.id}>
                      {bp.name}{bp.is_default ? ' (výchozí)' : ''}{bp.company_name ? ` – ${bp.company_name}` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
                  Fakturační profil se uživateli zobrazí při žádosti o fakturaci.
                </p>
              </div>
            )}
          </div>

          {/* Hodinové sazby */}
          <div className="mb-2">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Hodinové sazby</label>
              {!showAddRate && (
                <button
                  onClick={() => setShowAddRate(true)}
                  className="flex items-center gap-1 text-xs font-medium transition-colors"
                  style={{ color: 'var(--primary)' }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Přidat sazbu
                </button>
              )}
            </div>

            {showAddRate && (
              <div className="mb-2 p-3 rounded-lg border" style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
                <div className="flex gap-2 mb-2">
                  <div className="relative flex-1">
                    <input
                      type="number" value={newRateAmount} onChange={(e) => setNewRateAmount(e.target.value)}
                      placeholder="250" min="0" step="1"
                      className="w-full px-3 py-2 pr-12 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                      style={inputStyle}
                      onKeyDown={(e) => { if (e.key === 'Enter') addMemberRate(); }}
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: 'var(--text-muted)' }}>{currencySymbol}/h</span>
                  </div>
                  <div className="flex-1">
                    <input
                      type="date" value={newRateFrom} onChange={(e) => setNewRateFrom(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowAddRate(false); setNewRateAmount(''); setNewRateFrom(''); }}
                    className="flex-1 py-1.5 rounded-lg border text-xs"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                  >
                    Zrušit
                  </button>
                  <button
                    onClick={addMemberRate}
                    disabled={addingRate || !newRateAmount || !newRateFrom}
                    className="flex-1 py-1.5 rounded-lg text-white text-xs font-medium disabled:opacity-50"
                    style={{ background: 'var(--primary)' }}
                  >
                    {addingRate ? '...' : 'Přidat'}
                  </button>
                </div>
              </div>
            )}

            {ratesLoading ? (
              <div className="py-3 text-center">
                <div className="w-4 h-4 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : memberRates.length === 0 ? (
              <div className="py-3 text-center text-xs rounded-lg border border-dashed" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                Zatím žádné sazby. Klikněte „Přidat sazbu".
              </div>
            ) : (
              <div className="space-y-1.5">
                {memberRates.map(rate => (
                  <div key={rate.id} className="rounded-lg border px-3 py-2.5" style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold tabular-nums flex-shrink-0" style={{ color: 'var(--text-primary)' }}>
                        {rate.hourly_rate} {currencySymbol}/h
                      </span>
                      <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                        od {fmtDateShort(rate.valid_from)}
                      </span>
                      {rate.valid_to ? (
                        <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                          – {fmtDateShort(rate.valid_to)}
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0" style={{ background: '#dcfce7', color: '#15803d' }}>
                          Aktivní
                        </span>
                      )}
                      <div className="flex-1" />
                      <button
                        onClick={() => deleteMemberRate(rate.id)}
                        className="p-1 rounded transition-colors flex-shrink-0"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                      >
                        <TrashIcon size={12} />
                      </button>
                    </div>
                    {!rate.valid_to && (
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                        <span className="text-[11px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>platí do:</span>
                        <input
                          type="date"
                          value={rateValidToEdits[rate.id] ?? ''}
                          onChange={(e) => setRateValidToEdits(prev => ({ ...prev, [rate.id]: e.target.value }))}
                          className="flex-1 px-2 py-1 rounded-md border text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                          style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                        />
                        {rateValidToEdits[rate.id] && (
                          <button
                            onClick={() => saveRateValidTo(rate.id)}
                            disabled={savingRateId === rate.id}
                            className="px-2.5 py-1 rounded-md text-xs font-medium text-white disabled:opacity-50 flex-shrink-0"
                            style={{ background: 'var(--primary)' }}
                          >
                            {savingRateId === rate.id ? '...' : '✓'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-6 py-4 flex-shrink-0 border-t" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={() => setEditingMember(null)}
            className="flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'transparent' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            Zrušit
          </button>
          <button
            onClick={saveMemberEdit}
            disabled={editSaving || !editName.trim()}
            className="flex-1 py-2.5 rounded-lg text-white text-sm font-medium disabled:opacity-50"
            style={{ background: 'var(--primary)' }}
          >
            {editSaving ? 'Ukládám...' : 'Uložit jméno & barvu'}
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { formatPhone } from '@/lib/utils';
import type { WorkspaceBilling } from '@/types/database';
import { fmtMonth, inputCls, inputStyle } from '../utils';

interface SubmitInvoiceFormProps {
  prevYear: number;
  prevMonth: number;
  submitIssueDate: string;
  setSubmitIssueDate: (v: string) => void;
  submitDueDate: string;
  setSubmitDueDate: (v: string) => void;
  submitVarSymbol: string;
  setSubmitVarSymbol: (v: string) => void;
  submitIsVat: boolean;
  setSubmitIsVat: (v: boolean) => void;
  submitPdf: File | null;
  setSubmitPdf: (v: File | null) => void;
  submitNote: string;
  setSubmitNote: (v: string) => void;
  submitting: boolean;
  submitError: string;
  userBillingProfile: WorkspaceBilling | null;
  onClose: () => void;
  onSubmit: () => void;
}

export function SubmitInvoiceForm({
  prevYear,
  prevMonth,
  submitIssueDate,
  setSubmitIssueDate,
  submitDueDate,
  setSubmitDueDate,
  submitVarSymbol,
  setSubmitVarSymbol,
  submitIsVat,
  setSubmitIsVat,
  submitPdf,
  setSubmitPdf,
  submitNote,
  setSubmitNote,
  submitting,
  submitError,
  userBillingProfile,
  onClose,
  onSubmit,
}: SubmitInvoiceFormProps) {
  return (
    <div className="mb-6 rounded-xl border p-6 overflow-x-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', transform: 'translateZ(0)' }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Faktura za {fmtMonth(prevYear, prevMonth)}
          </h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Nahrajte svou fakturu ve formátu PDF a vyplňte údaje.
          </p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="flex gap-6">
        {/* Levá část – formulářová pole */}
        <div className="flex-1 min-w-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="min-w-0">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Datum vystavení *</label>
              <input type="date" value={submitIssueDate} onChange={(e) => setSubmitIssueDate(e.target.value)} className={inputCls} style={{ ...inputStyle, maxWidth: '100%' }} />
            </div>
            <div className="min-w-0">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Datum splatnosti *</label>
              <input type="date" value={submitDueDate} onChange={(e) => setSubmitDueDate(e.target.value)} className={inputCls} style={{ ...inputStyle, maxWidth: '100%' }} />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Variabilní symbol *</label>
            <input type="text" value={submitVarSymbol} onChange={(e) => setSubmitVarSymbol(e.target.value)} placeholder="např. 202401001" className={inputCls} style={inputStyle} />
          </div>

          <div className="mb-4">
            <label
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer"
              style={{ background: 'var(--bg-hover)' }}
            >
              <input
                type="checkbox"
                checked={submitIsVat}
                onChange={(e) => setSubmitIsVat(e.target.checked)}
                className="w-4 h-4 rounded"
                style={{ accentColor: 'var(--primary)' }}
              />
              <div>
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Jsem plátce DPH</span>
                <span className="text-xs block" style={{ color: 'var(--text-muted)' }}>Zaškrtněte pokud fakturujete s DPH</span>
              </div>
            </label>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Faktura PDF *</label>
            <div
              className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors"
              style={{ borderColor: submitPdf ? 'var(--primary)' : 'var(--border)' }}
              onClick={() => document.getElementById('pdf-upload')?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file?.type === 'application/pdf') setSubmitPdf(file);
              }}
            >
              {submitPdf ? (
                <div className="flex items-center justify-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span className="text-sm font-medium" style={{ color: 'var(--primary)' }}>{submitPdf.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setSubmitPdf(null); }}
                    className="ml-1 text-xs"
                    style={{ color: 'var(--text-muted)' }}
                  >✕</button>
                </div>
              ) : (
                <>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Klikněte nebo přetáhněte PDF soubor
                  </p>
                </>
              )}
            </div>
            <input id="pdf-upload" type="file" accept="application/pdf" className="hidden" onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setSubmitPdf(file);
            }} />
          </div>

          <div className="mb-5">
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Poznámka (volitelné)</label>
            <textarea
              value={submitNote}
              onChange={(e) => setSubmitNote(e.target.value)}
              rows={2}
              placeholder="Volitelná poznámka pro schvalovatele..."
              className={inputCls}
              style={inputStyle}
            />
          </div>

          {submitError && (
            <div className="mb-4 px-3 py-2.5 rounded-lg text-sm" style={{ background: '#fee2e2', color: '#dc2626' }}>
              {submitError}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border text-sm font-medium"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              Zrušit
            </button>
            <button
              onClick={onSubmit}
              disabled={submitting || !submitPdf || !submitIssueDate || !submitDueDate || !submitVarSymbol.trim()}
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-50"
              style={{ background: 'var(--primary)' }}
            >
              {submitting ? 'Odesílám...' : 'Odeslat ke schválení'}
            </button>
          </div>
        </div>

        {/* Pravá část – fakturační údaje */}
        {userBillingProfile && (
          <div className="w-72 flex-shrink-0 rounded-xl border p-4 self-start" style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
            <div className="flex items-center gap-2 mb-3">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary)' }}>
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                {userBillingProfile.name}
              </span>
              {userBillingProfile.is_default && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium ml-auto" style={{ background: '#dbeafe', color: '#1e40af' }}>
                  Výchozí
                </span>
              )}
            </div>
            <div className="space-y-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
              {userBillingProfile.company_name && (
                <div>
                  <span className="font-medium" style={{ color: 'var(--text-muted)' }}>Společnost</span>
                  <div style={{ color: 'var(--text-primary)' }}>{userBillingProfile.company_name}</div>
                </div>
              )}
              {(userBillingProfile.address || userBillingProfile.postal_code || userBillingProfile.city || userBillingProfile.country) && (
                <div>
                  <span className="font-medium" style={{ color: 'var(--text-muted)' }}>Adresa</span>
                  <div style={{ color: 'var(--text-primary)' }}>
                    {userBillingProfile.address && <div>{userBillingProfile.address}</div>}
                    {(userBillingProfile.postal_code || userBillingProfile.city) && (
                      <div>{[userBillingProfile.postal_code, userBillingProfile.city].filter(Boolean).join(' ')}</div>
                    )}
                    {userBillingProfile.country && <div>{userBillingProfile.country}</div>}
                  </div>
                </div>
              )}
              {userBillingProfile.ico && (
                <div className="flex items-center gap-4">
                  <div>
                    <span className="font-medium" style={{ color: 'var(--text-muted)' }}>IČO</span>
                    <div style={{ color: 'var(--text-primary)' }}>{userBillingProfile.ico}</div>
                  </div>
                  {userBillingProfile.dic && (
                    <div>
                      <span className="font-medium" style={{ color: 'var(--text-muted)' }}>DIČ</span>
                      <div style={{ color: 'var(--text-primary)' }}>{userBillingProfile.dic}</div>
                    </div>
                  )}
                </div>
              )}
              <div>
                <span className="font-medium" style={{ color: 'var(--text-muted)' }}>DPH</span>
                <div style={{ color: 'var(--text-primary)' }}>
                  {userBillingProfile.is_vat_payer ? 'Jsme plátci DPH' : 'Nejsme plátci DPH'}
                </div>
              </div>
              {userBillingProfile.email && (
                <div>
                  <span className="font-medium" style={{ color: 'var(--text-muted)' }}>E-mail</span>
                  <div style={{ color: 'var(--text-primary)' }}>{userBillingProfile.email}</div>
                </div>
              )}
              {userBillingProfile.phone && (
                <div>
                  <span className="font-medium" style={{ color: 'var(--text-muted)' }}>Telefon</span>
                  <div style={{ color: 'var(--text-primary)' }}>{formatPhone(userBillingProfile.phone)}</div>
                </div>
              )}
              {userBillingProfile.billing_note && (
                <div className="mt-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                  <span className="font-medium" style={{ color: 'var(--text-muted)' }}>Poznámka k fakturaci</span>
                  <div style={{ color: 'var(--text-primary)' }}>{userBillingProfile.billing_note}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

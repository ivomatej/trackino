'use client';

import { ICONS, STATUS_CONFIG } from './constants';
import { daysUntilExpiration, getDisplayStatus, fmtDate } from './utils';
import type { Domain } from './types';

interface Props {
  detailDomain: Domain | null;
  onClose: () => void;
  onEdit: (domain: Domain) => void;
  canManage: boolean;
  getSubName: (id: string | null) => string | null;
}

export function DomainDetailModal({ detailDomain, onClose, onEdit, canManage, getSubName }: Props) {
  if (!detailDomain) return null;

  const ds = getDisplayStatus(detailDomain);
  const sc = STATUS_CONFIG[ds];
  const days = daysUntilExpiration(detailDomain.expiration_date);
  const subName = getSubName(detailDomain.subscription_id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg rounded-xl p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        style={{ background: 'var(--bg-card)' }}>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            {detailDomain.name}
          </h2>
          <div className="flex items-center gap-1">
            {canManage && (
              <button onClick={() => { onClose(); onEdit(detailDomain); }}
                className="p-1.5 rounded transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                title="Upravit">
                {ICONS.edit}
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          {/* Status */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
              style={{ background: sc.bg, color: sc.text }}>{sc.label}</span>
            {days !== null && detailDomain.expiration_date && (
              <span className="text-xs" style={{ color: ds === 'expiring' || ds === 'expired' ? sc.color : 'var(--text-muted)' }}>
                {days >= 0 ? `Expiruje za ${days} dní` : `Expirovala před ${Math.abs(days)} dny`}
              </span>
            )}
          </div>

          {/* Detail rows */}
          {[
            { label: 'Registrátor', value: detailDomain.registrar },
            { label: 'Datum registrace', value: fmtDate(detailDomain.registration_date) },
            { label: 'Datum expirace', value: fmtDate(detailDomain.expiration_date) },
            { label: 'Firma', value: detailDomain.company_name },
            { label: 'Projekt', value: detailDomain.project_name },
            ...(subName ? [{ label: 'Předplatné', value: subName }] : []),
          ].filter(r => r.value && r.value !== '–').map(r => (
            <div key={r.label} className="flex justify-between py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-muted)' }}>{r.label}</span>
              <span className="font-medium text-right" style={{ color: 'var(--text-primary)' }}>{r.value}</span>
            </div>
          ))}

          {/* Target URL */}
          {detailDomain.target_url && (
            <div className="flex justify-between py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Cíl / URL</span>
              <a href={detailDomain.target_url.startsWith('http') ? detailDomain.target_url : `https://${detailDomain.target_url}`}
                target="_blank" rel="noopener noreferrer"
                className="font-medium flex items-center gap-1 text-right"
                style={{ color: 'var(--primary)' }}>
                {detailDomain.target_url} {ICONS.link}
              </a>
            </div>
          )}

          {/* Notes */}
          {detailDomain.notes && (
            <div className="pt-2">
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Poznámky</p>
              <p className="whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{detailDomain.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

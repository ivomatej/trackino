'use client';

import { ICONS } from './constants';
import type { Domain, DomainRegistrar } from './types';

interface Props {
  registrars: DomainRegistrar[];
  domains: Domain[];
  canManage: boolean;
  onNewReg: () => void;
  onEditReg: (r: DomainRegistrar) => void;
  onDeleteReg: (id: string) => void;
}

export function RegistrarsTabContent({ registrars, domains, canManage, onNewReg, onEditReg, onDeleteReg }: Props) {
  return (
    <>
      {canManage && (
        <div className="flex justify-end">
          <button
            onClick={onNewReg}
            className="px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors flex items-center gap-2"
            style={{ background: 'var(--primary)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--primary)'}
          >
            {ICONS.plus} Přidat registrátora
          </button>
        </div>
      )}

      {registrars.length === 0 ? (
        <div className="rounded-xl border px-6 py-12 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Zatím žádní registrátoři. Přidejte prvního registrátora.</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          {/* Desktop tabulka */}
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Název</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Web</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Počet domén</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Poznámky</th>
                  {canManage && <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--text-muted)' }}>Akce</th>}
                </tr>
              </thead>
              <tbody>
                {registrars.map(r => {
                  const domainCount = domains.filter(d => d.registrar === r.name).length;
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span style={{ color: 'var(--text-muted)' }}>{ICONS.server}</span>
                          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{r.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {r.website_url ? (
                          <a href={r.website_url.startsWith('http') ? r.website_url : `https://${r.website_url}`}
                            target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-sm"
                            style={{ color: 'var(--primary)' }}>
                            {r.website_url.replace(/^https?:\/\//, '')} {ICONS.link}
                          </a>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>–</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
                          style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                          {domainCount}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <span className="truncate block text-sm" style={{ color: 'var(--text-muted)' }}>{r.notes || '–'}</span>
                      </td>
                      {canManage && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              className="p-1.5 rounded transition-colors"
                              style={{ color: 'var(--text-muted)' }}
                              onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
                              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                              title="Upravit"
                              onClick={() => onEditReg(r)}
                            >{ICONS.edit}</button>
                            <button
                              className="p-1.5 rounded transition-colors"
                              style={{ color: 'var(--text-muted)' }}
                              onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                              title="Smazat"
                              onClick={() => onDeleteReg(r.id)}
                            >{ICONS.trash}</button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobilní karty */}
          <div className="md:hidden divide-y" style={{ borderColor: 'var(--border)' }}>
            {registrars.map(r => {
              const domainCount = domains.filter(d => d.registrar === r.name).length;
              return (
                <div key={r.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <span style={{ color: 'var(--text-muted)' }}>{ICONS.server}</span>
                      <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{r.name}</span>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold flex-shrink-0"
                      style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                      {domainCount} domén
                    </span>
                  </div>
                  {r.website_url && (
                    <a href={r.website_url.startsWith('http') ? r.website_url : `https://${r.website_url}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-xs flex items-center gap-1 mb-1"
                      style={{ color: 'var(--primary)' }}>
                      {r.website_url.replace(/^https?:\/\//, '')} {ICONS.link}
                    </a>
                  )}
                  {r.notes && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.notes}</p>}
                  {canManage && (
                    <div className="flex items-center gap-1 mt-2">
                      <button
                        className="p-1.5 rounded transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                        title="Upravit"
                        onClick={() => onEditReg(r)}
                      >{ICONS.edit}</button>
                      <button
                        className="p-1.5 rounded transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                        title="Smazat"
                        onClick={() => onDeleteReg(r.id)}
                      >{ICONS.trash}</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

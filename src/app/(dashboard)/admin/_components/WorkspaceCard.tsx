'use client';

import { formatPhone } from '@/lib/utils';
import { CopyBtn } from './CopyBtn';
import { TARIFF_LABELS } from './types';
import { fmtDate } from './utils';
import type { WorkspaceExt } from './types';

interface Props {
  ws: WorkspaceExt;
  copiedId: string | null;
  setCopiedId: (v: string | null) => void;
  onToggleLock: (ws: WorkspaceExt) => void;
  onArchive: (ws: WorkspaceExt) => void;
  onRestore: (ws: WorkspaceExt) => void;
  onSoftDelete: (ws: WorkspaceExt) => void;
  onHardDelete: (ws: WorkspaceExt) => void;
  onEdit: (ws: WorkspaceExt) => void;
}

export function WorkspaceCard({
  ws, copiedId, setCopiedId,
  onToggleLock, onArchive, onRestore, onSoftDelete, onHardDelete, onEdit,
}: Props) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}
    >
      <div className="flex flex-wrap items-start gap-3">
        {/* Barevný avatar */}
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-0.5"
          style={{ background: ws.color ?? 'var(--primary)' }}
        >
          {ws.name.charAt(0).toUpperCase()}
        </div>

        {/* Obsah */}
        <div className="flex-1 min-w-0">
          {/* Název + badges */}
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{ws.name}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
              {TARIFF_LABELS[ws.tariff]}
            </span>
            {ws.locked && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-600">Zamčeno</span>
            )}
            {ws.archived_at && !ws.deleted_at && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: '#f0fdf4', color: '#15803d' }}>
                Archivováno {fmtDate(ws.archived_at)}
              </span>
            )}
            {ws.deleted_at && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: '#fef2f2', color: '#dc2626' }}>
                Smazáno {fmtDate(ws.deleted_at)}
              </span>
            )}
          </div>

          {/* Stats */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
            <span className="inline-flex items-center gap-1">
              <span>Kód:</span>
              <span className="font-mono font-medium" style={{ color: 'var(--text-secondary)' }}>{ws.join_code}</span>
              <CopyBtn value={ws.join_code} id={`code-${ws.id}`} activeId={copiedId} setActiveId={setCopiedId} size={12} />
            </span>
            <span style={{ color: 'var(--border)' }}>·</span>
            <span>Vytvořeno {fmtDate(ws.created_at)}</span>
            <span style={{ color: 'var(--border)' }}>·</span>
            <span>
              {ws.memberCount} {ws.memberCount === 1 ? 'člen' : ws.memberCount < 5 ? 'členové' : 'členů'}
            </span>
            <span style={{ color: 'var(--border)' }}>·</span>
            <span className="inline-flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              {ws.activeCount} aktivních / 30 dní
            </span>
          </div>

          {/* Admin profil */}
          {ws.adminProfile && (
            <div className="flex items-center gap-2 flex-wrap">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                style={{ background: ws.adminProfile.avatar_color ?? '#6366f1' }}
              >
                {(ws.adminProfile.display_name ?? ws.adminProfile.email ?? '?')[0].toUpperCase()}
              </div>
              <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                {ws.adminProfile.display_name ?? ws.adminProfile.email}
              </span>
              {ws.adminProfile.email && (
                <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <span>{ws.adminProfile.email}</span>
                  <CopyBtn value={ws.adminProfile.email} id={`email-${ws.id}`} activeId={copiedId} setActiveId={setCopiedId} size={11} />
                </span>
              )}
              {ws.adminProfile.phone && (
                <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <span>{formatPhone(ws.adminProfile.phone)}</span>
                  <CopyBtn value={ws.adminProfile.phone} id={`phone-${ws.id}`} activeId={copiedId} setActiveId={setCopiedId} size={11} />
                </span>
              )}
            </div>
          )}
        </div>

        {/* Akční tlačítka – na mobilu celá šířka, na desktopu vpravo */}
        <div className="w-full sm:w-auto flex flex-col gap-1.5 items-start sm:items-end sm:flex-shrink-0">
          {!ws.deleted_at && (
            <>
              <div className="flex items-center gap-1.5 flex-wrap justify-start sm:justify-end">
                <button
                  onClick={() => onToggleLock(ws)}
                  className="px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors"
                  style={{ borderColor: 'var(--border)', color: ws.locked ? '#16a34a' : '#dc2626' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {ws.locked ? 'Odemknout' : 'Zamknout'}
                </button>
                {!ws.archived_at ? (
                  <button
                    onClick={() => onArchive(ws)}
                    className="px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    Archivovat
                  </button>
                ) : (
                  <button
                    onClick={() => onRestore(ws)}
                    className="px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors"
                    style={{ borderColor: '#16a34a', color: '#16a34a' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    Obnovit
                  </button>
                )}
                <button
                  onClick={() => onSoftDelete(ws)}
                  className="px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors"
                  style={{ borderColor: 'var(--border)', color: '#dc2626' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  Smazat
                </button>
                <button
                  onClick={() => onEdit(ws)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium text-white transition-colors"
                  style={{ background: 'var(--primary)' }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  Upravit
                </button>
              </div>
            </>
          )}
          {ws.deleted_at && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onRestore(ws)}
                className="px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors"
                style={{ borderColor: '#16a34a', color: '#16a34a' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                Obnovit
              </button>
              <button
                onClick={() => onHardDelete(ws)}
                className="px-2.5 py-1 rounded-lg text-xs font-medium text-white transition-colors"
                style={{ background: 'var(--danger)' }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                Trvale smazat
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import type { BookmarkFolder, Bookmark, Member } from './types';
import { getInitials } from './utils';

// ── Folder Modal ──────────────────────────────────────────────────────────────

interface FolderModalProps {
  folderModal: { open: boolean; parentId: string | null; editing: BookmarkFolder | null };
  setFolderModal: (v: { open: boolean; parentId: string | null; editing: BookmarkFolder | null }) => void;
  folderName: string;
  setFolderName: (v: string) => void;
  saveFolder: () => void;
}

export function FolderModal({ folderModal, setFolderModal, folderName, setFolderName, saveFolder }: FolderModalProps) {
  if (!folderModal.open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={() => setFolderModal({ open: false, parentId: null, editing: null })}>
      <div className="w-80 p-5 rounded-2xl border shadow-xl"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        onClick={e => e.stopPropagation()}>
        <h2 className="font-semibold mb-4 text-sm" style={{ color: 'var(--text-primary)' }}>
          {folderModal.editing ? 'Přejmenovat složku' : 'Nová složka'}
        </h2>
        <input value={folderName} onChange={e => setFolderName(e.target.value)} placeholder="Název složky" autoFocus
          onKeyDown={e => e.key === 'Enter' && saveFolder()}
          className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }} />
        <div className="flex gap-2 mt-4">
          <button onClick={saveFolder} className="flex-1 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--primary)' }}>Uložit</button>
          <button onClick={() => setFolderModal({ open: false, parentId: null, editing: null })}
            className="flex-1 py-2 rounded-lg text-sm font-medium border"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>Zrušit</button>
        </div>
      </div>
    </div>
  );
}

// ── Share Modal ───────────────────────────────────────────────────────────────

interface ShareModalProps {
  shareModal: { open: boolean; folder: BookmarkFolder | null };
  setShareModal: (v: { open: boolean; folder: BookmarkFolder | null }) => void;
  shareType: 'none' | 'workspace' | 'users';
  setShareType: (v: 'none' | 'workspace' | 'users') => void;
  shareUserIds: string[];
  setShareUserIds: (v: string[] | ((prev: string[]) => string[])) => void;
  members: Member[];
  userId: string;
  saveShare: () => void;
}

export function ShareModal({
  shareModal, setShareModal, shareType, setShareType,
  shareUserIds, setShareUserIds, members, userId, saveShare,
}: ShareModalProps) {
  if (!shareModal.open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={() => setShareModal({ open: false, folder: null })}>
      <div className="w-96 p-5 rounded-2xl border shadow-xl"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        onClick={e => e.stopPropagation()}>
        <h2 className="font-semibold mb-1 text-sm" style={{ color: 'var(--text-primary)' }}>
          Sdílet složku „{shareModal.folder?.name}"
        </h2>
        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
          Určete, kdo může složku a její záložky vidět
        </p>
        <div className="space-y-2 mb-4">
          {([
            { id: 'none', label: 'Nesdílet s nikým', desc: 'Složka zůstane soukromá' },
            { id: 'workspace', label: 'Celý workspace', desc: 'Vidí všichni členové' },
            { id: 'users', label: 'Konkrétní uživatelé', desc: 'Vybraní členové' },
          ] as const).map(t => (
            <label key={t.id} className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer"
              style={{ borderColor: shareType === t.id ? 'var(--primary)' : 'var(--border)', background: shareType === t.id ? 'var(--bg-active)' : 'transparent' }}>
              <input type="radio" checked={shareType === t.id} onChange={() => setShareType(t.id)} className="accent-[var(--primary)]" />
              <div>
                <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t.label}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{t.desc}</div>
              </div>
            </label>
          ))}
        </div>
        {shareType === 'users' && (
          <div className="mb-4 max-h-48 overflow-y-auto space-y-1 rounded-xl border p-2" style={{ borderColor: 'var(--border)' }}>
            {members.filter(m => m.user_id !== userId).length === 0 && (
              <p className="text-xs px-2 py-1" style={{ color: 'var(--text-muted)' }}>Žádní další členové workspace</p>
            )}
            {members.filter(m => m.user_id !== userId).map(m => {
              const isChecked = shareUserIds.includes(m.user_id);
              return (
                <label key={m.user_id}
                  className="flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer transition-colors"
                  style={{ background: isChecked ? 'var(--bg-active)' : 'transparent' }}
                  onMouseEnter={e => { if (!isChecked) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isChecked ? 'var(--bg-active)' : 'transparent'; }}
                >
                  <input type="checkbox" checked={isChecked}
                    onChange={e => setShareUserIds(prev => e.target.checked ? [...prev, m.user_id] : prev.filter(id => id !== m.user_id))}
                    className="accent-[var(--primary)] flex-shrink-0" />
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ background: m.avatar_color ?? 'var(--primary)' }}>
                    {getInitials(m.display_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{m.display_name}</div>
                    <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{m.email}</div>
                  </div>
                </label>
              );
            })}
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={saveShare} className="flex-1 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--primary)' }}>Uložit</button>
          <button onClick={() => setShareModal({ open: false, folder: null })}
            className="flex-1 py-2 rounded-lg text-sm font-medium border"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>Zrušit</button>
        </div>
      </div>
    </div>
  );
}

// ── Bookmark Modal ────────────────────────────────────────────────────────────

interface BookmarkModalProps {
  bmModal: { open: boolean; editing: Bookmark | null };
  setBmModal: (v: { open: boolean; editing: Bookmark | null }) => void;
  bmTitle: string;
  setBmTitle: (v: string) => void;
  bmUrl: string;
  setBmUrl: (v: string) => void;
  bmDesc: string;
  setBmDesc: (v: string) => void;
  bmFolderId: string | null;
  setBmFolderId: (v: string | null) => void;
  bmIsShared: boolean;
  setBmIsShared: (v: boolean) => void;
  bmSaving: boolean;
  folders: BookmarkFolder[];
  saveBm: () => void;
}

export function BookmarkModal({
  bmModal, setBmModal, bmTitle, setBmTitle, bmUrl, setBmUrl,
  bmDesc, setBmDesc, bmFolderId, setBmFolderId, bmIsShared, setBmIsShared,
  bmSaving, folders, saveBm,
}: BookmarkModalProps) {
  if (!bmModal.open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => setBmModal({ open: false, editing: null })}>
      <div className="w-full max-w-lg p-5 rounded-2xl border shadow-xl"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        onClick={e => e.stopPropagation()}>
        <h2 className="font-semibold mb-4 text-sm" style={{ color: 'var(--text-primary)' }}>
          {bmModal.editing ? 'Upravit záložku' : 'Nová záložka'}
        </h2>
        <div className="space-y-3">
          <input value={bmTitle} onChange={e => setBmTitle(e.target.value)} placeholder="Název záložky" autoFocus
            className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }} />
          <input value={bmUrl} onChange={e => setBmUrl(e.target.value)} placeholder="URL (např. https://example.com)"
            className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }} />
          <textarea value={bmDesc} onChange={e => setBmDesc(e.target.value)} placeholder="Popis (volitelné)" rows={4}
            className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }} />
          <div className="relative">
            <select value={bmFolderId ?? ''} onChange={e => setBmFolderId(e.target.value || null)}
              className="appearance-none pr-8 w-full px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}>
              <option value="">— Bez složky —</option>
              {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={bmIsShared} onChange={e => setBmIsShared(e.target.checked)} className="accent-[var(--primary)]" />
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Sdílet s celým workspacem</span>
          </label>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={saveBm} disabled={bmSaving || !bmTitle.trim() || !bmUrl.trim()}
            className="flex-1 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: 'var(--primary)' }}>
            {bmSaving ? 'Ukládám…' : 'Uložit'}
          </button>
          <button onClick={() => setBmModal({ open: false, editing: null })}
            className="flex-1 py-2 rounded-lg text-sm font-medium border"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>Zrušit</button>
        </div>
      </div>
    </div>
  );
}

'use client';

import type { PromptFolder, Prompt, Member } from './types';
import { RichEditor } from './RichEditor';
import { getInitials } from './utils';

interface PromptModalsProps {
  // Folder modal
  folderModal: { open: boolean; parentId: string | null; editing: PromptFolder | null };
  setFolderModal: (v: { open: boolean; parentId: string | null; editing: PromptFolder | null }) => void;
  folderName: string;
  setFolderName: (v: string) => void;
  saveFolder: () => void;
  // Share modal
  shareModal: { open: boolean; folder: PromptFolder | null };
  setShareModal: (v: { open: boolean; folder: PromptFolder | null }) => void;
  shareType: 'none' | 'workspace' | 'users';
  setShareType: (v: 'none' | 'workspace' | 'users') => void;
  shareUserIds: string[];
  setShareUserIds: (fn: (prev: string[]) => string[]) => void;
  saveShare: () => void;
  members: Member[];
  userId: string;
  // Prompt modal
  promptModal: { open: boolean; editing: Prompt | null };
  setPromptModal: (v: { open: boolean; editing: Prompt | null }) => void;
  pmTitle: string;
  setPmTitle: (v: string) => void;
  pmContent: string;
  setPmContent: (v: string) => void;
  pmIsShared: boolean;
  setPmIsShared: (v: boolean) => void;
  pmFolderId: string | null;
  setPmFolderId: (v: string | null) => void;
  pmSaving: boolean;
  savePrompt: () => void;
  folders: PromptFolder[];
}

export function PromptModals({
  folderModal, setFolderModal, folderName, setFolderName, saveFolder,
  shareModal, setShareModal, shareType, setShareType, shareUserIds, setShareUserIds, saveShare, members, userId,
  promptModal, setPromptModal, pmTitle, setPmTitle, pmContent, setPmContent, pmIsShared, setPmIsShared, pmFolderId, setPmFolderId, pmSaving, savePrompt, folders,
}: PromptModalsProps) {
  return (
    <>
      {/* ── Folder Modal ── */}
      {folderModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setFolderModal({ open: false, parentId: null, editing: null })}>
          <div className="w-80 p-5 rounded-2xl border shadow-xl" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }} onClick={e => e.stopPropagation()}>
            <h2 className="font-semibold mb-4 text-sm" style={{ color: 'var(--text-primary)' }}>{folderModal.editing ? 'Přejmenovat složku' : 'Nová složka'}</h2>
            <input value={folderName} onChange={e => setFolderName(e.target.value)} placeholder="Název složky" autoFocus
              onKeyDown={e => e.key === 'Enter' && saveFolder()}
              className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }} />
            <div className="flex gap-2 mt-4">
              <button onClick={saveFolder} className="flex-1 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--primary)' }}>Uložit</button>
              <button onClick={() => setFolderModal({ open: false, parentId: null, editing: null })} className="flex-1 py-2 rounded-lg text-sm font-medium border" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>Zrušit</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Share Modal ── */}
      {shareModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShareModal({ open: false, folder: null })}>
          <div className="w-96 p-5 rounded-2xl border shadow-xl" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }} onClick={e => e.stopPropagation()}>
            <h2 className="font-semibold mb-1 text-sm" style={{ color: 'var(--text-primary)' }}>Sdílet složku „{shareModal.folder?.name}"</h2>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Určete, kdo může složku a její obsah vidět</p>
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
              <button onClick={() => setShareModal({ open: false, folder: null })} className="flex-1 py-2 rounded-lg text-sm font-medium border" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>Zrušit</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Prompt Modal ── */}
      {promptModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border shadow-xl" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="p-5">
              <h2 className="font-semibold mb-4 text-sm" style={{ color: 'var(--text-primary)' }}>{promptModal.editing ? 'Upravit prompt' : 'Nový prompt'}</h2>
              <div className="space-y-4">
                <input value={pmTitle} onChange={e => setPmTitle(e.target.value)} placeholder="Název promptu" autoFocus
                  className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }} />
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Složka</label>
                  <div className="relative">
                    <select value={pmFolderId ?? ''} onChange={e => setPmFolderId(e.target.value || null)}
                      className="w-full px-3 py-2 rounded-lg border text-base sm:text-sm focus:outline-none appearance-none pr-8"
                      style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}>
                      <option value="">— Bez složky —</option>
                      {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                    <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Obsah</label>
                  <RichEditor value={pmContent} onChange={setPmContent} />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={pmIsShared} onChange={e => setPmIsShared(e.target.checked)} className="accent-[var(--primary)]" />
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Sdílet s celým workspacem</span>
                </label>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={savePrompt} disabled={pmSaving || !pmTitle.trim()}
                  className="flex-1 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: 'var(--primary)' }}>
                  {pmSaving ? 'Ukládám…' : 'Uložit'}
                </button>
                <button onClick={() => setPromptModal({ open: false, editing: null })}
                  className="flex-1 py-2 rounded-lg text-sm font-medium border"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>Zrušit</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

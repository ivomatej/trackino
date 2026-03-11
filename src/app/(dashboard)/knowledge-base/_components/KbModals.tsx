'use client';

import type { KbFolder } from '@/types/database';
import type { KbMember } from './types';
import { TEMPLATES } from './types';

// ── Typy pro modály ───────────────────────────────────────────────────────────

export interface FolderModalState {
  mode: 'add' | 'edit';
  parentId: string | null;
  depth: number;
  target: KbFolder | null;
  name: string;
}

export interface ShareModalState {
  open: boolean;
  folder: KbFolder | null;
}

export interface TemplateModalState {
  folderId: string | null;
}

export interface KbModalsProps {
  // Folder modal
  folderModal: FolderModalState | null;
  setFolderModal: (v: FolderModalState | null) => void;
  saveFolder: () => void;

  // Share modal
  shareModal: ShareModalState;
  setShareModal: (v: ShareModalState) => void;
  shareType: 'none' | 'workspace' | 'users';
  setShareType: (v: 'none' | 'workspace' | 'users') => void;
  shareUserIds: string[];
  setShareUserIds: React.Dispatch<React.SetStateAction<string[]>>;
  saveShare: () => void;

  // Template modal
  templateModal: TemplateModalState | null;
  setTemplateModal: (v: TemplateModalState | null) => void;
  createPageFromTemplate: (t: typeof TEMPLATES[number], folderId: string | null) => void;

  // Review modal
  reviewModal: boolean;
  setReviewModal: (v: boolean) => void;
  reviewForm: { assigned_to: string; review_date: string; note: string };
  setReviewForm: React.Dispatch<React.SetStateAction<{ assigned_to: string; review_date: string; note: string }>>;
  addReview: () => void;
  savingReview: boolean;

  // Shared data
  members: KbMember[];
  userId?: string;
}

// ── KbModals ──────────────────────────────────────────────────────────────────

export default function KbModals({
  folderModal, setFolderModal, saveFolder,
  shareModal, setShareModal, shareType, setShareType, shareUserIds, setShareUserIds, saveShare,
  templateModal, setTemplateModal, createPageFromTemplate,
  reviewModal, setReviewModal, reviewForm, setReviewForm, addReview, savingReview,
  members, userId,
}: KbModalsProps) {
  return (
    <>
      {/* FOLDER MODAL */}
      {folderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="rounded-2xl border p-6 w-full max-w-sm shadow-xl" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              {folderModal.mode === 'add' ? 'Nová složka' : 'Přejmenovat složku'}
            </h3>
            <input value={folderModal.name} onChange={e => setFolderModal({ ...folderModal, name: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') saveFolder(); if (e.key === 'Escape') setFolderModal(null); }}
              placeholder="Název složky" autoFocus className="w-full px-3 py-2 rounded-xl border mb-4 text-base sm:text-sm"
              style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
            <div className="flex gap-3">
              <button type="button" onClick={saveFolder} className="flex-1 py-2 rounded-xl text-sm font-medium" style={{ background: 'var(--primary)', color: '#fff' }}>Uložit</button>
              <button type="button" onClick={() => setFolderModal(null)} className="flex-1 py-2 rounded-xl text-sm border" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Zrušit</button>
            </div>
          </div>
        </div>
      )}

      {/* SHARE FOLDER MODAL */}
      {shareModal.open && shareModal.folder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShareModal({ open: false, folder: null })}>
          <div className="w-96 p-5 rounded-2xl border shadow-xl" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }} onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>Sdílet složku „{shareModal.folder.name}"</h2>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Určete, kdo může složku a její stránky vidět</p>
            <div className="space-y-2 mb-4">
              {([
                { id: 'none' as const, label: 'Nesdílet s nikým', desc: 'Složka zůstane soukromá' },
                { id: 'workspace' as const, label: 'Celý workspace', desc: 'Vidí všichni členové' },
                { id: 'users' as const, label: 'Konkrétní uživatelé', desc: 'Vybraní členové' },
              ]).map(t => (
                <label key={t.id} className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors"
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
                {members.filter(m => m.user_id !== userId).map(m => (
                  <label key={m.user_id} className="flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer transition-colors"
                    style={{ background: shareUserIds.includes(m.user_id) ? 'var(--bg-active)' : 'transparent' }}
                    onMouseEnter={e => { if (!shareUserIds.includes(m.user_id)) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={e => { if (!shareUserIds.includes(m.user_id)) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                    <input type="checkbox" checked={shareUserIds.includes(m.user_id)}
                      onChange={() => setShareUserIds(prev => prev.includes(m.user_id) ? prev.filter(id => id !== m.user_id) : [...prev, m.user_id])}
                      className="accent-[var(--primary)]" />
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0" style={{ background: m.avatar_color }}>
                      {m.display_name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{m.display_name}</div>
                      {m.email && <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{m.email}</div>}
                    </div>
                  </label>
                ))}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShareModal({ open: false, folder: null })} className="px-3 py-1.5 rounded-lg text-sm border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>Zrušit</button>
              <button type="button" onClick={saveShare} className="px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--primary)' }}>Uložit</button>
            </div>
          </div>
        </div>
      )}

      {/* TEMPLATE MODAL */}
      {templateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="rounded-2xl border p-6 w-full max-w-lg shadow-xl" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Vyberte šablonu</h3>
              <button type="button" onClick={() => setTemplateModal(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TEMPLATES.map(t => (
                <button key={t.id} type="button" onClick={() => createPageFromTemplate(t, templateModal.folderId)}
                  className="text-left p-4 rounded-xl border hover:border-[var(--primary)] hover:bg-[var(--bg-hover)] transition-colors"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
                  <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{t.title}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* REVIEW MODAL */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="rounded-2xl border p-6 w-full max-w-sm shadow-xl" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Přidat revizi</h3>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Přiřadit uživateli</label>
            <div className="relative mb-3">
              <select value={reviewForm.assigned_to} onChange={e => setReviewForm(prev => ({ ...prev, assigned_to: e.target.value }))}
                className="w-full appearance-none px-3 py-2 rounded-xl border text-base sm:text-sm pr-8"
                style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                <option value="">Vyberte uživatele…</option>
                {members.map(m => <option key={m.user_id} value={m.user_id}>{m.display_name}</option>)}
              </select>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Termín revize</label>
            <input type="date" value={reviewForm.review_date} onChange={e => setReviewForm(prev => ({ ...prev, review_date: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border mb-3 text-base sm:text-sm"
              style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)', transform: 'translateZ(0)' }} />
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Poznámka (volitelné)</label>
            <input value={reviewForm.note} onChange={e => setReviewForm(prev => ({ ...prev, note: e.target.value }))}
              placeholder="Co revidovat…" className="w-full px-3 py-2 rounded-xl border mb-4 text-base sm:text-sm"
              style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
            <div className="flex gap-3">
              <button type="button" onClick={addReview} disabled={!reviewForm.assigned_to || !reviewForm.review_date || savingReview}
                className="flex-1 py-2 rounded-xl text-sm font-medium" style={{ background: 'var(--primary)', color: '#fff', opacity: (!reviewForm.assigned_to || !reviewForm.review_date) ? 0.5 : 1 }}>
                {savingReview ? '...' : 'Uložit'}
              </button>
              <button type="button" onClick={() => setReviewModal(false)} className="flex-1 py-2 rounded-xl text-sm border" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Zrušit</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

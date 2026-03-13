'use client';

import React from 'react';
import type { Member, ShareModalState } from './types';
import { getInitials } from './utils';

interface ShareModalProps {
  shareModal: ShareModalState;
  setShareModal: React.Dispatch<React.SetStateAction<ShareModalState>>;
  shareType: 'none' | 'workspace' | 'users';
  setShareType: (t: 'none' | 'workspace' | 'users') => void;
  shareUserIds: string[];
  setShareUserIds: React.Dispatch<React.SetStateAction<string[]>>;
  members: Member[];
  userId: string;
  saveShare: () => Promise<void>;
}

const SHARE_OPTIONS = [
  { id: 'none' as const, label: 'Nesdílet s nikým', desc: 'Složka zůstane soukromá' },
  { id: 'workspace' as const, label: 'Celý workspace', desc: 'Vidí všichni členové' },
  { id: 'users' as const, label: 'Konkrétní uživatelé', desc: 'Vybraní členové' },
];

export function ShareModal({
  shareModal, setShareModal, shareType, setShareType,
  shareUserIds, setShareUserIds, members, userId, saveShare,
}: ShareModalProps) {
  if (!shareModal.open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={() => setShareModal({ open: false, folder: null })}>
      <div className="w-96 p-5 rounded-2xl border shadow-xl" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        onClick={e => e.stopPropagation()}>
        <h2 className="font-semibold mb-1 text-sm" style={{ color: 'var(--text-primary)' }}>
          Sdílet složku „{shareModal.folder?.name}"
        </h2>
        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
          Určete, kdo může složku a její dokumenty vidět
        </p>
        <div className="space-y-2 mb-4">
          {SHARE_OPTIONS.map(t => (
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
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isChecked ? 'var(--bg-active)' : 'transparent'; }}>
                  <input type="checkbox" checked={isChecked}
                    onChange={e => setShareUserIds(prev => e.target.checked ? [...prev, m.user_id] : prev.filter(id => id !== m.user_id))}
                    className="accent-[var(--primary)] flex-shrink-0" />
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ background: m.avatar_color }}>
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
          <button onClick={saveShare}
            className="flex-1 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--primary)' }}>
            Uložit
          </button>
          <button onClick={() => setShareModal({ open: false, folder: null })}
            className="flex-1 py-2 rounded-lg text-sm font-medium border" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
            Zrušit
          </button>
        </div>
      </div>
    </div>
  );
}

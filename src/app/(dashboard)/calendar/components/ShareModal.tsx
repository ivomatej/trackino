'use client';
// ─── Calendar Module – ShareModal ────────────────────────────────────────────
// Přesunuto z page.tsx (ř. 5624–5764)

import { useCalendarContext } from '../CalendarContext';

export default function ShareModal() {
  const {
    showShareModal, setShowShareModal,
    sharingCalendar, sharingSubscription,
    shareModalState, setShareModalState,
    workspaceMembers,
    shareError,
    savingShare, saveShare,
  } = useCalendarContext();

  if (!showShareModal) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md rounded-xl shadow-xl border overflow-y-auto" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', maxHeight: '88vh' }}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              Sdílení: {sharingCalendar?.name ?? sharingSubscription?.name}
            </h2>
            <button onClick={() => setShowShareModal(false)} className="p-1 rounded" style={{ color: 'var(--text-muted)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            {/* Sdílet s celým workspace */}
            <div className="p-3 rounded-lg border" style={{ borderColor: 'var(--border)', background: 'var(--bg-hover)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="share_workspace"
                    checked={shareModalState.shareWithWorkspace}
                    onChange={e => setShareModalState(s => ({ ...s, shareWithWorkspace: e.target.checked }))}
                    className="w-4 h-4 rounded cursor-pointer"
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <label htmlFor="share_workspace" className="text-sm cursor-pointer font-medium" style={{ color: 'var(--text-primary)' }}>
                    Sdílet s celým workspace
                  </label>
                </div>
                {shareModalState.shareWithWorkspace && (
                  <div className="flex items-center gap-1.5 text-xs flex-shrink-0 ml-3" style={{ color: 'var(--text-muted)' }}>
                    <span>Detaily</span>
                    <button
                      onClick={() => setShareModalState(s => ({ ...s, workspaceShowDetails: !s.workspaceShowDetails }))}
                      className="w-8 h-4 rounded-full relative transition-colors flex-shrink-0"
                      style={{ background: shareModalState.workspaceShowDetails ? 'var(--primary)' : 'var(--border)' }}
                    >
                      <span className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all shadow-sm" style={{ left: shareModalState.workspaceShowDetails ? '18px' : '2px' }} />
                    </button>
                  </div>
                )}
              </div>
              {shareModalState.shareWithWorkspace && !shareModalState.workspaceShowDetails && (
                <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                  Ostatní uvidí pouze „Nemá čas" – bez názvů ani detailů událostí.
                </p>
              )}
            </div>

            {/* Konkrétní uživatelé */}
            {workspaceMembers.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Nebo konkrétní uživatelé:</p>
                <div className="space-y-2.5">
                  {workspaceMembers.map(member => {
                    const existing = shareModalState.userShares.find(u => u.user_id === member.user_id);
                    const isEnabled = existing?.enabled ?? false;
                    const showDetails = existing?.show_details ?? true;
                    return (
                      <div key={member.user_id} className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: member.avatar_color }}>
                          {member.display_name.slice(0, 1).toUpperCase()}
                        </span>
                        <span className="text-sm flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{member.display_name}</span>
                        {isEnabled && (
                          <div className="flex items-center gap-1 text-xs flex-shrink-0 mr-1" style={{ color: 'var(--text-muted)' }}>
                            <span>Detaily</span>
                            <button
                              onClick={() => {
                                setShareModalState(s => ({
                                  ...s,
                                  userShares: s.userShares.map(u => u.user_id === member.user_id ? { ...u, show_details: !u.show_details } : u),
                                }));
                              }}
                              className="w-7 h-3.5 rounded-full relative transition-colors flex-shrink-0"
                              style={{ background: showDetails ? 'var(--primary)' : 'var(--border)' }}
                            >
                              <span className="absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all shadow-sm" style={{ left: showDetails ? '15px' : '2px' }} />
                            </button>
                          </div>
                        )}
                        <button
                          onClick={() => {
                            setShareModalState(s => {
                              const has = s.userShares.find(u => u.user_id === member.user_id);
                              if (has) {
                                return { ...s, userShares: s.userShares.filter(u => u.user_id !== member.user_id) };
                              } else {
                                return { ...s, userShares: [...s.userShares, { user_id: member.user_id, enabled: true, show_details: true }] };
                              }
                            });
                          }}
                          className="w-8 h-4 rounded-full relative transition-colors flex-shrink-0"
                          style={{ background: isEnabled ? 'var(--primary)' : 'var(--border)' }}
                        >
                          <span className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all shadow-sm" style={{ left: isEnabled ? '18px' : '2px' }} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {workspaceMembers.length === 0 && (
              <p className="text-xs text-center py-2" style={{ color: 'var(--text-muted)' }}>
                Ve workspace nejsou žádní další členové.
              </p>
            )}
          </div>

          {shareError && (
            <p className="mt-4 text-xs rounded-lg px-3 py-2" style={{ color: '#ef4444', background: '#ef444415' }}>
              {shareError}
            </p>
          )}

          <div className="flex gap-2 justify-end mt-4">
            <button
              onClick={() => { setShowShareModal(false); }}
              className="px-4 py-2 rounded-lg text-sm border"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              Zrušit
            </button>
            <button
              onClick={saveShare}
              disabled={savingShare}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
              style={{ background: 'var(--primary)' }}
            >
              {savingShare ? 'Ukládám...' : 'Uložit sdílení'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

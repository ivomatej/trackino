'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { useRequests } from './useRequests';
import { StatusBadge } from './StatusBadge';
import { RequestFormModal } from './RequestFormModal';
import { RejectModal } from './RejectModal';
import { REQUEST_TYPE_LABELS, CATEGORY_GUIDE } from './types';
import { initials } from './utils';

export function RequestsContent() {
  const {
    myRequests, pendingRequests, archivedRequests,
    loading, activeTab, setActiveTab,
    showForm, setShowForm, saving,
    formType, setFormType, formTitle, setFormTitle, formNote, setFormNote,
    rejectModal, setRejectModal, rejecting, approving,
    showGuide, setShowGuide,
    canProcessRequests,
    submitRequest, approveRequest, rejectRequest, deleteRequest,
  } = useRequests();

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <DashboardLayout moduleName="Žádosti">
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout moduleName="Žádosti">
      <div className="max-w-3xl">
        {/* Záhlaví */}
        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Žádosti</h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Podávejte formální žádosti svému nadřízenému ke schválení
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white flex-shrink-0"
            style={{ background: 'var(--primary)' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nová žádost
          </button>
        </div>

        {/* Průvodce kategoriemi */}
        <div className="mb-5 rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={() => setShowGuide(g => !g)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors"
            style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
          >
            <div className="flex items-center gap-2">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              Průvodce kategoriemi – co kam spadá
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: showGuide ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {showGuide && (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {CATEGORY_GUIDE.map(cat => (
                <div key={cat.title} className="px-4 py-3" style={{ background: 'var(--bg-card)' }}>
                  <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>{cat.title}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{cat.desc}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Záložky */}
        {canProcessRequests && (
          <div className="flex gap-1 p-1 rounded-xl mb-6 w-fit" style={{ background: 'var(--bg-hover)' }}>
            {([
              { key: 'mine' as const, label: 'Moje žádosti', count: 0 },
              { key: 'pending' as const, label: 'Ke zpracování', count: pendingRequests.length },
              { key: 'archive' as const, label: 'Archiv', count: 0 },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: activeTab === tab.key ? 'var(--bg-card)' : 'transparent',
                  color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: activeTab === tab.key ? 'var(--shadow-sm)' : 'none',
                }}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span
                    className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold text-white"
                    style={{ background: 'var(--danger)' }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* ── Tab: Moje žádosti ── */}
        {activeTab === 'mine' && (
          <div className="space-y-3">
            {myRequests.length === 0 ? (
              <div className="rounded-xl border p-10 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="9" y1="13" x2="15" y2="13" />
                  <line x1="9" y1="17" x2="11" y2="17" />
                </svg>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Zatím žádné žádosti. Klikněte na „Nová žádost" pro podání první žádosti.</p>
              </div>
            ) : (
              myRequests.map(req => (
                <div key={req.id} className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
                          {REQUEST_TYPE_LABELS[req.type]}
                        </span>
                        <StatusBadge status={req.status} />
                      </div>
                      <h3 className="font-semibold text-sm mt-1.5" style={{ color: 'var(--text-primary)' }}>{req.title}</h3>
                    </div>
                    <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                      {new Date(req.created_at).toLocaleDateString('cs-CZ')}
                    </span>
                  </div>

                  {req.note && (
                    <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>{req.note}</p>
                  )}

                  {/* Zamítnutí – poznámka */}
                  {req.status === 'rejected' && req.reviewer_note && (
                    <div className="mt-2 p-2 rounded-lg text-xs" style={{ background: '#fee2e222', borderLeft: '3px solid #ef4444', color: 'var(--text-secondary)' }}>
                      <strong style={{ color: '#ef4444' }}>Důvod zamítnutí:</strong> {req.reviewer_note}
                      {req.reviewerProfile && (
                        <span className="ml-1" style={{ color: 'var(--text-muted)' }}>— {req.reviewerProfile.display_name}</span>
                      )}
                    </div>
                  )}

                  {/* Schválení info */}
                  {req.status === 'approved' && req.reviewerProfile && (
                    <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                      Schválil/a: {req.reviewerProfile.display_name}
                      {req.reviewed_at && ` (${new Date(req.reviewed_at).toLocaleDateString('cs-CZ')})`}
                    </p>
                  )}

                  {/* Akce – smazání zamítnutých/pending */}
                  {(req.status === 'rejected' || req.status === 'pending') && (
                    <div className="flex justify-end mt-3">
                      <button
                        onClick={() => deleteRequest(req.id)}
                        className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                        style={{ color: '#ef4444' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#fee2e244')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        Smazat
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Tab: Ke zpracování ── */}
        {activeTab === 'pending' && canProcessRequests && (
          <div className="space-y-3">
            {pendingRequests.length === 0 ? (
              <div className="rounded-xl border p-10 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                  <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Žádné čekající žádosti. Vše je vyřízeno!</p>
              </div>
            ) : (
              pendingRequests.map(req => (
                <div key={req.id} className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                  {/* Uživatel */}
                  {req.profile && (
                    <div className="flex items-center gap-2 mb-3">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                        style={{ background: req.profile.avatar_color }}
                      >
                        {initials(req.profile.display_name)}
                      </div>
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{req.profile.display_name}</span>
                      <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
                        {new Date(req.created_at).toLocaleDateString('cs-CZ')}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
                      {REQUEST_TYPE_LABELS[req.type]}
                    </span>
                    <StatusBadge status={req.status} />
                  </div>

                  <h3 className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>{req.title}</h3>

                  {req.note && (
                    <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>{req.note}</p>
                  )}

                  {/* Akce */}
                  <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                    <button
                      onClick={() => setRejectModal({ id: req.id, note: '' })}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                      style={{ borderColor: 'var(--danger)', color: 'var(--danger)', background: 'transparent' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--danger-light)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      Zamítnout
                    </button>
                    <button
                      onClick={() => approveRequest(req)}
                      disabled={approving === req.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                      style={{ background: 'var(--success)' }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      {approving === req.id ? '...' : 'Schválit'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Tab: Archiv ── */}
        {activeTab === 'archive' && canProcessRequests && (
          <div className="space-y-3">
            {archivedRequests.length === 0 ? (
              <div className="rounded-xl border p-10 text-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                  <polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" />
                </svg>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Archiv je prázdný. Vyřízené žádosti se zde zobrazí po schválení nebo zamítnutí.</p>
              </div>
            ) : (
              <>
                <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                  {archivedRequests.length} vyřízených žádostí · seřazeno od nejnovějšího rozhodnutí
                </p>
                {archivedRequests.map(req => (
                  <div key={req.id} className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      {/* Levá část: avatar + info */}
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5"
                          style={{ background: req.profile?.avatar_color ?? 'var(--primary)' }}
                        >
                          {req.profile ? initials(req.profile.display_name) : '?'}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {req.profile?.display_name ?? 'Neznámý uživatel'}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-0.5">
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
                              {REQUEST_TYPE_LABELS[req.type]}
                            </span>
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              Podáno {new Date(req.created_at).toLocaleDateString('cs-CZ')}
                            </span>
                          </div>
                          <h3 className="font-semibold text-sm mt-1.5" style={{ color: 'var(--text-primary)' }}>{req.title}</h3>
                          {req.note && (
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{req.note}</p>
                          )}
                          {/* Info o vyřízení */}
                          {req.reviewerProfile && req.reviewed_at && (
                            <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                              {req.status === 'approved' ? 'Schválil/a' : 'Zamítnul/a'}{' '}
                              <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>
                                {req.reviewerProfile.display_name}
                              </span>
                              {' · '}
                              {new Date(req.reviewed_at).toLocaleDateString('cs-CZ')}
                            </p>
                          )}
                        </div>
                      </div>
                      {/* Badge stavu – pouze Schváleno vpravo nahoře */}
                      <div className="flex-shrink-0">
                        {req.status === 'approved' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: '#dcfce7', color: '#166534' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                            Schváleno
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Badge Zamítnuto + Důvod zamítnutí – pod hlavním obsahem */}
                    {req.status === 'rejected' && (
                      <>
                        <div className="mt-3">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: '#fee2e2', color: '#991b1b' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            Zamítnuto
                          </span>
                        </div>
                        <div className="mt-2 px-3 py-2 rounded-lg text-xs" style={{ background: '#fee2e2', color: '#991b1b' }}>
                          {req.reviewer_note
                            ? <><strong>Důvod zamítnutí:</strong> {req.reviewer_note}</>
                            : 'Zamítnuto bez uvedení důvodu.'}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* ══ MODAL – Nová žádost ════════════════════════════════════════════════ */}
      {showForm && (
        <RequestFormModal
          formType={formType}
          setFormType={setFormType}
          formTitle={formTitle}
          setFormTitle={setFormTitle}
          formNote={formNote}
          setFormNote={setFormNote}
          saving={saving}
          onSubmit={submitRequest}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* ══ MODAL – Zamítnutí ══════════════════════════════════════════════════ */}
      {rejectModal && (
        <RejectModal
          note={rejectModal.note}
          setNote={note => setRejectModal(rejectModal ? { ...rejectModal, note } : null)}
          rejecting={rejecting}
          onReject={rejectRequest}
          onClose={() => setRejectModal(null)}
        />
      )}
    </DashboardLayout>
  );
}

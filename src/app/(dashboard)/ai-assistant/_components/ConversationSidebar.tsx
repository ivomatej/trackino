'use client';

import { AI_MODELS } from '@/lib/ai-providers';
import type { AiConversation } from '@/types/database';
import { fmtDate } from './utils';
import type { UseAiAssistantReturn } from './useAiAssistant';

interface Props {
  ai: UseAiAssistantReturn;
}

function ConvItem({
  conv,
  activeConvId,
  onLoad,
  onToggleFavorite,
  onDelete,
}: {
  conv: AiConversation;
  activeConvId: string | null;
  onLoad: (id: string) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={() => onLoad(conv.id)}
      className="w-full text-left px-2.5 py-2 rounded-lg group relative transition-colors"
      style={{
        background: activeConvId === conv.id ? 'var(--bg-hover)' : 'transparent',
        border: activeConvId === conv.id ? '1px solid var(--border)' : '1px solid transparent',
      }}
    >
      <p className="text-xs font-medium truncate pr-14" style={{ color: 'var(--text-primary)' }}>
        {conv.title}
      </p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
        {fmtDate(conv.updated_at)} · {AI_MODELS.find(m => m.id === conv.model_id)?.name ?? conv.model_id}
      </p>
      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
        <button
          onClick={e => onToggleFavorite(conv.id, e)}
          className={`p-1 rounded transition-all ${conv.is_favorite ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
          style={{ color: conv.is_favorite ? '#f59e0b' : 'var(--text-muted)' }}
          title={conv.is_favorite ? 'Odebrat z oblíbených' : 'Přidat do oblíbených'}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill={conv.is_favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </button>
        <button
          onClick={e => onDelete(conv.id, e)}
          className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          title="Smazat konverzaci"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>
    </button>
  );
}

export function ConversationSidebar({ ai }: Props) {
  const {
    sidebarOpen,
    convSearch,
    setConvSearch,
    loadingConvs,
    filteredConvs,
    favConvs,
    regularConvs,
    activeConvId,
    newConversation,
    loadConversation,
    deleteConversation,
    toggleFavorite,
  } = ai;

  return (
    <aside
      className={`
        fixed lg:relative z-40 lg:z-auto inset-y-0 left-0
        flex flex-col flex-shrink-0
        border-r transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}
      style={{ width: 256, background: 'var(--bg-card)', borderColor: 'var(--border)' }}
    >
      {/* Sidebar header */}
      <div className="p-3 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={newConversation}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ background: 'var(--primary)', color: '#fff' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nová konverzace
        </button>
        <div className="mt-2 relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            type="text"
            placeholder="Hledat konverzace…"
            value={convSearch}
            onChange={e => setConvSearch(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg"
            style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          />
        </div>
      </div>

      {/* Seznam konverzací */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5">
        {loadingConvs ? (
          <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>Načítám…</p>
        ) : filteredConvs.length === 0 ? (
          <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>
            {convSearch ? 'Žádné výsledky' : 'Zatím žádné konverzace'}
          </p>
        ) : (
          <>
            {favConvs.length > 0 && (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-wide px-2 pt-1.5 pb-0.5" style={{ color: 'var(--text-muted)' }}>
                  Oblíbené
                </p>
                {favConvs.map(conv => (
                  <ConvItem
                    key={conv.id}
                    conv={conv}
                    activeConvId={activeConvId}
                    onLoad={loadConversation}
                    onToggleFavorite={toggleFavorite}
                    onDelete={deleteConversation}
                  />
                ))}
                {regularConvs.length > 0 && (
                  <div className="my-1.5 mx-1 border-t" style={{ borderColor: 'var(--border)' }} />
                )}
              </>
            )}
            {regularConvs.length > 0 && (
              <>
                {favConvs.length > 0 && (
                  <p className="text-[10px] font-semibold uppercase tracking-wide px-2 pt-0.5 pb-0.5" style={{ color: 'var(--text-muted)' }}>
                    Ostatní
                  </p>
                )}
                {regularConvs.map(conv => (
                  <ConvItem
                    key={conv.id}
                    conv={conv}
                    activeConvId={activeConvId}
                    onLoad={loadConversation}
                    onToggleFavorite={toggleFavorite}
                    onDelete={deleteConversation}
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

'use client';

import { htmlToPlainText } from './utils';
import type { UseAiAssistantReturn } from './useAiAssistant';

interface Props {
  ai: UseAiAssistantReturn;
}

export function FavoritePromptsPanel({ ai }: Props) {
  const {
    showFavPrompts,
    setShowFavPrompts,
    favoritePrompts,
    usePrompt,
    copyPrompt,
    copiedPromptId,
  } = ai;

  if (!showFavPrompts) return null;

  return (
    <div className="mt-2 rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: 'var(--border)' }}>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Oblíbené prompty</p>
        <button onClick={() => setShowFavPrompts(false)} style={{ color: 'var(--text-muted)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      {favoritePrompts.length === 0 ? (
        <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>
          Žádné oblíbené prompty. Označte si prompty hvězdičkou v modulu Prompty.
        </p>
      ) : (
        <div className="divide-y max-h-64 overflow-y-auto" style={{ borderColor: 'var(--border)' }}>
          {favoritePrompts.map(p => (
            <div
              key={p.id}
              className="flex items-start gap-3 px-4 py-3 group cursor-pointer transition-colors"
              style={{ background: 'transparent' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              onClick={() => usePrompt(p)}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{p.title}</p>
                <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-muted)' }}>
                  {htmlToPlainText(p.content).slice(0, 120)}
                </p>
              </div>
              <button
                onClick={e => { e.stopPropagation(); copyPrompt(p); }}
                className="flex-shrink-0 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                style={{
                  background: copiedPromptId === p.id ? '#10b98118' : 'var(--bg-hover)',
                  color: copiedPromptId === p.id ? '#10b981' : 'var(--text-muted)',
                  border: '1px solid var(--border)',
                }}
                title="Kopírovat do schránky"
              >
                {copiedPromptId === p.id ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import { formatCostCzk } from '@/lib/ai-providers';
import { renderMarkdown, fmtTime } from './utils';
import type { UseAiAssistantReturn } from './useAiAssistant';

interface Props {
  ai: UseAiAssistantReturn;
}

export function ChatMessages({ ai }: Props) {
  const {
    messages,
    streamingContent,
    isFirecrawlBusy,
    firecrawlStatus,
    firecrawlAvailable,
    currentModel,
    selectedModel,
    messagesEndRef,
  } = ai;

  return (
    <div
      className="flex-1 overflow-y-auto rounded-xl p-4 flex flex-col gap-4 min-h-0"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      {/* Prázdný stav */}
      {messages.length === 0 && !streamingContent && (
        <div className="flex flex-col items-center justify-center h-full text-center gap-3">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--primary) 12%, transparent)' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary)' }}>
              <path d="M12 2a8 8 0 0 1 8 8c0 3.5-2 6.5-5 7.7V20h-6v-2.3C6 16.5 4 13.5 4 10a8 8 0 0 1 8-8z"/>
              <line x1="9" y1="20" x2="15" y2="20"/><line x1="9" y1="23" x2="15" y2="23"/>
            </svg>
          </div>
          <div>
            <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Jak mohu pomoci?</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Model: <strong style={{ color: 'var(--text-primary)' }}>{currentModel?.name ?? selectedModel}</strong>
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            {[
              'Napiš mi email pro kolegu',
              'Shrň tento text',
              'Pomoz mi s kódem',
              'Přelož do angličtiny',
              ...(firecrawlAvailable ? ['Co je nejnovějšího v AI?', 'Shrň stránku: https://'] : []),
            ].map((s, i) => (
              <button
                key={s}
                onClick={() => {
                  if (firecrawlAvailable && i >= 4) { ai.setWebSearchEnabled(true); ai.setInput(s); }
                  else ai.setInput(s);
                }}
                className="text-xs px-3 py-1.5 rounded-full transition-colors"
                style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Zprávy */}
      {messages.map(msg => (
        <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
          <div
            className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5"
            style={{
              background: msg.role === 'user' ? 'var(--primary)' : 'color-mix(in srgb, var(--primary) 15%, var(--bg-hover))',
              color: msg.role === 'user' ? '#fff' : 'var(--primary)',
            }}
          >
            {msg.role === 'user' ? 'Ty' : 'AI'}
          </div>
          <div className={`flex flex-col gap-1 max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div
              className="px-3 py-2.5 rounded-2xl text-sm leading-relaxed"
              style={{
                background: msg.role === 'user' ? 'var(--primary)' : msg.error ? '#ef444418' : 'var(--bg-hover)',
                color: msg.role === 'user' ? '#fff' : msg.error ? '#ef4444' : 'var(--text-primary)',
                border: msg.error ? '1px solid #ef444430' : 'none',
                borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                wordBreak: 'break-word',
              }}
            >
              {msg.role === 'user' ? (
                <p style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</p>
              ) : (
                <div className="ai-msg" dangerouslySetInnerHTML={{ __html: `<p>${renderMarkdown(msg.content)}</p>` }} />
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{fmtTime(msg.timestamp)}</span>
              {msg.webContext && (
                <span className="text-xs flex items-center gap-0.5" style={{ color: '#10b981' }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                  web
                </span>
              )}
              {msg.tokens ? (
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}
                  title={`Prompt: ${msg.promptTokens ?? '?'} | Completion: ${msg.completionTokens ?? '?'} | Celkem: ${msg.tokens}`}>
                  {msg.tokens} tok.
                  {msg.costUsd ? ` · ${formatCostCzk(msg.costUsd)}` : ''}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      ))}

      {/* Firecrawl loading */}
      {isFirecrawlBusy && (
        <div className="flex gap-3 flex-row">
          <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5" style={{ background: '#10b98118', color: '#10b981' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          </div>
          <div className="px-3 py-2.5 text-sm" style={{ background: '#10b98110', borderRadius: '18px 18px 18px 4px', color: '#10b981', border: '1px solid #10b98130' }}>
            {firecrawlStatus === 'searching' ? 'Prohledávám web…' : 'Čtu stránku…'}
          </div>
        </div>
      )}

      {/* Streaming bublina */}
      {streamingContent && (
        <div className="flex gap-3 flex-row">
          <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5" style={{ background: 'color-mix(in srgb, var(--primary) 15%, var(--bg-hover))', color: 'var(--primary)' }}>AI</div>
          <div className="max-w-[80%]">
            <div className="px-3 py-2.5 text-sm leading-relaxed" style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', borderRadius: '18px 18px 18px 4px', wordBreak: 'break-word' }}>
              <div className="ai-stream" dangerouslySetInnerHTML={{ __html: `<p>${renderMarkdown(streamingContent)}</p>` }} />
              <span className="inline-block w-1.5 h-4 ml-0.5 animate-pulse rounded-sm" style={{ background: 'var(--primary)' }} />
            </div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}

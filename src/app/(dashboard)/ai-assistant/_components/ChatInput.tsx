'use client';

import { AI_MODELS, AI_PROVIDERS } from '@/lib/ai-providers';
import { FIRECRAWL_CREDIT_LIMIT } from './constants';
import { FavoritePromptsPanel } from './FavoritePromptsPanel';
import { ModelInfoPanel } from './ModelInfoPanel';
import type { UseAiAssistantReturn } from './useAiAssistant';

interface Props {
  ai: UseAiAssistantReturn;
}

export function ChatInput({ ai }: Props) {
  const {
    input,
    setInput,
    inputRef,
    isLoading,
    isFirecrawlBusy,
    firecrawlStatus,
    firecrawlAvailable,
    webSearchEnabled,
    setWebSearchEnabled,
    detectedUrls,
    creditsUsed,
    creditsRemaining,
    creditColor,
    selectedModel,
    setSelectedModel,
    showModelInfo,
    setShowModelInfo,
    showFavPrompts,
    fetchFavoritePrompts,
    systemPrompt,
    totalCostCzk,
    showTokens,
    contextWindow,
    tokenBarColor,
    tokenFraction,
    sendMessage,
    stopStreaming,
    handleKeyDown,
  } = ai;

  return (
    <div className="mt-3 flex-shrink-0">

      {/* Varování nízké kredity */}
      {firecrawlAvailable && creditsRemaining < 50 && creditsRemaining >= 0 && (
        <div className="mb-2 px-3 py-2 rounded-lg text-xs flex items-center gap-2" style={{ background: '#ef444410', border: '1px solid #ef444430', color: '#ef4444' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Zbývá jen <strong className="mx-0.5">{creditsRemaining}</strong> Firecrawl kreditů. Zvažte přechod na vyšší tarif.
        </div>
      )}

      {/* Indikátory nad inputem */}
      {(detectedUrls.length > 0 || webSearchEnabled) && (
        <div className="mb-1.5 flex flex-wrap gap-2 px-1">
          {detectedUrls.length > 0 && (
            <span className="text-xs flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: '#10b98115', color: '#10b981', border: '1px solid #10b98130' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              {detectedUrls.length === 1 ? 'Stránka bude přečtena' : `${detectedUrls.length} stránky budou přečteny`}
            </span>
          )}
          {webSearchEnabled && detectedUrls.length === 0 && (
            <span className="text-xs flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: '#10b98115', color: '#10b981', border: '1px solid #10b98130' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              Web search aktivní
            </span>
          )}
        </div>
      )}

      {/* Textarea */}
      <div className="flex gap-2 p-2 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        {firecrawlAvailable && (
          <button
            onClick={() => setWebSearchEnabled(s => !s)}
            title={webSearchEnabled ? 'Vypnout web search' : 'Zapnout web search'}
            className="flex-shrink-0 p-2 rounded-lg transition-colors self-end mb-0.5"
            style={{
              background: webSearchEnabled ? '#10b98120' : 'transparent',
              color: webSearchEnabled ? '#10b981' : 'var(--text-muted)',
              border: webSearchEnabled ? '1px solid #10b98140' : '1px solid transparent',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
          </button>
        )}

        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isFirecrawlBusy
              ? (firecrawlStatus === 'searching' ? 'Prohledávám web…' : 'Čtu stránku…')
              : isLoading ? 'AI odpovídá…'
              : 'Napište zprávu… (Enter = odeslat, Shift+Enter = nový řádek)'
          }
          rows={3}
          disabled={isLoading || isFirecrawlBusy}
          className="flex-1 resize-none text-base sm:text-sm px-2 py-2 bg-transparent outline-none"
          style={{ color: 'var(--text-primary)', minHeight: '80px', maxHeight: '300px', overflowY: 'auto' }}
          onInput={e => {
            const el = e.currentTarget;
            el.style.height = 'auto';
            el.style.height = Math.min(el.scrollHeight, 300) + 'px';
          }}
        />

        {isLoading ? (
          <button onClick={stopStreaming} className="px-3 py-2 rounded-lg text-sm font-medium flex-shrink-0 transition-colors self-end mb-0.5"
            style={{ background: '#ef444418', color: '#ef4444', border: '1px solid #ef444430' }} title="Zastavit generování">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
          </button>
        ) : (
          <button onClick={sendMessage} disabled={!input.trim() || isFirecrawlBusy}
            className="px-4 py-2 rounded-lg text-sm font-medium flex-shrink-0 transition-colors flex items-center gap-1.5 self-end mb-0.5"
            style={{
              background: input.trim() && !isFirecrawlBusy ? 'var(--primary)' : 'var(--bg-hover)',
              color: input.trim() && !isFirecrawlBusy ? '#fff' : 'var(--text-muted)',
              cursor: input.trim() && !isFirecrawlBusy ? 'pointer' : 'not-allowed',
            }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            <span className="hidden sm:inline">Odeslat</span>
          </button>
        )}
      </div>

      {/* ── Footer: quick model switcher + token counter ──────────────── */}
      <div className="mt-2 flex items-start justify-between gap-2 px-1">

        {/* Levá část: model switcher + info */}
        <div className="flex flex-col gap-1.5 min-w-0">
          {/* Quick model pills */}
          <div className="flex flex-col gap-1">
            {AI_PROVIDERS.map(prov => {
              const providerModels = AI_MODELS.filter(m => m.provider === prov.id);
              if (providerModels.length === 0) return null;
              return (
                <div key={prov.id} className="flex items-center gap-1 flex-wrap">
                  {AI_PROVIDERS.length > 1 && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide mr-0.5 w-10" style={{ color: 'var(--text-muted)' }}>
                      {prov.name === 'OpenAI' ? 'GPT' : 'Gemini'}
                    </span>
                  )}
                  {providerModels.map(m => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedModel(m.id)}
                      className="text-xs px-2.5 py-1 rounded-full transition-colors flex items-center gap-1"
                      style={{
                        background: selectedModel === m.id ? 'var(--primary)' : 'var(--bg-hover)',
                        color: selectedModel === m.id ? '#fff' : 'var(--text-muted)',
                        border: selectedModel === m.id ? 'none' : '1px solid var(--border)',
                      }}
                      title={m.description}
                    >
                      {m.name.replace('Gemini ', '').replace('GPT-', '')}
                      {m.badge && selectedModel !== m.id && (
                        <span className="text-[10px] px-1 rounded" style={{ background: '#10b98115', color: '#10b981' }}>★</span>
                      )}
                    </button>
                  ))}
                </div>
              );
            })}
            {/* Info + Prompty řádek */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowModelInfo(s => !s)}
                className="w-6 h-6 rounded-full flex items-center justify-center transition-colors flex-shrink-0"
                style={{
                  background: showModelInfo ? 'color-mix(in srgb, var(--primary) 15%, transparent)' : 'var(--bg-hover)',
                  color: showModelInfo ? 'var(--primary)' : 'var(--text-muted)',
                  border: '1px solid var(--border)',
                }}
                title="Informace o modelech"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="8" strokeWidth="3"/>
                  <line x1="12" y1="12" x2="12" y2="16"/>
                </svg>
              </button>
              <button
                onClick={fetchFavoritePrompts}
                className="text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 transition-colors flex-shrink-0"
                style={{
                  background: showFavPrompts ? 'color-mix(in srgb, var(--primary) 15%, transparent)' : 'var(--bg-hover)',
                  color: showFavPrompts ? 'var(--primary)' : 'var(--text-muted)',
                  border: showFavPrompts ? '1px solid color-mix(in srgb, var(--primary) 30%, transparent)' : '1px solid var(--border)',
                }}
                title="Oblíbené prompty"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill={showFavPrompts ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                Prompty
              </button>
            </div>
          </div>

          {/* Stavový řádek */}
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {systemPrompt.trim() && <span style={{ color: 'var(--primary)' }}>· System prompt</span>}
            {webSearchEnabled && firecrawlAvailable && <span className="ml-1" style={{ color: '#10b981' }}>· Web search</span>}
            {totalCostCzk && <span className="ml-1">· {totalCostCzk}</span>}
          </p>
        </div>

        {/* Pravá část: token counter + Firecrawl */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="text-xs" style={{ color: tokenBarColor }}
            title={`Odhadovaný počet tokenů v konverzaci: ~${showTokens.toLocaleString('cs-CZ')} / ${(contextWindow / 1000).toFixed(0)}k kontext`}>
            ~{showTokens > 999 ? `${(showTokens / 1000).toFixed(1)}k` : showTokens} / {(contextWindow / 1000).toFixed(0)}k tok.
          </span>
          <div className="w-28 rounded-full h-1.5" style={{ background: 'var(--bg-hover)' }}>
            <div
              className="h-1.5 rounded-full transition-all"
              style={{ width: `${Math.min(100, tokenFraction * 100)}%`, background: tokenBarColor }}
            />
          </div>
          {ai.messages.length > 0 && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {ai.messages.length} {ai.messages.length === 1 ? 'zpráva' : ai.messages.length < 5 ? 'zprávy' : 'zpráv'}
            </span>
          )}
          {/* Firecrawl kredity */}
          {firecrawlAvailable && (
            <div className="flex items-center gap-1.5 mt-0.5" title={`Firecrawl kredity: ${creditsUsed} / ${FIRECRAWL_CREDIT_LIMIT}`}>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>🔥</span>
              <div className="w-20 rounded-full h-1" style={{ background: 'var(--bg-hover)' }}>
                <div
                  className="h-1 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (creditsUsed / FIRECRAWL_CREDIT_LIMIT) * 100)}%`, background: creditColor }}
                />
              </div>
              <span className="text-xs" style={{ color: creditColor }}>{creditsUsed}/{FIRECRAWL_CREDIT_LIMIT}</span>
            </div>
          )}
        </div>
      </div>

      {/* Panely */}
      <FavoritePromptsPanel ai={ai} />
      <ModelInfoPanel ai={ai} />
    </div>
  );
}

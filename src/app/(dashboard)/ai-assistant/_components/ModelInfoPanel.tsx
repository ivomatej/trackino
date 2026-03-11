'use client';

import { AI_MODELS, AI_PROVIDERS, CZK_PER_USD, formatCostCzk } from '@/lib/ai-providers';
import type { UseAiAssistantReturn } from './useAiAssistant';

interface Props {
  ai: UseAiAssistantReturn;
}

export function ModelInfoPanel({ ai }: Props) {
  const { showModelInfo, setShowModelInfo, selectedModel, setSelectedModel } = ai;

  if (!showModelInfo) return null;

  return (
    <div className="mt-2 p-4 rounded-xl overflow-y-auto" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', maxHeight: 'min(60vh, 500px)' }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Dostupné AI modely</p>
        <button onClick={() => setShowModelInfo(false)} style={{ color: 'var(--text-muted)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      {AI_PROVIDERS.map(prov => {
        const providerModels = AI_MODELS.filter(m => m.provider === prov.id);
        if (providerModels.length === 0) return null;
        return (
          <div key={prov.id} className="mb-4 last:mb-0">
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>
              {prov.name}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {providerModels.map(m => {
                const inputCzk = formatCostCzk(m.inputCostPer1M / 1_000_000 * 1000);
                const outputCzk = formatCostCzk(m.outputCostPer1M / 1_000_000 * 1000);
                return (
                  <div
                    key={m.id}
                    className="p-3 rounded-lg cursor-pointer transition-all"
                    style={{
                      background: selectedModel === m.id ? 'color-mix(in srgb, var(--primary) 8%, transparent)' : 'var(--bg-hover)',
                      border: selectedModel === m.id ? '1px solid color-mix(in srgb, var(--primary) 30%, transparent)' : '1px solid var(--border)',
                    }}
                    onClick={() => { setSelectedModel(m.id); setShowModelInfo(false); }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{m.name}</p>
                      {m.badge && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: '#10b98115', color: '#10b981' }}>
                          {m.badge}
                        </span>
                      )}
                      {selectedModel === m.id && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full ml-auto" style={{ background: 'var(--primary)', color: '#fff' }}>Aktivní</span>
                      )}
                    </div>
                    <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{m.longDescription}</p>
                    <div className="grid grid-cols-2 gap-x-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <span>Kontext: <strong style={{ color: 'var(--text-primary)' }}>{m.contextWindow >= 1_000_000 ? `${(m.contextWindow / 1_000_000).toFixed(0)}M` : `${(m.contextWindow / 1000).toFixed(0)}k`}</strong></span>
                      <span>Streaming: <strong style={{ color: 'var(--text-primary)' }}>{m.supportsStreaming ? 'Ano' : 'Ne'}</strong></span>
                      <span title={`$${m.inputCostPer1M}/1M tokenů`}>Input: <strong style={{ color: 'var(--text-primary)' }}>{inputCzk}/1k</strong></span>
                      <span title={`$${m.outputCostPer1M}/1M tokenů`}>Output: <strong style={{ color: 'var(--text-primary)' }}>{outputCzk}/1k</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
        Ceny jsou orientační (kurz {CZK_PER_USD} Kč/USD). Přesné ceny:{' '}
        <a href="https://openai.com/api/pricing" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>OpenAI</a>
        {' · '}
        <a href="https://ai.google.dev/pricing" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>Google Gemini</a>
      </p>
    </div>
  );
}

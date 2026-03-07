'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { WorkspaceProvider, useWorkspace } from '@/contexts/WorkspaceContext';
import DashboardLayout from '@/components/DashboardLayout';
import { AI_MODELS, DEFAULT_MODEL_ID } from '@/lib/ai-providers';
import type { AiChatMessage } from '@/app/api/ai-chat/route';

// ─── Typy ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  tokens?: number;
  error?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
}

// Jednoduchý Markdown → HTML pro zobrazení AI odpovědí
function renderMarkdown(text: string): string {
  return text
    // Kódové bloky (více řádků)
    .replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
      `<pre class="ai-code-block" data-lang="${lang || 'code'}"><code>${escHtml(code.trim())}</code></pre>`)
    // Inline kód
    .replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>')
    // Tučné
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Kurzíva
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Nadpisy
    .replace(/^### (.+)$/gm, '<h3 class="ai-h3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="ai-h2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="ai-h1">$1</h1>')
    // Odrážkový seznam
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/((?:<li>[^]*?<\/li>)+)/gm, '<ul class="ai-ul">$1</ul>')
    // Odstavce (dvojitý nový řádek)
    .replace(/\n\n+/g, '</p><p>')
    // Jednoduchý nový řádek
    .replace(/\n/g, '<br/>');
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Komponenta ──────────────────────────────────────────────────────────────

function AiAssistantContent() {
  const { hasModule } = useWorkspace();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL_ID);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [temperature, setTemperature] = useState(0.7);
  const [showSettings, setShowSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [apiConfigured, setApiConfigured] = useState<boolean | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Zkontroluj dostupnost API při načtení
  useEffect(() => {
    fetch('/api/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [], model: selectedModel, stream: false }),
    })
      .then(r => r.json())
      .then((data: { error?: string }) => {
        if (data.error?.includes('není nastaven')) {
          setApiConfigured(false);
        } else {
          setApiConfigured(true);
        }
      })
      .catch(() => setApiConfigured(null));
  }, [selectedModel]);

  // Scroll na konec po každé nové zprávě
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const currentModel = AI_MODELS.find(m => m.id === selectedModel);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setStreamingContent('');

    const history: AiChatMessage[] = [
      ...messages.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: text },
    ];

    const abort = new AbortController();
    abortRef.current = abort;

    const supportsStream = currentModel?.supportsStreaming !== false;

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abort.signal,
        body: JSON.stringify({
          messages: history,
          model: selectedModel,
          systemPrompt: systemPrompt.trim() || undefined,
          stream: supportsStream,
          temperature,
        }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        setMessages(prev => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: err.error ?? 'Chyba při komunikaci s AI.',
            timestamp: new Date(),
            error: true,
          },
        ]);
        return;
      }

      if (supportsStream && res.body) {
        // Streamovaná odpověď
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          fullContent += chunk;
          setStreamingContent(fullContent);
        }

        setMessages(prev => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: fullContent,
            timestamp: new Date(),
          },
        ]);
        setStreamingContent('');
      } else {
        // Nestremaovaná odpověď
        const data = (await res.json()) as { content: string; usage?: { total_tokens: number } };
        setMessages(prev => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: data.content,
            timestamp: new Date(),
            tokens: data.usage?.total_tokens,
          },
        ]);
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessages(prev => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: 'Spojení bylo přerušeno.',
            timestamp: new Date(),
            error: true,
          },
        ]);
      }
    } finally {
      setIsLoading(false);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  }, [input, isLoading, messages, selectedModel, systemPrompt, temperature, currentModel]);

  const stopStreaming = () => {
    abortRef.current?.abort();
  };

  const clearConversation = () => {
    setMessages([]);
    setStreamingContent('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!hasModule('ai_assistant')) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p style={{ color: 'var(--text-muted)' }}>AI asistent není dostupný v tomto tarifu.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
    <div className="flex flex-col h-full max-w-4xl mx-auto" style={{ height: 'calc(100vh - 140px)' }}>
      {/* Nadpis + toolbar */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>AI asistent</h1>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={clearConversation}
              className="text-xs px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)', background: 'var(--bg-hover)' }}
            >
              Vymazat konverzaci
            </button>
          )}
          <button
            onClick={() => setShowSettings(s => !s)}
            className="text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
            style={{
              color: showSettings ? 'var(--primary)' : 'var(--text-muted)',
              background: showSettings ? 'color-mix(in srgb, var(--primary) 10%, transparent)' : 'var(--bg-hover)',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
            Nastavení
          </button>
        </div>
      </div>

      {/* Upozornění – API klíč není nastaven */}
      {apiConfigured === false && (
        <div className="mb-4 p-3 rounded-xl text-sm flex-shrink-0" style={{ background: '#ef444418', border: '1px solid #ef444440', color: '#ef4444' }}>
          <strong>API klíč OpenAI není nastaven.</strong> Přidejte <code className="mx-1 px-1 rounded" style={{ background: '#ef444422' }}>OPENAI_API_KEY</code> do souboru <code className="mx-1 px-1 rounded" style={{ background: '#ef444422' }}>.env.local</code> a do Vercel Environment Variables. Viz postup v dokumentaci.
        </div>
      )}

      {/* Nastavení panel */}
      {showSettings && (
        <div className="mb-4 p-4 rounded-xl flex-shrink-0" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Výběr modelu */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Model</label>
              <select
                value={selectedModel}
                onChange={e => setSelectedModel(e.target.value)}
                className="w-full text-base sm:text-sm px-3 py-2 rounded-lg"
                style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', appearance: 'none' }}
              >
                {AI_MODELS.map(m => (
                  <option key={m.id} value={m.id}>{m.name} – {m.description}</option>
                ))}
              </select>
            </div>

            {/* Teplota */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Kreativita (temperature): <strong style={{ color: 'var(--text-primary)' }}>{temperature}</strong>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={temperature}
                onChange={e => setTemperature(parseFloat(e.target.value))}
                className="w-full"
                style={{ accentColor: 'var(--primary)' }}
              />
              <div className="flex justify-between text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                <span>Přesné (0)</span>
                <span>Kreativní (1)</span>
              </div>
            </div>
          </div>

          {/* System prompt */}
          <div className="mt-3">
            <button
              onClick={() => setShowSystemPrompt(s => !s)}
              className="text-xs flex items-center gap-1 mb-2"
              style={{ color: 'var(--text-muted)' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showSystemPrompt ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}><polyline points="9 18 15 12 9 6"/></svg>
              System prompt (pokyny pro AI)
            </button>
            {showSystemPrompt && (
              <textarea
                value={systemPrompt}
                onChange={e => setSystemPrompt(e.target.value)}
                placeholder="Např.: Jsi asistent pro HR oddělení. Odpovídej stručně a v češtině."
                rows={3}
                className="w-full text-base sm:text-sm px-3 py-2 rounded-lg resize-none"
                style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
            )}
          </div>

          {/* Info o modelu */}
          {currentModel && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span>Provider: <strong style={{ color: 'var(--text-primary)' }}>OpenAI</strong></span>
              <span>Kontext: <strong style={{ color: 'var(--text-primary)' }}>{(currentModel.contextWindow / 1000).toFixed(0)}k tokenů</strong></span>
              <span>Streaming: <strong style={{ color: 'var(--text-primary)' }}>{currentModel.supportsStreaming ? 'Ano' : 'Ne'}</strong></span>
            </div>
          )}
        </div>
      )}

      {/* Oblast zpráv */}
      <div
        className="flex-1 overflow-y-auto rounded-xl p-4 flex flex-col gap-4 min-h-0"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        {messages.length === 0 && !streamingContent && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--primary) 12%, transparent)' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary)' }}>
                <path d="M12 2a8 8 0 0 1 8 8c0 3.5-2 6.5-5 7.7V20h-6v-2.3C6 16.5 4 13.5 4 10a8 8 0 0 1 8-8z"/>
                <line x1="9" y1="20" x2="15" y2="20"/>
                <line x1="9" y1="23" x2="15" y2="23"/>
              </svg>
            </div>
            <div>
              <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Jak mohu pomoci?</p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Aktuálně vybraný model: <strong style={{ color: 'var(--text-primary)' }}>{currentModel?.name ?? selectedModel}</strong>
              </p>
            </div>
            {/* Rychlé návrhy */}
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              {[
                'Napiš mi email pro kolegu',
                'Shrň tento text',
                'Pomoz mi s kódem',
                'Přelož do angličtiny',
              ].map(s => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="text-xs px-3 py-1.5 rounded-full transition-colors"
                  style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            {/* Avatar */}
            <div
              className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5"
              style={{
                background: msg.role === 'user' ? 'var(--primary)' : 'color-mix(in srgb, var(--primary) 15%, var(--bg-hover))',
                color: msg.role === 'user' ? '#fff' : 'var(--primary)',
              }}
            >
              {msg.role === 'user' ? 'Ty' : 'AI'}
            </div>

            {/* Bublina */}
            <div className={`flex flex-col gap-1 max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div
                className="px-3 py-2.5 rounded-2xl text-sm leading-relaxed"
                style={{
                  background: msg.role === 'user'
                    ? 'var(--primary)'
                    : msg.error
                    ? '#ef444418'
                    : 'var(--bg-hover)',
                  color: msg.role === 'user'
                    ? '#fff'
                    : msg.error
                    ? '#ef4444'
                    : 'var(--text-primary)',
                  border: msg.error ? '1px solid #ef444430' : 'none',
                  borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  wordBreak: 'break-word',
                }}
              >
                {msg.role === 'user' ? (
                  <p style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                ) : (
                  <>
                    <style>{`
                      .ai-msg h1.ai-h1 { font-size: 1.1rem; font-weight: 700; margin: 0.5rem 0 0.25rem; }
                      .ai-msg h2.ai-h2 { font-size: 1rem; font-weight: 700; margin: 0.5rem 0 0.25rem; }
                      .ai-msg h3.ai-h3 { font-size: 0.9rem; font-weight: 600; margin: 0.4rem 0 0.2rem; }
                      .ai-msg ul.ai-ul { padding-left: 1.2rem; margin: 0.3rem 0; }
                      .ai-msg ul.ai-ul li { margin: 0.15rem 0; }
                      .ai-msg pre.ai-code-block { background: rgba(0,0,0,0.15); border-radius: 8px; padding: 10px 12px; overflow-x: auto; margin: 0.5rem 0; font-size: 0.8rem; position: relative; }
                      .ai-msg pre.ai-code-block::before { content: attr(data-lang); position: absolute; top: 4px; right: 8px; font-size: 0.65rem; opacity: 0.5; text-transform: uppercase; }
                      .ai-msg code.ai-inline-code { background: rgba(0,0,0,0.12); border-radius: 4px; padding: 1px 5px; font-size: 0.85em; }
                      .ai-msg p:first-child { margin-top: 0; }
                      .ai-msg p:last-child { margin-bottom: 0; }
                    `}</style>
                    <div
                      className="ai-msg"
                      dangerouslySetInnerHTML={{ __html: `<p>${renderMarkdown(msg.content)}</p>` }}
                    />
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{fmtTime(msg.timestamp)}</span>
                {msg.tokens && (
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{msg.tokens} tokenů</span>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Streaming bublina */}
        {streamingContent && (
          <div className="flex gap-3 flex-row">
            <div
              className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5"
              style={{ background: 'color-mix(in srgb, var(--primary) 15%, var(--bg-hover))', color: 'var(--primary)' }}
            >
              AI
            </div>
            <div className="max-w-[80%]">
              <div
                className="px-3 py-2.5 text-sm leading-relaxed"
                style={{
                  background: 'var(--bg-hover)',
                  color: 'var(--text-primary)',
                  borderRadius: '18px 18px 18px 4px',
                  wordBreak: 'break-word',
                }}
              >
                <style>{`
                  .ai-stream h1.ai-h1 { font-size: 1.1rem; font-weight: 700; margin: 0.5rem 0 0.25rem; }
                  .ai-stream h2.ai-h2 { font-size: 1rem; font-weight: 700; margin: 0.5rem 0 0.25rem; }
                  .ai-stream h3.ai-h3 { font-size: 0.9rem; font-weight: 600; margin: 0.4rem 0 0.2rem; }
                  .ai-stream ul.ai-ul { padding-left: 1.2rem; margin: 0.3rem 0; }
                  .ai-stream pre.ai-code-block { background: rgba(0,0,0,0.15); border-radius: 8px; padding: 10px 12px; overflow-x: auto; margin: 0.5rem 0; font-size: 0.8rem; }
                  .ai-stream code.ai-inline-code { background: rgba(0,0,0,0.12); border-radius: 4px; padding: 1px 5px; font-size: 0.85em; }
                `}</style>
                <div
                  className="ai-stream"
                  dangerouslySetInnerHTML={{ __html: `<p>${renderMarkdown(streamingContent)}</p>` }}
                />
                <span className="inline-block w-1.5 h-4 ml-0.5 animate-pulse rounded-sm" style={{ background: 'var(--primary)' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input oblast */}
      <div className="mt-3 flex-shrink-0">
        <div
          className="flex gap-2 p-2 rounded-xl"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isLoading ? 'AI odpovídá…' : 'Napište zprávu… (Enter = odeslat, Shift+Enter = nový řádek)'}
            rows={1}
            disabled={isLoading}
            className="flex-1 resize-none text-base sm:text-sm px-2 py-2 bg-transparent outline-none"
            style={{
              color: 'var(--text-primary)',
              minHeight: '40px',
              maxHeight: '160px',
              overflowY: 'auto',
            }}
            onInput={e => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = Math.min(el.scrollHeight, 160) + 'px';
            }}
          />

          {isLoading ? (
            <button
              onClick={stopStreaming}
              className="px-3 py-2 rounded-lg text-sm font-medium flex-shrink-0 transition-colors"
              style={{ background: '#ef444418', color: '#ef4444', border: '1px solid #ef444430' }}
              title="Zastavit generování"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
            </button>
          ) : (
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium flex-shrink-0 transition-colors flex items-center gap-1.5"
              style={{
                background: input.trim() ? 'var(--primary)' : 'var(--bg-hover)',
                color: input.trim() ? '#fff' : 'var(--text-muted)',
                cursor: input.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              <span className="hidden sm:inline">Odeslat</span>
            </button>
          )}
        </div>

        <div className="flex items-center justify-between mt-1.5 px-1">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Model: <strong style={{ color: 'var(--text-primary)' }}>{currentModel?.name ?? selectedModel}</strong>
            {systemPrompt.trim() && <span className="ml-2" style={{ color: 'var(--primary)' }}>· System prompt aktivní</span>}
          </p>
          {messages.length > 0 && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {messages.length} {messages.length === 1 ? 'zpráva' : messages.length < 5 ? 'zprávy' : 'zpráv'}
            </p>
          )}
        </div>
      </div>
    </div>
    </DashboardLayout>
  );
}

export default function AiAssistantPage() {
  return (
    <WorkspaceProvider>
      <AiAssistantContent />
    </WorkspaceProvider>
  );
}

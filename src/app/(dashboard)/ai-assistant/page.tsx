'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { WorkspaceProvider, useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import DashboardLayout from '@/components/DashboardLayout';
import { AI_MODELS, DEFAULT_MODEL_ID, CZK_PER_USD, calcCostUsd, formatCostCzk } from '@/lib/ai-providers';
import { supabase } from '@/lib/supabase';
import type { AiChatMessage } from '@/app/api/ai-chat/route';
import type { ScrapeResponse } from '@/app/api/firecrawl/scrape/route';
import type { SearchResponse } from '@/app/api/firecrawl/search/route';
import type { AiConversation, AiMessage } from '@/types/database';

// ─── Typy ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  tokens?: number;
  promptTokens?: number;
  completionTokens?: number;
  costUsd?: number;
  error?: boolean;
  webContext?: boolean;
}

type FirecrawlStatus = 'idle' | 'searching' | 'scraping';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(s: string): string {
  const d = new Date(s);
  return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' });
}

// Přibližný odhad tokenů klientsky (1 token ≈ 3.8 znaků)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.8);
}

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;
function extractUrls(text: string): string[] {
  return [...new Set(text.match(URL_REGEX) ?? [])];
}

// Auto-generuje titulek konverzace z prvních 55 znaků první zprávy
function autoTitle(firstMessage: string): string {
  const clean = firstMessage.trim().replace(/\s+/g, ' ');
  return clean.length > 55 ? clean.slice(0, 52) + '…' : clean;
}

function renderMarkdown(text: string): string {
  return text
    .replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
      `<pre class="ai-code-block" data-lang="${lang || 'code'}"><code>${escHtml(code.trim())}</code></pre>`)
    .replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3 class="ai-h3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="ai-h2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="ai-h1">$1</h1>')
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/((?:<li>[^]*?<\/li>)+)/gm, '<ul class="ai-ul">$1</ul>')
    .replace(/\n\n+/g, '</p><p>')
    .replace(/\n/g, '<br/>');
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Firecrawl kredity ─────────────────────────────────────────────────────
const FIRECRAWL_CREDIT_LIMIT = 500;
const CREDITS_PER_SCRAPE = 1;
const CREDITS_PER_SEARCH = 7;
const FIRECRAWL_CREDITS_KEY = 'trackino_firecrawl_credits_used';

// ─── CSS styly pro AI zprávy ──────────────────────────────────────────────
const AI_MSG_STYLES = `
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
  .ai-stream h1.ai-h1 { font-size: 1.1rem; font-weight: 700; margin: 0.5rem 0 0.25rem; }
  .ai-stream h2.ai-h2 { font-size: 1rem; font-weight: 700; margin: 0.5rem 0 0.25rem; }
  .ai-stream h3.ai-h3 { font-size: 0.9rem; font-weight: 600; margin: 0.4rem 0 0.2rem; }
  .ai-stream ul.ai-ul { padding-left: 1.2rem; margin: 0.3rem 0; }
  .ai-stream pre.ai-code-block { background: rgba(0,0,0,0.15); border-radius: 8px; padding: 10px 12px; overflow-x: auto; margin: 0.5rem 0; font-size: 0.8rem; }
  .ai-stream code.ai-inline-code { background: rgba(0,0,0,0.12); border-radius: 4px; padding: 1px 5px; font-size: 0.85em; }
`;

// ─── Hlavní komponenta ───────────────────────────────────────────────────────

function AiAssistantContent() {
  const { hasModule, currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { canUseAiAssistant, isWorkspaceAdmin, isMasterAdmin } = usePermissions();

  // ── Konverzace ────────────────────────────────────────────────────────────
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [convSearch, setConvSearch] = useState('');
  const [loadingConvs, setLoadingConvs] = useState(true);

  // ── Chat ──────────────────────────────────────────────────────────────────
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
  const [showModelInfo, setShowModelInfo] = useState(false);

  // ── Oblíbené prompty ───────────────────────────────────────────────────────
  interface FavoritePrompt { id: string; title: string; content: string; }
  const [favoritePrompts, setFavoritePrompts] = useState<FavoritePrompt[]>([]);
  const [showFavPrompts, setShowFavPrompts] = useState(false);
  const [favPromptsLoaded, setFavPromptsLoaded] = useState(false);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);

  // ── Firecrawl ─────────────────────────────────────────────────────────────
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [firecrawlStatus, setFirecrawlStatus] = useState<FirecrawlStatus>('idle');
  const [firecrawlAvailable, setFirecrawlAvailable] = useState<boolean | null>(null);
  const [creditsUsed, setCreditsUsed] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    return parseInt(localStorage.getItem(FIRECRAWL_CREDITS_KEY) ?? '0', 10) || 0;
  });

  // ── Sidebar mobile ────────────────────────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── Computed ──────────────────────────────────────────────────────────────
  const currentModel = AI_MODELS.find(m => m.id === selectedModel);
  const isFirecrawlBusy = firecrawlStatus !== 'idle';
  const creditsRemaining = FIRECRAWL_CREDIT_LIMIT - creditsUsed;
  const creditColor = creditsRemaining >= 200 ? '#10b981' : creditsRemaining >= 50 ? '#f59e0b' : '#ef4444';
  const detectedUrls = extractUrls(input);

  // Token odhad konverzace
  const estimatedConvTokens = useMemo(
    () => messages.reduce((sum, m) => sum + estimateTokens(m.content), 0),
    [messages]
  );
  const contextWindow = currentModel?.contextWindow ?? 128_000;
  const tokenFraction = Math.min(estimatedConvTokens / contextWindow, 1);
  const tokenBarColor = tokenFraction < 0.5 ? '#10b981' : tokenFraction < 0.8 ? '#f59e0b' : tokenFraction < 0.95 ? '#f97316' : '#ef4444';

  // Přesné tokeny z DB zpráv
  const exactTotalTokens = messages.reduce((sum, m) => sum + (m.tokens ?? 0), 0);
  const showTokens = exactTotalTokens > 0 ? exactTotalTokens : estimatedConvTokens;

  // Celková cena konverzace v CZK
  const totalCostCzk = useMemo(() => {
    const totalUsd = messages.reduce((sum, m) => sum + (m.costUsd ?? 0), 0);
    if (totalUsd <= 0) return null;
    return formatCostCzk(totalUsd);
  }, [messages]);

  // Filtrované konverzace
  const filteredConvs = useMemo(() => {
    if (!convSearch.trim()) return conversations;
    const q = convSearch.toLowerCase();
    return conversations.filter(c => c.title.toLowerCase().includes(q));
  }, [conversations, convSearch]);

  // Dostupné modely pro tohoto uživatele (dle ai_allowed_models v membershipa)
  // Pokud null → všechny modely dostupné
  // Budoucí: filtrace dle membership.ai_allowed_models

  // ── Inicializace ──────────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [], model: selectedModel, stream: false }),
    })
      .then(r => r.json())
      .then((data: { error?: string }) => {
        setApiConfigured(!data.error?.includes('není nastaven'));
      })
      .catch(() => setApiConfigured(null));
  }, [selectedModel]);

  useEffect(() => {
    fetch('/api/firecrawl/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'test', limit: 1 }),
    })
      .then(r => { setFirecrawlAvailable(r.status !== 503); })
      .catch(() => setFirecrawlAvailable(false));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Načti konverzace z DB
  useEffect(() => {
    if (!user || !currentWorkspace) return;
    fetchConversations();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, currentWorkspace?.id]);

  async function fetchConversations() {
    if (!user || !currentWorkspace) return;
    setLoadingConvs(true);
    const { data } = await supabase
      .from('trackino_ai_conversations')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    setConversations((data ?? []) as AiConversation[]);
    setLoadingConvs(false);
  }

  async function loadConversation(convId: string) {
    const conv = conversations.find(c => c.id === convId);
    if (!conv) return;
    setActiveConvId(convId);
    setSelectedModel(conv.model_id);
    setSystemPrompt(conv.system_prompt);
    setStreamingContent('');
    setSidebarOpen(false);

    const { data } = await supabase
      .from('trackino_ai_messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });

    const msgs: ChatMessage[] = ((data ?? []) as AiMessage[]).map(m => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: m.content,
      timestamp: new Date(m.created_at),
      tokens: m.total_tokens ?? undefined,
      promptTokens: m.prompt_tokens ?? undefined,
      completionTokens: m.completion_tokens ?? undefined,
      costUsd: m.cost_usd ?? undefined,
      webContext: m.web_context,
    }));
    setMessages(msgs);
  }

  async function newConversation() {
    setActiveConvId(null);
    setMessages([]);
    setStreamingContent('');
    setInput('');
    setSidebarOpen(false);
  }

  async function deleteConversation(convId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('Smazat tuto konverzaci?')) return;
    await supabase.from('trackino_ai_conversations').delete().eq('id', convId);
    if (activeConvId === convId) {
      setActiveConvId(null);
      setMessages([]);
    }
    await fetchConversations();
  }

  // ── Firecrawl helpers ────────────────────────────────────────────────────

  function addCredits(n: number) {
    setCreditsUsed(prev => {
      const next = prev + n;
      if (typeof window !== 'undefined') localStorage.setItem(FIRECRAWL_CREDITS_KEY, String(next));
      return next;
    });
  }

  async function scrapeUrls(urls: string[]): Promise<string> {
    const contexts: string[] = [];
    for (const url of urls.slice(0, 2)) {
      try {
        const res = await fetch('/api/firecrawl/scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        if (!res.ok) continue;
        const data = (await res.json()) as ScrapeResponse;
        if (data.markdown) {
          const title = data.title ? `## ${data.title}` : `## ${url}`;
          contexts.push(`${title}\nZdroj: ${url}\n\n${data.markdown.slice(0, 4000)}`);
          addCredits(CREDITS_PER_SCRAPE);
        }
      } catch { /* přeskoč chybnou URL */ }
    }
    return contexts.join('\n\n---\n\n');
  }

  async function searchWeb(query: string): Promise<string> {
    try {
      const res = await fetch('/api/firecrawl/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit: 5 }),
      });
      if (!res.ok) return '';
      const data = (await res.json()) as SearchResponse;
      if (!data.results?.length) return '';
      addCredits(CREDITS_PER_SEARCH);
      return data.results
        .map(r => `### ${r.title || r.url}\nZdroj: ${r.url}\n\n${(r.markdown?.slice(0, 1500) || r.description || '')}`)
        .join('\n\n---\n\n');
    } catch { return ''; }
  }

  // ── Uložení do DB ─────────────────────────────────────────────────────────

  async function persistMessage(
    convId: string,
    role: 'user' | 'assistant',
    content: string,
    opts?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
      costUsd?: number;
      webContext?: boolean;
    }
  ) {
    if (!currentWorkspace) return;
    await supabase.from('trackino_ai_messages').insert({
      conversation_id: convId,
      workspace_id: currentWorkspace.id,
      role,
      content,
      model_id: role === 'assistant' ? selectedModel : null,
      prompt_tokens: opts?.promptTokens ?? null,
      completion_tokens: opts?.completionTokens ?? null,
      total_tokens: opts?.totalTokens ?? null,
      cost_usd: opts?.costUsd ?? null,
      web_context: opts?.webContext ?? false,
    });
    await supabase
      .from('trackino_ai_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', convId);
  }

  async function ensureConversation(firstMessage: string): Promise<string> {
    if (activeConvId) return activeConvId;
    if (!user || !currentWorkspace) return '';
    const title = autoTitle(firstMessage);
    const { data } = await supabase
      .from('trackino_ai_conversations')
      .insert({
        workspace_id: currentWorkspace.id,
        user_id: user.id,
        title,
        model_id: selectedModel,
        system_prompt: systemPrompt,
      })
      .select()
      .single();
    if (!data) return '';
    const newId = (data as AiConversation).id;
    setActiveConvId(newId);
    fetchConversations();
    return newId;
  }

  // ── Odeslání zprávy ──────────────────────────────────────────────────────

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

    // Firecrawl kontext
    let webContext = '';
    const urls = extractUrls(text);
    if (urls.length > 0) {
      setFirecrawlStatus('scraping');
      webContext = await scrapeUrls(urls);
      setFirecrawlStatus('idle');
    } else if (webSearchEnabled) {
      setFirecrawlStatus('searching');
      webContext = await searchWeb(text);
      setFirecrawlStatus('idle');
    }

    const contextBlock = webContext
      ? `\n\n---\nKontext z webu (použij tyto informace při odpovědi, uveď zdroje):\n\n${webContext}\n---`
      : '';
    const enhancedSystemPrompt = (systemPrompt.trim() || '') + contextBlock;

    if (webContext) {
      setMessages(prev => prev.map(m => m.id === userMsg.id ? { ...m, webContext: true } : m));
    }

    // Zajisti/vytvoř konverzaci v DB
    const convId = await ensureConversation(text);

    // Ulož user zprávu
    if (convId) {
      await persistMessage(convId, 'user', text, { webContext: !!webContext });
    }

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
          systemPrompt: enhancedSystemPrompt.trim() || undefined,
          stream: supportsStream,
          temperature,
        }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(), role: 'assistant',
          content: err.error ?? 'Chyba při komunikaci s AI.',
          timestamp: new Date(), error: true,
        }]);
        return;
      }

      if (supportsStream && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        type UsageData = { prompt_tokens: number; completion_tokens: number; total_tokens: number };
        let usageData: UsageData | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);

          // Detekuj usage suffix
          const usageIdx = chunk.indexOf('\n__USAGE__:');
          if (usageIdx !== -1) {
            fullContent += chunk.slice(0, usageIdx);
            try {
              usageData = JSON.parse(chunk.slice(usageIdx + '\n__USAGE__:'.length)) as UsageData;
            } catch { /* ignoruj */ }
          } else {
            fullContent += chunk;
          }
          setStreamingContent(fullContent);
        }

        // Vypočítej cenu
        let costUsd: number | undefined;
        if (usageData && currentModel) {
          costUsd = calcCostUsd(currentModel, usageData.prompt_tokens, usageData.completion_tokens);
        }

        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: fullContent,
          timestamp: new Date(),
          tokens: usageData?.total_tokens,
          promptTokens: usageData?.prompt_tokens,
          completionTokens: usageData?.completion_tokens,
          costUsd,
        };
        setMessages(prev => [...prev, assistantMsg]);
        setStreamingContent('');

        if (convId && fullContent) {
          await persistMessage(convId, 'assistant', fullContent, {
            promptTokens: usageData?.prompt_tokens,
            completionTokens: usageData?.completion_tokens,
            totalTokens: usageData?.total_tokens,
            costUsd,
          });
        }
      } else {
        const data = (await res.json()) as { content: string; usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } };
        let costUsd: number | undefined;
        if (data.usage && currentModel) {
          costUsd = calcCostUsd(currentModel, data.usage.prompt_tokens, data.usage.completion_tokens);
        }
        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(), role: 'assistant',
          content: data.content, timestamp: new Date(),
          tokens: data.usage?.total_tokens,
          promptTokens: data.usage?.prompt_tokens,
          completionTokens: data.usage?.completion_tokens,
          costUsd,
        };
        setMessages(prev => [...prev, assistantMsg]);

        if (convId && data.content) {
          await persistMessage(convId, 'assistant', data.content, {
            promptTokens: data.usage?.prompt_tokens,
            completionTokens: data.usage?.completion_tokens,
            totalTokens: data.usage?.total_tokens,
            costUsd,
          });
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(), role: 'assistant',
          content: 'Spojení bylo přerušeno.', timestamp: new Date(), error: true,
        }]);
      }
    } finally {
      setIsLoading(false);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, isLoading, messages, selectedModel, systemPrompt, temperature, currentModel, webSearchEnabled, activeConvId]);

  const stopStreaming = () => { abortRef.current?.abort(); };

  const clearConversation = () => {
    setMessages([]);
    setStreamingContent('');
    setActiveConvId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  // Extrahuje prostý text z HTML obsahu promptu
  function htmlToPlainText(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  async function fetchFavoritePrompts() {
    if (!currentWorkspace || !user) return;
    if (favPromptsLoaded) { setShowFavPrompts(s => !s); return; }
    const { data: favs } = await supabase
      .from('trackino_prompt_favorites')
      .select('prompt_id')
      .eq('user_id', user.id);
    const ids = (favs ?? []).map((f: { prompt_id: string }) => f.prompt_id);
    if (ids.length === 0) {
      setFavoritePrompts([]);
      setFavPromptsLoaded(true);
      setShowFavPrompts(true);
      return;
    }
    const { data: prompts } = await supabase
      .from('trackino_prompts')
      .select('id, title, content')
      .eq('workspace_id', currentWorkspace.id)
      .in('id', ids)
      .order('title');
    setFavoritePrompts((prompts ?? []).map((p: { id: string; title: string; content: string }) => ({
      id: p.id, title: p.title, content: p.content,
    })));
    setFavPromptsLoaded(true);
    setShowFavPrompts(true);
  }

  function usePrompt(prompt: FavoritePrompt) {
    const text = htmlToPlainText(prompt.content);
    setInput(text);
    setShowFavPrompts(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function copyPrompt(prompt: FavoritePrompt) {
    const text = htmlToPlainText(prompt.content);
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedPromptId(prompt.id);
    setTimeout(() => setCopiedPromptId(null), 1500);
  }

  // Přístup: tarif Max + canUseAiAssistant
  if (!hasModule('ai_assistant') || !canUseAiAssistant) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text-muted)' }}>
            <path d="M12 2a8 8 0 0 1 8 8c0 3.5-2 6.5-5 7.7V20h-6v-2.3C6 16.5 4 13.5 4 10a8 8 0 0 1 8-8z"/>
            <line x1="9" y1="20" x2="15" y2="20"/><line x1="9" y1="23" x2="15" y2="23"/>
          </svg>
          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>AI asistent</p>
          <p className="text-sm max-w-xs" style={{ color: 'var(--text-muted)' }}>
            {!hasModule('ai_assistant')
              ? 'AI asistent je dostupný pouze v tarifu Max.'
              : 'Nemáte oprávnění k AI asistentovi. Požádejte admina o přístup.'}
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const isFirecrawlBusyBool = firecrawlStatus !== 'idle';

  return (
    <DashboardLayout>
      <style>{AI_MSG_STYLES}</style>

      {/* Mobilní overlay sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex h-full -m-4 lg:-m-6" style={{ height: 'calc(100vh - 64px)' }}>

        {/* ── Levý sidebar: seznam konverzací ─────────────────────────────── */}
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
            ) : filteredConvs.map(conv => (
              <button
                key={conv.id}
                onClick={() => loadConversation(conv.id)}
                className="w-full text-left px-2.5 py-2 rounded-lg group relative transition-colors"
                style={{
                  background: activeConvId === conv.id ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'transparent',
                  border: activeConvId === conv.id ? '1px solid color-mix(in srgb, var(--primary) 25%, transparent)' : '1px solid transparent',
                }}
              >
                <p
                  className="text-xs font-medium truncate pr-6"
                  style={{ color: activeConvId === conv.id ? 'var(--primary)' : 'var(--text-primary)' }}
                >
                  {conv.title}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {fmtDate(conv.updated_at)} · {AI_MODELS.find(m => m.id === conv.model_id)?.name ?? conv.model_id}
                </p>
                {/* Mazací tlačítko */}
                <button
                  onClick={e => deleteConversation(conv.id, e)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: '#ef4444' }}
                  title="Smazat konverzaci"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                </button>
              </button>
            ))}
          </div>

          {/* Sidebar footer – Firecrawl kredity */}
          {firecrawlAvailable && (
            <div className="p-3 border-t text-xs flex-shrink-0" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              <div className="flex items-center justify-between mb-1">
                <span>Firecrawl kredity</span>
                <span style={{ color: creditColor }}>{creditsUsed} / {FIRECRAWL_CREDIT_LIMIT}</span>
              </div>
              <div className="w-full rounded-full h-1" style={{ background: 'var(--bg-hover)' }}>
                <div
                  className="h-1 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (creditsUsed / FIRECRAWL_CREDIT_LIMIT) * 100)}%`, background: creditColor }}
                />
              </div>
            </div>
          )}
        </aside>

        {/* ── Pravá část: chat ──────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 p-4 lg:p-6 overflow-hidden">

          {/* Header chatu */}
          <div className="flex items-center gap-2 mb-4 flex-shrink-0">
            {/* Hamburger pro mobilní sidebar */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg"
              style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <h1 className="text-xl font-semibold flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
              {activeConvId
                ? (conversations.find(c => c.id === activeConvId)?.title ?? 'Konverzace')
                : 'AI asistent'}
            </h1>
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <button
                  onClick={clearConversation}
                  className="text-xs px-3 py-1.5 rounded-lg transition-colors hidden sm:block"
                  style={{ color: 'var(--text-muted)', background: 'var(--bg-hover)' }}
                >
                  Nová konverzace
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
                <span className="hidden sm:inline">Nastavení</span>
              </button>
            </div>
          </div>

          {/* OpenAI API chyba */}
          {apiConfigured === false && (
            <div className="mb-3 p-3 rounded-xl text-sm flex-shrink-0" style={{ background: '#ef444418', border: '1px solid #ef444440', color: '#ef4444' }}>
              <strong>API klíč OpenAI není nastaven.</strong> Přidejte <code className="mx-1 px-1 rounded" style={{ background: '#ef444422' }}>OPENAI_API_KEY</code> do <code className="mx-1 px-1 rounded" style={{ background: '#ef444422' }}>.env.local</code>.
            </div>
          )}

          {/* Nastavení panel */}
          {showSettings && (
            <div className="mb-3 p-4 rounded-xl flex-shrink-0" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Temperature (kreativita): <strong style={{ color: 'var(--text-primary)' }}>{temperature}</strong></label>
                  <input type="range" min="0" max="1" step="0.05" value={temperature}
                    onChange={e => setTemperature(parseFloat(e.target.value))}
                    className="w-full" style={{ accentColor: 'var(--primary)' }} />
                  <div className="flex justify-between text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    <span>Přesné (0)</span><span>Kreativní (1)</span>
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <button onClick={() => setShowSystemPrompt(s => !s)} className="text-xs flex items-center gap-1 mb-2" style={{ color: 'var(--text-muted)' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: showSystemPrompt ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}><polyline points="9 18 15 12 9 6"/></svg>
                  System prompt (pokyny pro AI)
                </button>
                {showSystemPrompt && (
                  <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)}
                    placeholder="Např.: Jsi asistent pro HR oddělení. Odpovídej stručně a v češtině."
                    rows={3} className="w-full text-base sm:text-sm px-3 py-2 rounded-lg resize-none"
                    style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                )}
              </div>
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
                        if (firecrawlAvailable && i >= 4) { setWebSearchEnabled(true); setInput(s); }
                        else setInput(s);
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
            {isFirecrawlBusyBool && (
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

          {/* ── Input oblast ─────────────────────────────────────────────────── */}
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
                  isFirecrawlBusyBool
                    ? (firecrawlStatus === 'searching' ? 'Prohledávám web…' : 'Čtu stránku…')
                    : isLoading ? 'AI odpovídá…'
                    : 'Napište zprávu… (Enter = odeslat, Shift+Enter = nový řádek)'
                }
                rows={3}
                disabled={isLoading || isFirecrawlBusyBool}
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
                <button onClick={sendMessage} disabled={!input.trim() || isFirecrawlBusyBool}
                  className="px-4 py-2 rounded-lg text-sm font-medium flex-shrink-0 transition-colors flex items-center gap-1.5 self-end mb-0.5"
                  style={{
                    background: input.trim() && !isFirecrawlBusyBool ? 'var(--primary)' : 'var(--bg-hover)',
                    color: input.trim() && !isFirecrawlBusyBool ? '#fff' : 'var(--text-muted)',
                    cursor: input.trim() && !isFirecrawlBusyBool ? 'pointer' : 'not-allowed',
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
                <div className="flex flex-wrap items-center gap-1">
                  {AI_MODELS.map(m => (
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
                      {m.name}
                      {m.badge && selectedModel !== m.id && (
                        <span className="text-[10px] px-1 rounded" style={{ background: '#10b98115', color: '#10b981' }}>★</span>
                      )}
                    </button>
                  ))}
                  {/* Info tlačítko */}
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

                  {/* Oblíbené prompty */}
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

                {/* Stavový řádek */}
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {systemPrompt.trim() && <span style={{ color: 'var(--primary)' }}>· System prompt</span>}
                  {webSearchEnabled && firecrawlAvailable && <span className="ml-1" style={{ color: '#10b981' }}>· Web search</span>}
                  {totalCostCzk && <span className="ml-1">· {totalCostCzk}</span>}
                </p>
              </div>

              {/* Pravá část: token counter */}
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
                {messages.length > 0 && (
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {messages.length} {messages.length === 1 ? 'zpráva' : messages.length < 5 ? 'zprávy' : 'zpráv'}
                  </span>
                )}
              </div>
            </div>

            {/* ── Panel oblíbených promptů ──────────────────────────────────── */}
            {showFavPrompts && (
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
                        {/* Tlačítko kopírovat */}
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
            )}

            {/* ── Info dialog o modelech ─────────────────────────────────────── */}
            {showModelInfo && (
              <div className="mt-2 p-4 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Dostupné AI modely</p>
                  <button onClick={() => setShowModelInfo(false)} style={{ color: 'var(--text-muted)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {AI_MODELS.map(m => {
                    const model = m;
                    const inputCzk = formatCostCzk(model.inputCostPer1M / 1_000_000 * 1000);
                    const outputCzk = formatCostCzk(model.outputCostPer1M / 1_000_000 * 1000);
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
                          <span>Kontext: <strong style={{ color: 'var(--text-primary)' }}>{(m.contextWindow / 1000).toFixed(0)}k</strong></span>
                          <span>Streaming: <strong style={{ color: 'var(--text-primary)' }}>{m.supportsStreaming ? 'Ano' : 'Ne'}</strong></span>
                          <span title={`$${m.inputCostPer1M}/1M tokenů`}>Input: <strong style={{ color: 'var(--text-primary)' }}>{inputCzk}/1k</strong></span>
                          <span title={`$${m.outputCostPer1M}/1M tokenů`}>Output: <strong style={{ color: 'var(--text-primary)' }}>{outputCzk}/1k</strong></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
                  Ceny jsou orientační dle OpenAI API ceníku (kurz {CZK_PER_USD} Kč/USD). Přesné ceny viz{' '}
                  <a href="https://openai.com/api/pricing" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>openai.com/api/pricing</a>.
                </p>
              </div>
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

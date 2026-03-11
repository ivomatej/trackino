import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { AI_MODELS, DEFAULT_MODEL_ID, calcCostUsd, formatCostCzk } from '@/lib/ai-providers';
import { supabase } from '@/lib/supabase';
import type { AiChatMessage } from '@/app/api/ai-chat/route';
import type { ScrapeResponse } from '@/app/api/firecrawl/scrape/route';
import type { SearchResponse } from '@/app/api/firecrawl/search/route';
import type { AiConversation, AiMessage } from '@/types/database';
import type { ChatMessage, FirecrawlStatus, FavoritePrompt } from './types';
import { estimateTokens, extractUrls, autoTitle, htmlToPlainText } from './utils';
import {
  FIRECRAWL_CREDIT_LIMIT,
  CREDITS_PER_SCRAPE,
  CREDITS_PER_SEARCH,
  FIRECRAWL_CREDITS_KEY,
} from './constants';

export function useAiAssistant() {
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

  const estimatedConvTokens = useMemo(
    () => messages.reduce((sum, m) => sum + estimateTokens(m.content), 0),
    [messages]
  );
  const contextWindow = currentModel?.contextWindow ?? 128_000;
  const tokenFraction = Math.min(estimatedConvTokens / contextWindow, 1);
  const tokenBarColor = tokenFraction < 0.5 ? '#10b981' : tokenFraction < 0.8 ? '#f59e0b' : tokenFraction < 0.95 ? '#f97316' : '#ef4444';

  const exactTotalTokens = messages.reduce((sum, m) => sum + (m.tokens ?? 0), 0);
  const showTokens = exactTotalTokens > 0 ? exactTotalTokens : estimatedConvTokens;

  const totalCostCzk = useMemo(() => {
    const totalUsd = messages.reduce((sum, m) => sum + (m.costUsd ?? 0), 0);
    if (totalUsd <= 0) return null;
    return formatCostCzk(totalUsd);
  }, [messages]);

  const filteredConvs = useMemo(() => {
    if (!convSearch.trim()) return conversations;
    const q = convSearch.toLowerCase();
    return conversations.filter(c => c.title.toLowerCase().includes(q));
  }, [conversations, convSearch]);

  const favConvs = useMemo(() => filteredConvs.filter(c => c.is_favorite), [filteredConvs]);
  const regularConvs = useMemo(() => filteredConvs.filter(c => !c.is_favorite), [filteredConvs]);

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

  useEffect(() => {
    if (!user || !currentWorkspace) return;
    fetchConversations();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, currentWorkspace?.id]);

  // ── Konverzace CRUD ──────────────────────────────────────────────────────

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

  async function toggleFavorite(convId: string, e: React.MouseEvent) {
    e.stopPropagation();
    const conv = conversations.find(c => c.id === convId);
    if (!conv) return;
    const newVal = !conv.is_favorite;
    await supabase.from('trackino_ai_conversations').update({ is_favorite: newVal }).eq('id', convId);
    setConversations(prev => prev.map(c => c.id === convId ? { ...c, is_favorite: newVal } : c));
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

    const convId = await ensureConversation(text);
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

  // ── Oblíbené prompty ─────────────────────────────────────────────────────

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

  return {
    // Permissions
    hasModule,
    canUseAiAssistant,
    isWorkspaceAdmin,
    isMasterAdmin,

    // Conversations state
    conversations,
    activeConvId,
    convSearch,
    setConvSearch,
    loadingConvs,
    filteredConvs,
    favConvs,
    regularConvs,

    // Chat state
    messages,
    input,
    setInput,
    selectedModel,
    setSelectedModel,
    systemPrompt,
    setSystemPrompt,
    showSystemPrompt,
    setShowSystemPrompt,
    temperature,
    setTemperature,
    showSettings,
    setShowSettings,
    isLoading,
    streamingContent,
    apiConfigured,
    showModelInfo,
    setShowModelInfo,

    // Prompts state
    favoritePrompts,
    showFavPrompts,
    setShowFavPrompts,
    favPromptsLoaded,
    copiedPromptId,

    // Firecrawl state
    webSearchEnabled,
    setWebSearchEnabled,
    firecrawlStatus,
    firecrawlAvailable,
    creditsUsed,

    // Sidebar
    sidebarOpen,
    setSidebarOpen,

    // Refs
    messagesEndRef,
    inputRef,

    // Computed
    currentModel,
    isFirecrawlBusy,
    creditsRemaining,
    creditColor,
    detectedUrls,
    contextWindow,
    tokenFraction,
    tokenBarColor,
    showTokens,
    totalCostCzk,

    // Functions
    fetchConversations,
    loadConversation,
    newConversation,
    deleteConversation,
    toggleFavorite,
    sendMessage,
    stopStreaming,
    clearConversation,
    handleKeyDown,
    fetchFavoritePrompts,
    usePrompt,
    copyPrompt,
  };
}

export type UseAiAssistantReturn = ReturnType<typeof useAiAssistant>;

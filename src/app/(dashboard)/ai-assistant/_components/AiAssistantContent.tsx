'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { AI_MSG_STYLES } from './constants';
import { useAiAssistant } from './useAiAssistant';
import { ConversationSidebar } from './ConversationSidebar';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';

export function AiAssistantContent() {
  const ai = useAiAssistant();

  const {
    hasModule,
    canUseAiAssistant,
    sidebarOpen,
    setSidebarOpen,
    activeConvId,
    conversations,
    messages,
    clearConversation,
    showSettings,
    setShowSettings,
    showSystemPrompt,
    setShowSystemPrompt,
    systemPrompt,
    setSystemPrompt,
    temperature,
    setTemperature,
    apiConfigured,
  } = ai;

  // Přístup: tarif Max + canUseAiAssistant
  if (!hasModule('ai_assistant') || !canUseAiAssistant) {
    return (
      <DashboardLayout moduleName="AI Asistent">
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

  return (
    <DashboardLayout moduleName="AI Asistent">
      <style>{AI_MSG_STYLES}</style>

      {/* Mobilní overlay sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex -m-4 lg:-m-6" style={{ height: 'calc(100vh - var(--topbar-height, 56px) - 2rem)' }}>

        {/* Levý sidebar: seznam konverzací */}
        <ConversationSidebar ai={ai} />

        {/* Pravá část: chat */}
        <div className="flex-1 flex flex-col min-w-0 p-4 lg:p-6 overflow-hidden">

          {/* Header chatu */}
          <div className="flex items-center gap-2 mb-4 flex-shrink-0">
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
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                <span className="hidden sm:inline">Nastavení</span>
              </button>
            </div>
          </div>

          {/* API klíč chyba */}
          {apiConfigured === false && (
            <div className="mb-3 p-3 rounded-xl text-sm flex-shrink-0" style={{ background: '#ef444418', border: '1px solid #ef444440', color: '#ef4444' }}>
              <strong>API klíč pro vybraný model není nastaven.</strong> Přidejte příslušný klíč do proměnných prostředí na Vercelu.
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
          <ChatMessages ai={ai} />

          {/* Input oblast */}
          <ChatInput ai={ai} />

        </div>
      </div>
    </DashboardLayout>
  );
}

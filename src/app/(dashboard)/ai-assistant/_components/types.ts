// Lokální typy pro AI asistent

export interface ChatMessage {
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

export type FirecrawlStatus = 'idle' | 'searching' | 'scraping';

export interface FavoritePrompt {
  id: string;
  title: string;
  content: string;
}

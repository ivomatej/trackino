// Trackino – typy pro AI asistenta

export interface AiConversation {
  id: string;
  workspace_id: string;
  user_id: string;
  title: string;
  model_id: string;
  system_prompt: string;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface AiMessage {
  id: string;
  conversation_id: string;
  workspace_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model_id: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  cost_usd: number | null;
  web_context: boolean;
  created_at: string;
}

export type AiLimitType = 'daily' | 'weekly' | 'monthly';

export interface AiUsageLimit {
  id: string;
  workspace_id: string;
  user_id: string | null; // null = workspace-wide default
  limit_type: AiLimitType;
  token_limit: number | null; // null = bez limitu
  created_at: string;
  updated_at: string;
}

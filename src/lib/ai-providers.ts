// Trackino – AI provider konfigurace
// Přidání nového providera: přidat do AiProvider type + AI_PROVIDERS + AI_MODELS

export type AiProvider = 'openai'; // Budoucí: | 'anthropic' | 'google' | 'mistral'

export interface AiModel {
  id: string;
  name: string;
  provider: AiProvider;
  description: string;
  contextWindow: number; // v tokenech
  supportsStreaming: boolean;
}

export interface AiProviderConfig {
  id: AiProvider;
  name: string;
  envKey: string; // název env proměnné pro API klíč
  baseUrl: string; // OpenAI-compatible API base URL
  available: boolean; // true pokud je env klíč nastaven
}

/** Konfigurace providerů – přidávat sem při rozšíření */
export const AI_PROVIDERS: AiProviderConfig[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    envKey: 'OPENAI_API_KEY',
    baseUrl: 'https://api.openai.com/v1',
    available: !!process.env.OPENAI_API_KEY,
  },
  // Budoucí provideri (odkomentovat + přidat env klíče):
  // {
  //   id: 'anthropic',
  //   name: 'Anthropic',
  //   envKey: 'ANTHROPIC_API_KEY',
  //   baseUrl: 'https://api.anthropic.com/v1',
  //   available: !!process.env.ANTHROPIC_API_KEY,
  // },
  // {
  //   id: 'google',
  //   name: 'Google Gemini',
  //   envKey: 'GOOGLE_AI_API_KEY',
  //   baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
  //   available: !!process.env.GOOGLE_AI_API_KEY,
  // },
  // {
  //   id: 'mistral',
  //   name: 'Mistral AI',
  //   envKey: 'MISTRAL_API_KEY',
  //   baseUrl: 'https://api.mistral.ai/v1',
  //   available: !!process.env.MISTRAL_API_KEY,
  // },
];

/** Dostupné modely – přidávat sem při spuštění nových verzí */
export const AI_MODELS: AiModel[] = [
  // ─── OpenAI ───────────────────────────────────────────────────────────────
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    description: 'Nejsilnější model – text, kód, analýza. Doporučeno pro složité úlohy.',
    contextWindow: 128_000,
    supportsStreaming: true,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o mini',
    provider: 'openai',
    description: 'Rychlý a levný model pro jednoduché úlohy a drafty.',
    contextWindow: 128_000,
    supportsStreaming: true,
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    description: 'Výkonný model s velkým kontextovým oknem.',
    contextWindow: 128_000,
    supportsStreaming: true,
  },
  {
    id: 'o1-mini',
    name: 'o1-mini',
    provider: 'openai',
    description: 'Reasoning model pro logiku, matematiku a kód.',
    contextWindow: 128_000,
    supportsStreaming: false,
  },
  // Budoucí modely jiných providerů:
  // { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic', ... },
  // { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'google', ... },
  // { id: 'mistral-large-latest', name: 'Mistral Large', provider: 'mistral', ... },
];

/** Výchozí model pro nové konverzace */
export const DEFAULT_MODEL_ID = 'gpt-4o-mini';

/** Vrátí konfiguraci providera pro daný model */
export function getProviderForModel(modelId: string): AiProviderConfig | undefined {
  const model = AI_MODELS.find(m => m.id === modelId);
  if (!model) return undefined;
  return AI_PROVIDERS.find(p => p.id === model.provider);
}

/** Vrátí modely dostupné pro daného providera */
export function getModelsForProvider(provider: AiProvider): AiModel[] {
  return AI_MODELS.filter(m => m.provider === provider);
}

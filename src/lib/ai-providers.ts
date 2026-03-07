// Trackino – AI provider konfigurace
// Přidání nového providera: přidat do AiProvider type + AI_PROVIDERS + AI_MODELS

export type AiProvider = 'openai'; // Budoucí: | 'anthropic' | 'google' | 'mistral'

export interface AiModel {
  id: string;
  name: string;
  provider: AiProvider;
  description: string;
  longDescription: string; // podrobnější popis pro info dialog
  contextWindow: number; // v tokenech
  supportsStreaming: boolean;
  inputCostPer1M: number;  // USD za 1M input tokenů
  outputCostPer1M: number; // USD za 1M output tokenů
  badge?: string; // volitelný badge (např. 'Doporučeno')
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
];

/** Dostupné modely – přidávat sem při spuštění nových verzí */
export const AI_MODELS: AiModel[] = [
  // ─── OpenAI ───────────────────────────────────────────────────────────────
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    description: 'Nejsilnější model – text, kód, analýza.',
    longDescription: 'Nejschopnější multimodální model OpenAI. Vyniká v komplexním uvažování, analýze dat, psaní kódu a generování obsahu. Vhodný pro náročné úlohy, kde záleží na kvalitě výstupu. Pomalejší a dražší než mini varianta.',
    contextWindow: 128_000,
    supportsStreaming: true,
    inputCostPer1M: 2.50,
    outputCostPer1M: 10.00,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o mini',
    provider: 'openai',
    description: 'Rychlý a levný model pro jednoduché úlohy.',
    longDescription: 'Odlehčená verze GPT-4o – velmi rychlá a cenově efektivní. Vhodná pro jednoduché dotazy, shrnutí, drafty a každodenní asistenci. Výkon srovnatelný s GPT-3.5 Turbo při výrazně nižší ceně. Doporučený výchozí model.',
    contextWindow: 128_000,
    supportsStreaming: true,
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.60,
    badge: 'Doporučeno',
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    description: 'Výkonný model s velkým kontextovým oknem.',
    longDescription: 'Předchůdce GPT-4o s vynikajícím výkonem na analytické úlohy. Velké kontextové okno (128k tokenů) umožňuje zpracovat rozsáhlé dokumenty najednou. Vhodný pro detailní analýzy, překlady dlouhých textů a komplexní kódovací projekty.',
    contextWindow: 128_000,
    supportsStreaming: true,
    inputCostPer1M: 10.00,
    outputCostPer1M: 30.00,
  },
  {
    id: 'o1-mini',
    name: 'o1-mini',
    provider: 'openai',
    description: 'Reasoning model pro logiku, matematiku a kód.',
    longDescription: 'Specializovaný „reasoning" model – před odpovědí si „přemýšlí" (chain-of-thought). Exceluje v matematice, logice, algoritmech a ladění kódu. Nevhodný pro běžnou konverzaci nebo kreativní psaní. Nepodporuje streaming – odpovědi přicházejí najednou.',
    contextWindow: 128_000,
    supportsStreaming: false,
    inputCostPer1M: 1.10,
    outputCostPer1M: 4.40,
  },
];

/** Výchozí model pro nové konverzace */
export const DEFAULT_MODEL_ID = 'gpt-4o-mini';

/** Kurz USD → CZK pro přibližný výpočet ceny */
export const CZK_PER_USD = 23;

/**
 * Vypočítá odhadovanou cenu za konverzaci v USD.
 * Pozn.: Vrací pouze přibližnou hodnotu (přesné tokeny závisí na tokenizéru modelu).
 */
export function calcCostUsd(
  model: AiModel,
  promptTokens: number,
  completionTokens: number
): number {
  return (promptTokens / 1_000_000) * model.inputCostPer1M
       + (completionTokens / 1_000_000) * model.outputCostPer1M;
}

/** Formátuje cenu v USD → Kč */
export function formatCostCzk(usd: number): string {
  const czk = usd * CZK_PER_USD;
  if (czk < 0.01) return '< 0,01 Kč';
  return `${czk.toFixed(2).replace('.', ',')} Kč`;
}

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

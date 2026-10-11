/**
 * Anbieter für KI-Anrufer (Stand der Doku-Recherche: Oktober 2026). Der Spieler wählt einen
 * Anbieter, trägt seinen eigenen Schlüssel ein und kann das Modell ändern. Groq und OpenRouter
 * sprechen die OpenAI-kompatible Chat-Schnittstelle, Gemini die eigene REST-Schnittstelle
 * (deren OpenAI-Schicht ist im Browser wegen CORS unzuverlässig), Claude das offizielle SDK.
 */
export const AI_PROVIDERS = ['groq', 'gemini', 'openrouter', 'claude'] as const;
export type AiProviderId = (typeof AI_PROVIDERS)[number];

/** Wie die Antwort als JSON erzwungen wird: Schema, nur „gültiges JSON“ oder nur per Anweisung. */
export type JsonMode = 'schema' | 'object' | 'prompt';

export interface AiProviderDef {
  id: AiProviderId;
  /** Schnittstelle. */
  api: 'openai' | 'gemini' | 'anthropic';
  baseUrl: string;
  /** Schnell, gutes Deutsch, kann strukturiert antworten. */
  defaultModel: string;
  /** Vorschläge zum Durchschalten in der Systemsteuerung (eigenes Modell geht auch). */
  models: readonly string[];
  /** Antwort streamen (Groq: strukturierte Ausgabe geht laut Doku nicht zusammen mit Streaming). */
  stream: boolean;
  json: JsonMode;
  /** Höchstzahl Ausgabe-Tokens (Denk-Modelle brauchen etwas Puffer). */
  maxTokens: number;
  /** Kostenlose Stufe vorhanden (Hinweis in der Systemsteuerung). */
  free: boolean;
  /** Typischer Anfang des Schlüssels (nur als Plausibilitäts-Hinweis). */
  keyPrefix: string;
  /** Zusätzliche Felder im Anfrage-Körper je Modell (z. B. wenig Nachdenken bei GPT-OSS). */
  extra?(model: string): Record<string, unknown>;
}

export const AI_PROVIDER_DEFS: Readonly<Record<AiProviderId, AiProviderDef>> = {
  groq: {
    id: 'groq',
    api: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    // Strikte Schemas laut Doku nur bei den GPT-OSS-Modellen; sehr schnell, kostenlose Stufe.
    defaultModel: 'openai/gpt-oss-20b',
    models: ['openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'qwen/qwen3.8-27b'],
    stream: false,
    json: 'schema',
    maxTokens: 700,
    free: true,
    keyPrefix: 'gsk_',
    extra: (model) => (model.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low', include_reasoning: false } : {}),
  },
  gemini: {
    id: 'gemini',
    api: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    // Flash-Lite: schnell, gutes Deutsch, strukturierte Ausgabe, Denken standardmäßig minimal.
    defaultModel: 'gemini-3.5-flash-lite',
    models: ['gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite'],
    stream: true,
    json: 'schema',
    maxTokens: 600,
    free: true,
    keyPrefix: 'AIza',
  },
  openrouter: {
    id: 'openrouter',
    api: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    // Kostenlose Modelle tragen „:free“; die Auswahl wechselt oft, deshalb mehrere Vorschläge.
    defaultModel: 'google/gemma-4-31b-it:free',
    models: ['google/gemma-4-31b-it:free', 'qwen/qwen3.8-27b:free', 'nvidia/nemotron-3-super-120b-a12b:free', 'openrouter/free'],
    stream: true,
    json: 'schema',
    maxTokens: 500,
    free: true,
    keyPrefix: 'sk-or-',
  },
  claude: {
    id: 'claude',
    api: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-haiku-5-5',
    models: ['claude-haiku-5-5', 'claude-sonnet-5-5'],
    stream: true,
    json: 'schema',
    maxTokens: 400,
    free: false,
    keyPrefix: 'sk-ant-',
  },
};

export function providerDef(id: AiProviderId): AiProviderDef {
  return AI_PROVIDER_DEFS[id];
}

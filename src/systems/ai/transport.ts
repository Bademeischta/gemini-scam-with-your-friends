import type { AiProviderDef, JsonMode } from '../../data/aiProviders';
import { VERDICT_SCHEMA } from './rules';

/** Eine Nachricht im Gespräch mit der KI (System-Nachrichten = Regie mitten im Gespräch). */
export interface AiMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AiRequest {
  system: string;
  messages: AiMessage[];
  /** Antwort als JSON erzwingen (Schema, nur JSON, nur per Anweisung). Standard: laut Anbieter. */
  json?: JsonMode;
}

/** Token-Verbrauch einer Anfrage. */
export interface AiUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export interface AiResponse {
  json: string;
  usage: AiUsage;
}

/** Warum eine Anfrage scheiterte (für Hinweis, Wiederholung, nächsten Anbieter oder lokale Engine). */
export type AiFailure = 'auth' | 'permission' | 'rate' | 'overloaded' | 'network' | 'timeout' | 'refusal' | 'badRequest' | 'aborted' | 'other';

export class AiError extends Error {
  constructor(
    readonly kind: AiFailure,
    message: string = kind,
    readonly usage: AiUsage | null = null,
    /** Wartezeit laut Anbieter (Rate-Limit), falls bekannt. */
    readonly retryAfterMs: number | null = null,
  ) {
    super(message);
  }
}

/** Austauschbar für Tests: schickt eine Anfrage und meldet den bisher gestreamten Text. */
export interface AiTransport {
  send(req: AiRequest, onText: (snapshot: string) => void, signal: AbortSignal): Promise<AiResponse>;
}

export const NO_USAGE: AiUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

type FetchFn = typeof fetch;

/** Transport für einen Anbieter (mit dessen Schlüssel und Modell). */
export function makeTransport(def: AiProviderDef, key: string, model: string, fetchFn?: FetchFn): AiTransport {
  switch (def.api) {
    case 'anthropic':
      return new ClaudeTransport(key, model, def);
    case 'gemini':
      return new GeminiTransport(def, key, model, fetchFn ?? fetch.bind(globalThis));
    case 'openai':
      return new OpenAiCompatTransport(def, key, model, fetchFn ?? fetch.bind(globalThis));
  }
}

// ------------------------------------------------------------------ Claude (offizielles SDK)

/**
 * Claude API direkt aus dem Browser (offizielles SDK, `dangerouslyAllowBrowser`). Das SDK wird
 * erst beim ersten KI-Anruf geladen. System-Nachrichten im Verlauf sind hier erlaubt (Regie).
 */
export class ClaudeTransport implements AiTransport {
  private client: import('@anthropic-ai/sdk').default | null = null;

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly def: AiProviderDef,
  ) {}

  async send(req: AiRequest, onText: (snapshot: string) => void, signal: AbortSignal): Promise<AiResponse> {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    // Wiederholungen bei Rate-Limits macht das Spiel selbst (mit Meldung und Anbieter-Wechsel).
    this.client ??= new Anthropic({ apiKey: this.apiKey, dangerouslyAllowBrowser: true, maxRetries: 0 });
    const json = req.json ?? this.def.json;
    try {
      const stream = this.client.messages.stream(
        {
          model: this.model,
          max_tokens: this.def.maxTokens,
          system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
          messages: req.messages,
          thinking: { type: 'disabled' },
          output_config: { effort: 'low', ...(json === 'schema' ? { format: { type: 'json_schema', schema: VERDICT_SCHEMA } } : {}) },
        },
        { signal },
      );
      stream.on('text', (_delta, snapshot) => onText(snapshot));
      const msg = await stream.finalMessage();
      const u = msg.usage;
      const usage: AiUsage = { input: u.input_tokens, output: u.output_tokens, cacheRead: u.cache_read_input_tokens ?? 0, cacheWrite: u.cache_creation_input_tokens ?? 0 };
      if (msg.stop_reason === 'refusal') throw new AiError('refusal', 'refusal', usage);
      return { json: msg.content.map((b) => (b.type === 'text' ? b.text : '')).join(''), usage };
    } catch (err) {
      throw ClaudeTransport.classify(err, Anthropic);
    }
  }

  /** Fehler des SDK auf einen Grund abbilden (vom spezifischen zum allgemeinen). */
  private static classify(err: unknown, A: typeof import('@anthropic-ai/sdk').default): AiError {
    if (err instanceof AiError) return err;
    if (err instanceof A.APIUserAbortError) return new AiError('aborted');
    if (err instanceof A.APIConnectionTimeoutError) return new AiError('timeout');
    if (err instanceof A.APIConnectionError) return new AiError('network');
    if (err instanceof A.AuthenticationError) return new AiError('auth');
    if (err instanceof A.PermissionDeniedError) return new AiError('permission');
    if (err instanceof A.RateLimitError) return new AiError('rate', err.message, null, retryAfter(err.headers?.get('retry-after') ?? null));
    if (err instanceof A.BadRequestError) return new AiError('badRequest', err.message);
    if (err instanceof A.InternalServerError) return new AiError('overloaded');
    if (err instanceof A.APIError) return new AiError(err.status === 529 ? 'overloaded' : 'other', err.message);
    if (err instanceof DOMException && err.name === 'AbortError') return new AiError('aborted');
    return new AiError('other', err instanceof Error ? err.message : String(err));
  }
}

// ------------------------------------------------------------------ OpenAI-kompatibel (Groq, OpenRouter)

interface ChatChunk {
  choices?: { delta?: { content?: string | null }; message?: { content?: string | null }; finish_reason?: string | null }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } } | null;
  x_groq?: { usage?: { prompt_tokens?: number; completion_tokens?: number } };
  error?: { message?: string; code?: number | string };
}

/**
 * Gemeinsame OpenAI-kompatible Chat-Schnittstelle (`/chat/completions`) per `fetch`: Groq und
 * OpenRouter. Streaming über Server-Sent Events, JSON über `response_format`.
 */
export class OpenAiCompatTransport implements AiTransport {
  constructor(
    private readonly def: AiProviderDef,
    private readonly key: string,
    private readonly model: string,
    private readonly fetchFn: FetchFn,
  ) {}

  async send(req: AiRequest, onText: (snapshot: string) => void, signal: AbortSignal): Promise<AiResponse> {
    const json = req.json ?? this.def.json;
    const stream = this.def.stream;
    const body: Record<string, unknown> = {
      model: this.model,
      messages: [{ role: 'system', content: req.system }, ...req.messages],
      max_tokens: this.def.maxTokens,
      temperature: 0.8,
      stream,
      ...(stream ? { stream_options: { include_usage: true } } : {}),
      ...(json === 'schema' ? { response_format: { type: 'json_schema', json_schema: { name: 'antwort', strict: true, schema: VERDICT_SCHEMA } } } : {}),
      ...(json === 'object' ? { response_format: { type: 'json_object' } } : {}),
      ...(this.def.extra?.(this.model) ?? {}),
    };
    const res = await safeFetch(this.fetchFn, `${this.def.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.key}` },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) throw await httpError(res);
    let text = '';
    let usage: AiUsage = NO_USAGE;
    const take = (c: ChatChunk): void => {
      if (c.error) throw new AiError(errorKind(Number(c.error.code) || 0, c.error.message ?? ''), c.error.message ?? 'error');
      const u = c.usage ?? c.x_groq?.usage;
      if (u) usage = { input: u.prompt_tokens ?? 0, output: u.completion_tokens ?? 0, cacheRead: c.usage?.prompt_tokens_details?.cached_tokens ?? 0, cacheWrite: 0 };
      const ch = c.choices?.[0];
      const piece = ch?.delta?.content ?? ch?.message?.content ?? '';
      if (piece) {
        text += piece;
        onText(text);
      }
      if (ch?.finish_reason === 'content_filter') throw new AiError('refusal', 'content_filter', usage);
    };
    if (stream) await readSse(res, (data) => take(JSON.parse(data) as ChatChunk), signal);
    else take((await res.json()) as ChatChunk);
    return { json: text, usage };
  }
}

// ------------------------------------------------------------------ Gemini (eigene REST-Schnittstelle)

interface GeminiChunk {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number; cachedContentTokenCount?: number };
  promptFeedback?: { blockReason?: string };
  error?: { code?: number; message?: string; status?: string };
}

/**
 * Gemini API (`generateContent` bzw. `streamGenerateContent?alt=sse`) mit Schlüssel im Header.
 * Rollen: user/model; Regie (System-Nachrichten im Verlauf) wird an die Spieler-Nachricht gehängt.
 */
export class GeminiTransport implements AiTransport {
  constructor(
    private readonly def: AiProviderDef,
    private readonly key: string,
    private readonly model: string,
    private readonly fetchFn: FetchFn,
  ) {}

  async send(req: AiRequest, onText: (snapshot: string) => void, signal: AbortSignal): Promise<AiResponse> {
    const json = req.json ?? this.def.json;
    const stream = this.def.stream;
    const body = {
      systemInstruction: { parts: [{ text: req.system }] },
      contents: toGeminiContents(req.messages),
      generationConfig: {
        maxOutputTokens: this.def.maxTokens,
        temperature: 0.8,
        ...(json !== 'prompt' ? { responseMimeType: 'application/json' } : {}),
        ...(json === 'schema' ? { responseJsonSchema: VERDICT_SCHEMA } : {}),
      },
    };
    const action = stream ? 'streamGenerateContent?alt=sse' : 'generateContent';
    const res = await safeFetch(this.fetchFn, `${this.def.baseUrl}/models/${encodeURIComponent(this.model)}:${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.key },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) throw await httpError(res);
    let text = '';
    let usage: AiUsage = NO_USAGE;
    const take = (c: GeminiChunk): void => {
      if (c.error) throw new AiError(errorKind(c.error.code ?? 0, c.error.message ?? ''), c.error.message ?? 'error');
      if (c.promptFeedback?.blockReason) throw new AiError('refusal', c.promptFeedback.blockReason, usage);
      const m = c.usageMetadata;
      if (m) usage = { input: m.promptTokenCount ?? 0, output: (m.candidatesTokenCount ?? 0) + (m.thoughtsTokenCount ?? 0), cacheRead: m.cachedContentTokenCount ?? 0, cacheWrite: 0 };
      const cand = c.candidates?.[0];
      for (const p of cand?.content?.parts ?? []) {
        if (p.thought || !p.text) continue;
        text += p.text;
        onText(text);
      }
      if (cand?.finishReason === 'SAFETY' || cand?.finishReason === 'PROHIBITED_CONTENT' || cand?.finishReason === 'BLOCKLIST') throw new AiError('refusal', cand.finishReason, usage);
    };
    if (stream) await readSse(res, (data) => take(JSON.parse(data) as GeminiChunk), signal);
    else take((await res.json()) as GeminiChunk);
    return { json: text, usage };
  }
}

/** Verlauf ins Gemini-Format: System-Nachrichten (Regie) hängen an der benachbarten Spieler-Nachricht. */
export function toGeminiContents(messages: readonly AiMessage[]): { role: 'user' | 'model'; parts: { text: string }[] }[] {
  const out: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
  for (const m of messages) {
    const role = m.role === 'assistant' ? 'model' : 'user';
    const last = out[out.length - 1];
    if (last && last.role === role) last.parts[0]!.text += `\n\n${m.content}`;
    else out.push({ role, parts: [{ text: m.content }] });
  }
  return out;
}

// ------------------------------------------------------------------ gemeinsame Hilfen

/** `fetch` mit Fehlerarten: Abbruch, Netz bzw. vom Browser blockiert (CORS sieht wie ein Netzfehler aus). */
async function safeFetch(fetchFn: FetchFn, url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetchFn(url, init);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw new AiError('aborted');
    if ((err as { name?: string } | null)?.name === 'AbortError') throw new AiError('aborted');
    throw new AiError('network', err instanceof Error ? err.message : String(err));
  }
}

/** HTTP-Fehler auf einen Grund abbilden (mit Wartezeit bei 429). */
async function httpError(res: Response): Promise<AiError> {
  let message = `HTTP ${res.status}`;
  let retryMs = retryAfter(res.headers.get('retry-after'));
  try {
    const body = (await res.json()) as { error?: { message?: string; details?: { retryDelay?: string }[] } | string };
    const e = body.error;
    if (typeof e === 'string') message = e;
    else if (e?.message) message = e.message;
    // Gemini: RetryInfo.retryDelay „12s“.
    const delay = typeof e === 'object' ? e?.details?.find((d) => d.retryDelay)?.retryDelay : undefined;
    if (retryMs === null && delay) retryMs = retryAfter(delay.replace(/s$/, ''));
  } catch {
    // kein JSON
  }
  return new AiError(errorKind(res.status, message), message, null, retryMs);
}

/** HTTP-Status (bzw. Fehlercode im Stream) → Grund. */
export function errorKind(status: number, message: string): AiFailure {
  if (status === 401) return 'auth';
  if (status === 403) return 'permission';
  if (status === 429) return 'rate';
  if (status === 402) return 'rate';
  // Gemini meldet ungültige Schlüssel als 400 „API key not valid“.
  if (status === 400 && /api key/i.test(message)) return 'auth';
  if (status === 400 || status === 404 || status === 422) return 'badRequest';
  if (status === 408) return 'timeout';
  if (status >= 500) return 'overloaded';
  return 'other';
}

/** „Retry-After“ in Sekunden (Zahl) bzw. als Datum → Millisekunden. */
export function retryAfter(value: string | null): number | null {
  if (!value) return null;
  const s = Number(value);
  if (Number.isFinite(s)) return Math.max(0, Math.round(s * 1000));
  const t = Date.parse(value);
  return Number.isFinite(t) ? Math.max(0, t - Date.now()) : null;
}

/** Server-Sent Events lesen: jede `data:`-Zeile (außer „[DONE]“) an `onData`. */
async function readSse(res: Response, onData: (data: string) => void, signal: AbortSignal): Promise<void> {
  const body = res.body;
  if (!body) {
    for (const line of (await res.text()).split('\n')) handleLine(line, onData);
    return;
  }
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  try {
    for (;;) {
      if (signal.aborted) throw new AiError('aborted');
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        handleLine(buf.slice(0, nl), onData);
        buf = buf.slice(nl + 1);
      }
    }
    if (buf) handleLine(buf, onData);
  } catch (err) {
    if (err instanceof AiError) throw err;
    if ((err as { name?: string } | null)?.name === 'AbortError') throw new AiError('aborted');
    throw new AiError('network', err instanceof Error ? err.message : String(err));
  }
}

function handleLine(raw: string, onData: (data: string) => void): void {
  const line = raw.trim();
  if (!line.startsWith('data:')) return;
  const data = line.slice(5).trim();
  if (!data || data === '[DONE]') return;
  onData(data);
}

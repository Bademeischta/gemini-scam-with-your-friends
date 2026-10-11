import { TUNING } from '../../config/tuning';
import { VERDICT_SCHEMA } from './rules';

/** Eine Nachricht im Gespräch mit der KI (System-Nachrichten = Regie mitten im Gespräch). */
export interface AiMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AiRequest {
  system: string;
  messages: AiMessage[];
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

/** Warum eine Anfrage scheiterte (für Hinweis und Rückfall auf die lokale Engine). */
export type AiFailure = 'auth' | 'permission' | 'rate' | 'overloaded' | 'network' | 'timeout' | 'refusal' | 'badRequest' | 'aborted' | 'other';

export class AiError extends Error {
  constructor(
    readonly kind: AiFailure,
    message: string = kind,
    readonly usage: AiUsage | null = null,
  ) {
    super(message);
  }
}

/** Austauschbar für Tests: schickt eine Anfrage und meldet den bisher gestreamten Text. */
export interface AiTransport {
  send(req: AiRequest, onText: (snapshot: string) => void, signal: AbortSignal): Promise<AiResponse>;
}

export const NO_USAGE: AiUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

/**
 * Claude API direkt aus dem Browser (offizielles SDK, `dangerouslyAllowBrowser`): Der Schlüssel
 * gehört dem Spieler, liegt nur auf seinem Gerät und geht nur an api.anthropic.com. Das SDK wird
 * erst beim ersten KI-Anruf geladen.
 */
export class ClaudeTransport implements AiTransport {
  private client: import('@anthropic-ai/sdk').default | null = null;

  constructor(private readonly apiKey: string) {}

  async send(req: AiRequest, onText: (snapshot: string) => void, signal: AbortSignal): Promise<AiResponse> {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    this.client ??= new Anthropic({ apiKey: this.apiKey, dangerouslyAllowBrowser: true, maxRetries: 1, timeout: TUNING.ai.timeoutMs });
    try {
      const stream = this.client.messages.stream(
        {
          model: TUNING.ai.model,
          max_tokens: TUNING.ai.maxTokens,
          // Feste Figurenbeschreibung zuerst und gecacht; die Regie kommt als System-Nachricht im Verlauf.
          system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
          messages: req.messages,
          // Telefon-Tempo: ohne Nachdenk-Phase, geringer Aufwand, Antwort als JSON nach Schema.
          thinking: { type: 'disabled' },
          output_config: { effort: TUNING.ai.effort, format: { type: 'json_schema', schema: VERDICT_SCHEMA } },
        },
        { signal },
      );
      stream.on('text', (_delta, snapshot) => onText(snapshot));
      const msg = await stream.finalMessage();
      const u = msg.usage;
      const usage: AiUsage = { input: u.input_tokens, output: u.output_tokens, cacheRead: u.cache_read_input_tokens ?? 0, cacheWrite: u.cache_creation_input_tokens ?? 0 };
      if (msg.stop_reason === 'refusal') throw new AiError('refusal', 'refusal', usage);
      const json = msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
      return { json, usage };
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
    if (err instanceof A.RateLimitError) return new AiError('rate');
    if (err instanceof A.BadRequestError) return new AiError('badRequest', err.message);
    if (err instanceof A.InternalServerError) return new AiError('overloaded');
    if (err instanceof A.APIError) return new AiError(err.status === 529 ? 'overloaded' : 'other', err.message);
    if (err instanceof DOMException && err.name === 'AbortError') return new AiError('aborted');
    return new AiError('other', err instanceof Error ? err.message : String(err));
  }
}

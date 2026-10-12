import { TUNING } from '../../config/tuning';
import { AI_PROVIDERS, providerDef, type AiProviderId, type JsonMode } from '../../data/aiProviders';
import type { CallerDef } from '../conversation/caller';
import type { AiPlan, Conversation } from '../conversation/engine';
import { buildPersona, buildRegie, summarizeHistory, type PromptText } from './persona';
import { extractSay, FloskelMeter, parseVerdict, sanitizePlayerText, type AiVerdict } from './rules';
import { AiError, makeTransport, NO_USAGE, type AiFailure, type AiMessage, type AiTransport, type AiUsage } from './transport';

/** Bereit, aus (Einstellung), kein Schlüssel, offline. */
export type AiStatus = 'ready' | 'off' | 'noKey' | 'offline';

/** Wo die Schlüssel liegen (nur auf dem Gerät des Spielers, je Anbieter). */
export interface AiKeyStore {
  get(provider: AiProviderId): string;
  set(provider: AiProviderId, key: string): void;
  clear(provider: AiProviderId): void;
}

/** Auswahl aus der Systemsteuerung. */
export interface AiConfig {
  provider: AiProviderId;
  models: Partial<Record<AiProviderId, string>>;
  /** Am Limit: nächsten Anbieter mit Schlüssel nehmen. */
  chain: boolean;
}

export interface AiEnv {
  keys: AiKeyStore;
  /** Spieler hat KI-Anrufer eingeschaltet. */
  enabled(): boolean;
  online(): boolean;
  config(): AiConfig;
  text: PromptText;
  /** Für Tests austauschbar. */
  transport?: (provider: AiProviderId, key: string, model: string) => AiTransport;
  /** Warten vor einem neuen Versuch (Tests: sofort). */
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  now?: () => number;
}

/** Ingame-Meldung während eines Zuges: neuer Versuch nach Rate-Limit bzw. Wechsel zum nächsten Anbieter. */
export type AiNotice = { kind: 'retry'; provider: AiProviderId; waitMs: number; attempt: number } | { kind: 'switch'; from: AiProviderId; to: AiProviderId; reason: AiFailure };

export interface TurnInput {
  caller: CallerDef;
  conversation: Conversation;
  plan: AiPlan;
  /** Bisheriger Verlauf mit der KI (Spieler, Antwort). */
  history: AiMessage[];
  /** Was der Anrufer seit der letzten KI-Antwort per Spiel gesagt hat. */
  events: string[];
  floskel: number;
  /** Bisher gestreamter Text des Anrufers (wächst; nach einem Wechsel beginnt er neu). */
  onSay(text: string): void;
  onNotice?(n: AiNotice): void;
  signal: AbortSignal;
}

export type TurnResult =
  | { ok: true; verdict: AiVerdict; usage: UsageTotals; messages: AiMessage[]; provider: AiProviderId }
  | { ok: false; error: AiFailure; usage: UsageTotals; provider: AiProviderId | null };

export interface UsageTotals extends AiUsage {
  requests: number;
}

/** Verbrauch eines Anbieters (Reiter „KI“). */
export interface ProviderTotals extends UsageTotals {
  /** So oft am Limit (HTTP 429). */
  rateLimited: number;
  errors: number;
}

export function addUsage(into: UsageTotals, u: AiUsage, requests = 1): void {
  into.input += u.input;
  into.output += u.output;
  into.cacheRead += u.cacheRead;
  into.cacheWrite += u.cacheWrite;
  into.requests += requests;
}

export function addTotals(into: UsageTotals, u: UsageTotals): void {
  addUsage(into, u, u.requests);
}

export function emptyTotals(): UsageTotals {
  return { ...NO_USAGE, requests: 0 };
}

/** Fehler, bei denen der nächste Anbieter der Kette einspringt (Abbruch und Ablehnung nicht). */
const CHAIN_ON: readonly AiFailure[] = ['rate', 'overloaded', 'network', 'timeout', 'auth', 'permission', 'badRequest', 'other'];

type Attempt = { ok: true; verdict: AiVerdict; messages: AiMessage[] } | { ok: false; error: AiFailure; retryAfterMs: number | null };

/**
 * KI-Anrufer: baut je Zug eine sparsame Anfrage (Figur als kurzer System-Prompt, die letzten Züge
 * wörtlich, Älteres als Zusammenfassung in der Regie), streamt die Antwort und prüft sie. Am Limit
 * (429) wird mit Wartezeit neu versucht, dann der nächste Anbieter mit Schlüssel genommen, sonst
 * antwortet die lokale Engine. Über Erfolg entscheidet die Spiellogik (Conversation.applyAi).
 */
export class AiBrain {
  /** Floskeln nutzen sich über den ganzen Run ab (auch zwischen Anrufen). */
  readonly floskeln = new FloskelMeter();
  /** Verbrauch seit dem Start des Spiels (alle Anbieter). */
  readonly total: UsageTotals = emptyTotals();
  /** Verbrauch je Anbieter. */
  readonly byProvider: Record<AiProviderId, ProviderTotals>;
  /** Letzter Fehler (Hinweis in Telefon und Systemsteuerung). */
  lastError: AiFailure | null = null;
  private readonly transports = new Map<AiProviderId, { sig: string; t: AiTransport }>();
  private readonly personas = new Map<string, string>();
  /** Anbieter am Limit bis zu diesem Zeitpunkt (ms). */
  private readonly cooldown = new Map<AiProviderId, number>();
  /** Gelernt: dieser Anbieter will die Regie im Nutzertext bzw. eine schwächere JSON-Vorgabe. */
  private readonly regieInUser = new Set<AiProviderId>();
  private readonly jsonMode = new Map<AiProviderId, JsonMode>();

  constructor(private readonly env: AiEnv) {
    this.byProvider = Object.fromEntries(AI_PROVIDERS.map((id) => [id, { ...emptyTotals(), rateLimited: 0, errors: 0 }])) as Record<AiProviderId, ProviderTotals>;
  }

  status(): AiStatus {
    if (!this.env.enabled()) return 'off';
    if (this.candidates().length === 0) return 'noKey';
    if (!this.env.online()) return 'offline';
    return 'ready';
  }

  get provider(): AiProviderId {
    return this.env.config().provider;
  }

  model(id: AiProviderId = this.provider): string {
    return this.env.config().models[id] ?? providerDef(id).defaultModel;
  }

  hasKey(id: AiProviderId = this.provider): boolean {
    return this.env.keys.get(id).length > 0;
  }

  /** Schlüssel gekürzt zur Anzeige („gsk_…a1b2“). */
  maskedKey(id: AiProviderId = this.provider): string {
    const k = this.env.keys.get(id);
    if (!k) return '';
    if (k.length < 16) return `…${k.slice(-2)}`;
    return `${k.slice(0, 6)}…${k.slice(-4)}`;
  }

  setKey(key: string, id: AiProviderId = this.provider): void {
    this.env.keys.set(id, key.trim());
    this.cooldown.delete(id);
    this.lastError = null;
  }

  clearKey(id: AiProviderId = this.provider): void {
    this.env.keys.clear(id);
    this.transports.delete(id);
  }

  /** Anbieter am Limit? Restzeit in ms (0 = frei). */
  coolingFor(id: AiProviderId): number {
    return Math.max(0, (this.cooldown.get(id) ?? 0) - this.now());
  }

  /** Reihenfolge: gewählter Anbieter, dann (Kette an) die übrigen – nur mit Schlüssel. */
  candidates(): AiProviderId[] {
    const cfg = this.env.config();
    const order = cfg.chain ? [cfg.provider, ...AI_PROVIDERS.filter((p) => p !== cfg.provider)] : [cfg.provider];
    return order.filter((p) => this.hasKey(p));
  }

  persona(caller: CallerDef): string {
    let p = this.personas.get(caller.id);
    if (!p) {
      p = buildPersona(caller, this.env.text);
      this.personas.set(caller.id, p);
    }
    return p;
  }

  /** Ein Gesprächszug mit der KI. Wirft nie; Fehler kommen als Ergebnis zurück. */
  async turn(inp: TurnInput): Promise<TurnResult> {
    const usage = emptyTotals();
    const all = this.candidates();
    if (all.length === 0) return this.fail('auth', usage, null);
    const free = all.filter((p) => this.coolingFor(p) === 0);
    // Alle am Limit: gar nicht erst fragen.
    if (free.length === 0) return this.fail('rate', usage, all[0]!);
    const { recent, older } = splitHistory(inp.history, TUNING.ai.historyTurns);
    const summary = summarizeHistory(older, this.env.text);
    const regie = buildRegie({ conversation: inp.conversation, plan: inp.plan, events: inp.events, floskel: inp.floskel, summary }, this.env.text);
    const said = sanitizePlayerText(inp.plan.text);
    const system = this.persona(inp.caller);
    let last: AiFailure = 'other';
    for (let i = 0; i < free.length; i++) {
      const id = free[i]!;
      if (i > 0) inp.onNotice?.({ kind: 'switch', from: free[i - 1]!, to: id, reason: last });
      const r = await this.attempt(id, system, recent, regie, said, inp, usage);
      if (r.ok) {
        this.lastError = null;
        return { ok: true, verdict: r.verdict, usage, messages: r.messages, provider: id };
      }
      last = r.error;
      this.byProvider[id].errors++;
      if (r.error === 'rate') this.cooldown.set(id, this.now() + Math.min(TUNING.ai.rateCooldownMaxMs, Math.max(TUNING.ai.rateCooldownMs, r.retryAfterMs ?? 0)));
      if (!CHAIN_ON.includes(r.error) || inp.signal.aborted) return this.fail(r.error, usage, id);
    }
    return this.fail(last, usage, free[free.length - 1]!);
  }

  /** Ein Anbieter: bei 429 mit Wartezeit neu versuchen, bei abgelehntem Format die Anfrage vereinfachen. */
  private async attempt(id: AiProviderId, system: string, recent: AiMessage[], regie: string, said: string, inp: TurnInput, usage: UsageTotals): Promise<Attempt> {
    const def = providerDef(id);
    let rateTries = 0;
    for (let guard = 0; guard < 8; guard++) {
      const inUser = def.api !== 'anthropic' || this.regieInUser.has(id);
      const json = this.jsonMode.get(id) ?? def.json;
      const turnMsgs: AiMessage[] = inUser
        ? [{ role: 'user', content: `${regie}\n\n${this.env.text.t('ai.regie.player', { text: said })}` }]
        : [
            { role: 'user', content: said },
            { role: 'system', content: regie },
          ];
      const stats = this.byProvider[id];
      try {
        const res = await this.transportFor(id).send(
          { system, messages: [...recent, ...turnMsgs], json },
          (snapshot) => {
            const s = extractSay(snapshot);
            if (s.text) inp.onSay(s.text);
          },
          inp.signal,
        );
        this.count(id, res.usage, usage);
        const verdict = parseVerdict(res.json);
        if (!verdict) return { ok: false, error: 'other', retryAfterMs: null };
        // Im Gedächtnis nur Spielersatz und Antwort (die Regie gilt nur für diesen Zug).
        return { ok: true, verdict, messages: [{ role: 'user', content: said }, { role: 'assistant', content: res.json }] };
      } catch (err) {
        const e = err instanceof AiError ? err : new AiError('other');
        this.count(id, e.usage ?? NO_USAGE, usage);
        if (e.kind === 'rate') {
          stats.rateLimited++;
          const wait = e.retryAfterMs ?? TUNING.ai.rateBackoffMs[Math.min(rateTries, TUNING.ai.rateBackoffMs.length - 1)]!;
          if (rateTries >= TUNING.ai.rateRetries || wait > TUNING.ai.rateMaxWaitMs) return { ok: false, error: 'rate', retryAfterMs: e.retryAfterMs };
          rateTries++;
          inp.onNotice?.({ kind: 'retry', provider: id, waitMs: wait, attempt: rateTries });
          try {
            await this.sleep(wait, inp.signal);
          } catch {
            return { ok: false, error: 'aborted', retryAfterMs: null };
          }
          continue;
        }
        if (e.kind === 'badRequest') {
          // Erst die Regie in den Nutzertext, dann schwächere JSON-Vorgaben (Schema → nur JSON → Anweisung).
          if (!inUser) {
            this.regieInUser.add(id);
            continue;
          }
          if (json !== 'prompt') {
            this.jsonMode.set(id, json === 'schema' ? 'object' : 'prompt');
            continue;
          }
        }
        return { ok: false, error: e.kind, retryAfterMs: e.retryAfterMs };
      }
    }
    return { ok: false, error: 'other', retryAfterMs: null };
  }

  /** Verbindungstest in der Systemsteuerung (für den gewählten Anbieter): eine winzige Anfrage. null = alles gut. */
  async test(signal: AbortSignal, id: AiProviderId = this.provider): Promise<AiFailure | null> {
    if (!this.hasKey(id)) return 'auth';
    try {
      const res = await this.transportFor(id).send(
        {
          system: `${this.env.text.t('ai.prompt.intro')}\n\n${this.env.text.t('ai.prompt.format')}`,
          messages: [{ role: 'user', content: this.env.text.t('ai.test.hello') }],
          json: this.jsonMode.get(id) ?? providerDef(id).json,
        },
        () => undefined,
        signal,
      );
      this.count(id, res.usage, null);
      this.cooldown.delete(id);
      this.lastError = null;
      return null;
    } catch (err) {
      const e = err instanceof AiError ? err : new AiError('other');
      this.count(id, e.usage ?? NO_USAGE, null);
      if (e.kind === 'rate') this.byProvider[id].rateLimited++;
      else this.byProvider[id].errors++;
      this.lastError = e.kind;
      return e.kind;
    }
  }

  private count(id: AiProviderId, u: AiUsage, turn: UsageTotals | null): void {
    addUsage(this.total, u);
    addUsage(this.byProvider[id], u);
    if (turn) addUsage(turn, u);
  }

  private fail(error: AiFailure, usage: UsageTotals, provider: AiProviderId | null): TurnResult {
    this.lastError = error;
    return { ok: false, error, usage, provider };
  }

  private transportFor(id: AiProviderId): AiTransport {
    const key = this.env.keys.get(id);
    const model = this.model(id);
    const sig = `${key}|${model}`;
    const cached = this.transports.get(id);
    if (cached && cached.sig === sig) return cached.t;
    const t = this.env.transport ? this.env.transport(id, key, model) : makeTransport(providerDef(id), key, model);
    this.transports.set(id, { sig, t });
    return t;
  }

  private now(): number {
    return this.env.now ? this.env.now() : Date.now();
  }

  private sleep(ms: number, signal: AbortSignal): Promise<void> {
    if (this.env.sleep) return this.env.sleep(ms, signal);
    return new Promise((resolve, reject) => {
      if (signal.aborted) return reject(new AiError('aborted'));
      const timer = setTimeout(() => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
      const onAbort = (): void => {
        clearTimeout(timer);
        reject(new AiError('aborted'));
      };
      signal.addEventListener('abort', onAbort, { once: true });
    });
  }
}

/**
 * Verlauf aufteilen: die letzten `turns` Züge wörtlich (beginnt immer mit einer Spieler-Nachricht,
 * damit die Reihenfolge gültig bleibt), alles davor wird zusammengefasst.
 */
export function splitHistory(history: readonly AiMessage[], turns: number): { recent: AiMessage[]; older: AiMessage[] } {
  const starts: number[] = [];
  history.forEach((m, i) => {
    if (m.role === 'user') starts.push(i);
  });
  if (starts.length <= turns) return { recent: [...history], older: [] };
  const cut = starts[starts.length - turns]!;
  return { recent: history.slice(cut), older: history.slice(0, cut) };
}

/** Abort-Signal mit Zeitlimit (für Anfragen, die zu lange dauern). `timedOut` unterscheidet Zeitlimit und Auflegen. */
export function timeoutSignal(parent: AbortSignal | null, ms: number): { signal: AbortSignal; cancel(): void; readonly timedOut: boolean } {
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, ms);
  const onAbort = (): void => ctrl.abort();
  parent?.addEventListener('abort', onAbort);
  return {
    signal: ctrl.signal,
    cancel: () => {
      clearTimeout(timer);
      parent?.removeEventListener('abort', onAbort);
    },
    get timedOut() {
      return timedOut;
    },
  };
}

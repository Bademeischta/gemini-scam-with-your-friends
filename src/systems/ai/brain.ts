import { TUNING } from '../../config/tuning';
import type { CallerDef } from '../conversation/caller';
import type { AiPlan, Conversation } from '../conversation/engine';
import { buildPersona, buildRegie, type PromptText } from './persona';
import { extractSay, FloskelMeter, parseVerdict, sanitizePlayerText, type AiVerdict } from './rules';
import { AiError, ClaudeTransport, NO_USAGE, type AiFailure, type AiMessage, type AiTransport, type AiUsage } from './transport';

/** Bereit, aus (Einstellung), kein Schlüssel, offline. */
export type AiStatus = 'ready' | 'off' | 'noKey' | 'offline';

/** Wo der Schlüssel liegt (nur auf dem Gerät des Spielers). */
export interface AiKeyStore {
  get(): string;
  set(key: string): void;
  clear(): void;
}

export interface AiEnv {
  keys: AiKeyStore;
  /** Spieler hat KI-Anrufer eingeschaltet. */
  enabled(): boolean;
  online(): boolean;
  text: PromptText;
  /** Für Tests austauschbar. */
  transport?: (key: string) => AiTransport;
}

export interface TurnInput {
  caller: CallerDef;
  conversation: Conversation;
  plan: AiPlan;
  /** Bisheriger Verlauf mit der KI (Spieler, Regie, Antwort). */
  history: AiMessage[];
  /** Was der Anrufer seit der letzten KI-Antwort per Spiel gesagt hat. */
  events: string[];
  floskel: number;
  /** Bisher gestreamter Text des Anrufers (wächst). */
  onSay(text: string): void;
  signal: AbortSignal;
}

export type TurnResult = { ok: true; verdict: AiVerdict; usage: AiUsage; messages: AiMessage[] } | { ok: false; error: AiFailure; usage: AiUsage };

export interface UsageTotals extends AiUsage {
  requests: number;
}

export function addUsage(into: UsageTotals, u: AiUsage): void {
  into.input += u.input;
  into.output += u.output;
  into.cacheRead += u.cacheRead;
  into.cacheWrite += u.cacheWrite;
  into.requests++;
}

export function emptyTotals(): UsageTotals {
  return { ...NO_USAGE, requests: 0 };
}

/**
 * KI-Anrufer: baut je Zug die Anfrage (Figur als System-Prompt, Verlauf, Regie der Spiellogik),
 * streamt die Antwort und prüft sie. Über Erfolg entscheidet die Spiellogik (Conversation.applyAi).
 */
export class AiBrain {
  /** Floskeln nutzen sich über den ganzen Run ab (auch zwischen Anrufen). */
  readonly floskeln = new FloskelMeter();
  /** Verbrauch seit dem Start des Spiels. */
  readonly total: UsageTotals = emptyTotals();
  /** Letzter Fehler (Hinweis in Telefon und Systemsteuerung). */
  lastError: AiFailure | null = null;
  private transport: AiTransport | null = null;
  private transportKey = '';
  private readonly personas = new Map<string, string>();
  /** Regie als System-Nachricht im Verlauf; fällt auf „im Nutzertext“ zurück, falls das Modell das ablehnt. */
  private regieInUser = false;

  constructor(private readonly env: AiEnv) {}

  status(): AiStatus {
    if (!this.env.enabled()) return 'off';
    if (!this.env.keys.get()) return 'noKey';
    if (!this.env.online()) return 'offline';
    return 'ready';
  }

  get hasKey(): boolean {
    return this.env.keys.get().length > 0;
  }

  /** Schlüssel gekürzt zur Anzeige („sk-ant-…a1b2“). */
  maskedKey(): string {
    const k = this.env.keys.get();
    if (!k) return '';
    return `${k.slice(0, 7)}…${k.slice(-4)}`;
  }

  setKey(key: string): void {
    this.env.keys.set(key.trim());
    this.lastError = null;
  }

  clearKey(): void {
    this.env.keys.clear();
    this.transport = null;
    this.transportKey = '';
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
    const regie = buildRegie({ conversation: inp.conversation, plan: inp.plan, events: inp.events, floskel: inp.floskel }, this.env.text);
    const said = sanitizePlayerText(inp.plan.text);
    const system = this.persona(inp.caller);
    const history = trimHistory(inp.history, TUNING.ai.historyTurns);
    let usage: AiUsage = NO_USAGE;
    for (let attempt = 0; attempt < 2; attempt++) {
      const turnMsgs: AiMessage[] = this.regieInUser
        ? [{ role: 'user', content: `${regie}\n\n${this.env.text.t('ai.regie.player', { text: said })}` }]
        : [
            { role: 'user', content: said },
            { role: 'system', content: regie },
          ];
      try {
        const res = await this.transportFor().send(
          { system, messages: [...history, ...turnMsgs] },
          (snapshot) => {
            const s = extractSay(snapshot);
            if (s.text) inp.onSay(s.text);
          },
          inp.signal,
        );
        usage = res.usage;
        const verdict = parseVerdict(res.json);
        if (!verdict) return this.fail('other', usage);
        this.lastError = null;
        return { ok: true, verdict, usage, messages: [...turnMsgs, { role: 'assistant', content: res.json }] };
      } catch (err) {
        const e = err instanceof AiError ? err : new AiError('other');
        usage = e.usage ?? NO_USAGE;
        // Lehnt das Modell System-Nachrichten im Verlauf ab, die Regie einmalig in den Nutzertext legen.
        if (e.kind === 'badRequest' && !this.regieInUser && attempt === 0) {
          this.regieInUser = true;
          continue;
        }
        return this.fail(e.kind, usage);
      }
    }
    return this.fail('other', usage);
  }

  /** Verbindungstest in der Systemsteuerung: eine winzige Anfrage. null = alles gut. */
  async test(signal: AbortSignal): Promise<AiFailure | null> {
    try {
      const res = await this.transportFor().send(
        { system: this.env.text.t('ai.prompt.intro'), messages: [{ role: 'user', content: this.env.text.t('ai.test.hello') }] },
        () => undefined,
        signal,
      );
      addUsage(this.total, res.usage);
      this.lastError = null;
      return null;
    } catch (err) {
      const kind = err instanceof AiError ? err.kind : 'other';
      this.lastError = kind;
      return kind;
    }
  }

  private fail(error: AiFailure, usage: AiUsage): TurnResult {
    this.lastError = error;
    return { ok: false, error, usage };
  }

  private transportFor(): AiTransport {
    const key = this.env.keys.get();
    if (!this.transport || this.transportKey !== key) {
      this.transport = this.env.transport ? this.env.transport(key) : new ClaudeTransport(key);
      this.transportKey = key;
    }
    return this.transport;
  }
}

/**
 * Verlauf kürzen: die letzten `turns` Züge (je Zug Spieler, Regie, Antwort). Beginnt immer mit
 * einer Spieler-Nachricht, damit die Reihenfolge gültig bleibt.
 */
export function trimHistory(history: readonly AiMessage[], turns: number): AiMessage[] {
  const starts: number[] = [];
  history.forEach((m, i) => {
    if (m.role === 'user') starts.push(i);
  });
  if (starts.length <= turns) return [...history];
  return history.slice(starts[starts.length - turns]);
}

/** Abort-Signal mit Zeitlimit (für Anfragen, die zu lange dauern). */
export function timeoutSignal(parent: AbortSignal | null, ms: number): { signal: AbortSignal; cancel(): void } {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  const onAbort = (): void => ctrl.abort();
  parent?.addEventListener('abort', onAbort);
  return {
    signal: ctrl.signal,
    cancel: () => {
      clearTimeout(timer);
      parent?.removeEventListener('abort', onAbort);
    },
  };
}

import { TUNING } from '../../config/tuning';
import { addUsage, emptyTotals, timeoutSignal, type AiBrain, type AiStatus, type UsageTotals } from '../ai/brain';
import { SentenceSplitter } from '../ai/rules';
import type { AiFailure, AiMessage } from '../ai/transport';
import type { CallerDef } from '../conversation/caller';
import { CardDeck, type Card } from '../conversation/cards';
import type { SchemeDef } from '../../data/schemes';
import type { AiPlan, Conversation, InputSource, Loot, RemoteEvent, Reply } from '../conversation/engine';
import { LinePicker, type LineSource } from '../conversation/lines';
import { Rng } from '../rng/rng';
import type { CallEvent, CallManager, CallRecord } from './CallManager';
import { Dossier } from './dossier';

/** Eine Zeile im Gesprächsverlauf (Untertitel, Protokoll). */
export interface TranscriptLine {
  id: number;
  who: 'caller' | 'player';
  text: string;
  /** Sichtbare Zeichen (Schreibmaschinen-Effekt, CAL-18). */
  shown: number;
  source?: InputSource;
  /** Vertrauensänderung, die diese Eingabe bewirkt hat. */
  dTrust?: number;
}

/** Ein Anruf an einem Platz aus Sicht der Telefon-App: Verlauf, Untertitel, Karten. */
export class CallSession {
  readonly transcript: TranscriptLine[] = [];
  hand: Card[] = [];
  /** Gespräch ist vorbei (Anrufer hat aufgelegt bzw. Spieler); Verlauf bleibt lesbar. */
  record: CallRecord | null = null;
  /** Lautsprecher an (lauter, später hören Kollegen mit). */
  speaker = false;
  /** Der Spieler hat aufgelegt (Anrufer wird mitten im Satz abgeschnitten). */
  hungUp = false;
  /** Wer antwortet: KI-Anrufer oder lokale Engine (bei Fehlern fällt der Anruf zurück). */
  engine: 'ai' | 'local' = 'local';
  /** Warum gerade die lokale Engine antwortet (Hinweis in der Telefon-App). */
  aiNotice: AiStatus | AiFailure | null = null;
  /** Die KI überlegt gerade (Eingaben warten, Karten sind gesperrt). */
  thinking = false;
  /** Token-Verbrauch dieses Anrufs. */
  readonly usage: UsageTotals = emptyTotals();
  /** Verlauf mit der KI (Spieler, Regie, Antwort). */
  readonly aiHistory: AiMessage[] = [];
  /** Vom Spiel gesprochene Anrufer-Zeilen seit der letzten KI-Antwort (für die Regie). */
  aiEvents: string[] = [];
  /** Eingabe, die während des Überlegens kam (wird danach gesagt). */
  pending: { text: string; source: InputSource; card?: Card } | null = null;
  abort: AbortController | null = null;
  private readonly queue: TranscriptLine[] = [];
  private current: TranscriptLine | null = null;
  private wait = 0;
  private reveal = 0;
  private nextId = 1;
  private readonly picker: LinePicker;
  private readonly deck: CardDeck;

  constructor(
    readonly desk: number,
    readonly callId: number,
    readonly caller: CallerDef,
    private readonly hub: PhoneHub,
    src: LineSource,
    rng: Rng,
  ) {
    this.picker = new LinePicker(caller.id, rng, src);
    this.deck = new CardDeck(rng, (k) => src.list(k));
  }

  get conversation() {
    return this.hub.calls.conversation(this.desk);
  }

  get active(): boolean {
    return this.record === null;
  }

  /** Spricht der Anrufer gerade (Zeile läuft noch oder weitere warten)? */
  get speaking(): boolean {
    return this.current !== null || this.queue.length > 0;
  }

  /** Zeile, die gerade erscheint (für Sprachausgabe und Lippen-/Brabbel-Takt). */
  get currentLine(): TranscriptLine | null {
    return this.current;
  }

  addReply(reply: Reply): void {
    for (const ref of reply.lines) {
      const text = this.picker.text(ref);
      if (!text) continue;
      this.addCallerText(text);
      if (this.engine === 'ai') this.aiEvents.push(text);
    }
    if (reply.loot) this.hub.capture(this, reply.loot);
  }

  /** Zeile des Anrufers einreihen (Untertitel, Stimme). */
  addCallerText(text: string): void {
    const line: TranscriptLine = { id: this.nextId++, who: 'caller', text, shown: 0 };
    this.transcript.push(line);
    this.queue.push(line);
  }

  addPlayer(text: string, source: InputSource, dTrust: number): void {
    // Wer redet, unterbricht den Anrufer: laufende Zeilen werden sofort vollständig gezeigt.
    this.flush();
    this.transcript.push({ id: this.nextId++, who: 'player', text, shown: text.length, source, dTrust });
  }

  /** Neue Karten für die aktuelle Lage; `reroll` = „Andere Karten“ (gerade gezeigte möglichst nicht). */
  deal(reroll = false): void {
    const c = this.conversation;
    if (!c) {
      this.hand = [];
      return;
    }
    const scheme = c.scheme ? { id: c.scheme.id, phase: c.phase, nextDemand: c.nextDemand } : undefined;
    this.hand = this.deck.deal(
      {
        turns: c.turns,
        trust: c.trust,
        threshold: c.threshold,
        mood: c.currentMood,
        role: c.memory.role,
        hints: [...this.caller.likes, ...this.caller.dislikes],
        phase: c.phase,
        hasLoot: c.loots.length > 0,
        ...(scheme ? { scheme } : {}),
      },
      4,
      reroll ? this.hand : [],
    );
  }

  markUsed(card: Card): void {
    this.deck.markUsed(card);
  }

  /** Untertitel weiterschreiben. Liefert die Zeile, die in diesem Schritt neu beginnt (für die Stimme). */
  tick(dt: number): TranscriptLine | null {
    let started: TranscriptLine | null = null;
    if (!this.current) {
      if (this.wait > 0) this.wait -= dt;
      if (this.wait <= 0 && this.queue.length > 0) {
        this.current = this.queue.shift()!;
        this.reveal = 0;
        started = this.current;
      }
    }
    const line = this.current;
    if (line) {
      this.reveal += dt * TUNING.calls.subtitleCps * this.caller.voice.rate;
      line.shown = Math.min(line.text.length, Math.floor(this.reveal));
      if (line.shown >= line.text.length) {
        this.current = null;
        this.wait = TUNING.calls.linePause;
      }
    }
    return started;
  }

  /** Spieler legt auf: Der Anrufer wird mitten im Satz abgeschnitten, Wartendes entfällt. */
  cutOff(): void {
    const cur = this.current;
    if (cur && cur.shown < cur.text.length) {
      cur.text = `${cur.text.slice(0, Math.max(1, cur.shown)).trimEnd()} –`;
      cur.shown = cur.text.length;
    }
    const waiting = new Set(this.queue);
    for (let i = this.transcript.length - 1; i >= 0; i--) if (waiting.has(this.transcript[i]!)) this.transcript.splice(i, 1);
    this.queue.length = 0;
    this.current = null;
    this.wait = 0;
  }

  /** Alles sofort zeigen (Unterbrechen, Überspringen). */
  flush(): void {
    for (const l of this.transcript) l.shown = l.text.length;
    this.queue.length = 0;
    this.current = null;
    this.wait = 0;
  }
}

export interface Capture {
  callerId: string;
  caller: CallerDef;
  desk: number;
  callId: number;
  loot: Loot;
}

export type PhoneEvent =
  | { type: 'ring'; desk: number; callerId: string }
  | { type: 'missed'; desk: number; callerId: string }
  | { type: 'answered'; desk: number; session: CallSession }
  | { type: 'line'; desk: number; session: CallSession; line: TranscriptLine }
  | { type: 'ended'; desk: number; session: CallSession; record: CallRecord }
  | { type: 'capture'; desk: number; capture: Capture }
  | { type: 'scheme'; desk: number; scheme: SchemeDef | null }
  | { type: 'aiFallback'; desk: number; session: CallSession; error: AiFailure };

/**
 * Verbindet den CallManager mit der Telefon-App: hält je Platz die laufende (bzw. zuletzt beendete)
 * Sitzung mit Untertiteln und Karten, erfasst Beute automatisch für den Notizblock (APP-08).
 */
export class PhoneHub {
  private readonly sessions = new Map<number, CallSession>();
  private readonly listeners = new Set<(e: PhoneEvent) => void>();
  private readonly off: () => void;
  /** Gewählte Masche je Platz (gilt für den laufenden und alle folgenden Anrufe dort). */
  private readonly chosen = new Map<number, SchemeDef | null>();
  /** Was man über die Anrufer herausgefunden hat (Kundenkartei). */
  readonly dossier = new Dossier();
  /** KI-Anrufer (optional, mit Schlüssel des Spielers); null = immer lokale Engine. */
  private ai: AiBrain | null = null;

  constructor(
    readonly calls: CallManager,
    private readonly callers: readonly CallerDef[],
    private readonly src: LineSource,
    private readonly onCapture: (c: Capture) => void,
  ) {
    this.off = calls.on((e) => this.handle(e));
  }

  on(fn: (e: PhoneEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  session(desk: number): CallSession | null {
    return this.sessions.get(desk) ?? null;
  }

  /** Jüngste Sitzung mit KI-Verbrauch (Debug-Menü). */
  latestAiSession(): CallSession | null {
    let best: CallSession | null = null;
    for (const s of this.sessions.values()) if (s.usage.requests > 0 && (!best || s.callId > best.callId)) best = s;
    return best;
  }

  /** Abheben am Platz; Karten werden gleich ausgeteilt. */
  answer(desk: number): CallSession | null {
    this.calls.answer(desk);
    return this.session(desk);
  }

  setAi(ai: AiBrain | null): void {
    this.ai = ai;
  }

  get aiBrain(): AiBrain | null {
    return this.ai;
  }

  say(desk: number, text: string, source: InputSource, card?: Card): Reply | null {
    const s = this.sessions.get(desk);
    const c = this.calls.conversation(desk);
    if (!s || !c || c.state !== 'active') return null;
    // Während die KI überlegt: die (letzte) Eingabe merken und danach sagen.
    if (s.thinking) {
      s.pending = { text, source, ...(card ? { card } : {}) };
      return null;
    }
    const before = c.trust;
    // Spielerzeile vor der Antwort eintragen (Reihenfolge im Verlauf).
    s.addPlayer(text, source, 0);
    const playerLine = s.transcript[s.transcript.length - 1]!;
    if (card) s.markUsed(card);
    // Floskeln zählen auch für die lokale Engine nicht doppelt – nur KI-Züge nutzen den Zähler.
    if (this.ai && s.engine === 'ai') {
      const plan = c.planAi(text, source);
      if (plan && !plan.local) {
        void this.aiTurn(s, c, plan, playerLine, before);
        return null;
      }
    }
    return this.sayLocal(s, text, source, playerLine, before);
  }

  private sayLocal(s: CallSession, text: string, source: InputSource, playerLine: TranscriptLine, before: number): Reply | null {
    const reply = this.calls.say(s.desk, text, source);
    if (reply) playerLine.dTrust = Math.round(reply.trust - before);
    if (s.active) s.deal();
    return reply;
  }

  /** Ein Zug mit dem KI-Anrufer: streamen (Satz für Satz), dann begrenzt anwenden; bei Fehlern lokal. */
  private async aiTurn(s: CallSession, c: Conversation, plan: AiPlan, playerLine: TranscriptLine, before: number): Promise<void> {
    const ai = this.ai!;
    s.thinking = true;
    c.waiting = true;
    s.abort = new AbortController();
    const limit = timeoutSignal(s.abort.signal, TUNING.ai.timeoutMs);
    const splitter = new SentenceSplitter();
    let streamed = '';
    const floskel = ai.floskeln.peek(plan.text);
    const events = s.aiEvents;
    s.aiEvents = [];
    const res = await ai.turn({
      caller: s.caller,
      conversation: c,
      plan,
      history: s.aiHistory,
      events,
      floskel,
      signal: limit.signal,
      onSay: (text) => {
        streamed = text;
        if (s.active && !s.hungUp) for (const sentence of splitter.push(text)) s.addCallerText(sentence);
      },
    });
    limit.cancel();
    s.abort = null;
    s.thinking = false;
    c.waiting = false;
    addUsage(s.usage, res.usage);
    addUsage(ai.total, res.usage);
    // Inzwischen aufgelegt (oder neuer Anruf): nur der Verbrauch zählt.
    if (!s.active || c.state === 'ended' || this.sessions.get(s.desk) !== s) return;
    if (!res.ok) {
      // Rückfall: Dieser Satz geht an die lokale Engine; bei Schlüssel-Problemen der Rest des Anrufs auch.
      s.aiNotice = res.error;
      if (res.error === 'auth' || res.error === 'permission' || res.error === 'refusal') s.engine = 'local';
      this.emit({ type: 'aiFallback', desk: s.desk, session: s, error: res.error });
      if (c.state === 'active') this.sayLocal(s, plan.text, plan.source, playerLine, before);
      this.sayPending(s);
      return;
    }
    // Rest des gestreamten Textes (bzw. alles, falls nichts gestreamt wurde).
    const rest = streamed ? splitter.flush(streamed) : [res.verdict.say];
    for (const sentence of rest) s.addCallerText(sentence);
    const factor = ai.floskeln.use(plan.text);
    const reply = this.calls.act(s.desk, (conv) => conv.applyAi(plan, res.verdict, factor));
    if (reply) playerLine.dTrust = Math.round(reply.trust - before);
    s.aiHistory.push(...res.messages);
    if (s.active) s.deal();
    this.sayPending(s);
  }

  private sayPending(s: CallSession): void {
    const p = s.pending;
    s.pending = null;
    if (p && s.active) this.say(s.desk, p.text, p.source, p.card);
  }

  hold(desk: number, on: boolean): void {
    this.calls.hold(desk, on);
  }

  hangUp(desk: number): void {
    const s = this.sessions.get(desk);
    if (s?.active) s.hungUp = true;
    s?.abort?.abort();
    this.calls.hangUp(desk);
  }

  /**
   * Masche an diesem Platz wählen (SCH-17), vor oder während des Anrufs. Ein laufendes Gespräch
   * übernimmt sie sofort (die Karten passen sich an), sonst gilt sie ab dem nächsten Abheben.
   */
  setScheme(desk: number, scheme: SchemeDef | null): void {
    this.chosen.set(desk, scheme);
    const s = this.sessions.get(desk);
    const c = this.calls.conversation(desk);
    if (s && c && s.active) {
      c.setScheme(scheme);
      s.deal();
    }
    this.emit({ type: 'scheme', desk, scheme });
  }

  /** Masche des laufenden Gesprächs bzw. die für das nächste gewählte. */
  scheme(desk: number): SchemeDef | null {
    const s = this.sessions.get(desk);
    const c = this.calls.conversation(desk);
    if (s?.active && c) return c.scheme;
    return this.chosen.get(desk) ?? null;
  }

  /** Turbo-Geschenk über die Plauderbude an den Anrufer schicken (SCH-03). */
  gift(desk: number): Reply | null {
    const r = this.calls.act(desk, (c) => c.gift());
    this.sessions.get(desk)?.deal();
    return r;
  }

  /** Fernzugriff: Der Anrufer kommentiert, was auf seinem PC passiert (SCH-22). */
  remote(desk: number, ev: RemoteEvent, amount = 0): Reply | null {
    return this.calls.act(desk, (c) => c.remote(ev, amount));
  }

  decline(desk: number): void {
    this.calls.decline(desk);
  }

  /** Verlauf eines beendeten Anrufs wegräumen (Telefon zeigt wieder die Anrufliste). */
  dismiss(desk: number): void {
    const s = this.sessions.get(desk);
    if (s && !s.active) this.sessions.delete(desk);
  }

  tick(dt: number): void {
    for (const s of this.sessions.values()) {
      const line = s.tick(dt);
      if (line) this.emit({ type: 'line', desk: s.desk, session: s, line });
    }
  }

  capture(s: CallSession, loot: Loot): void {
    const c: Capture = { callerId: s.caller.id, caller: s.caller, desk: s.desk, callId: s.callId, loot };
    this.onCapture(c);
    this.emit({ type: 'capture', desk: s.desk, capture: c });
  }

  destroy(): void {
    this.off();
    this.listeners.clear();
  }

  private handle(e: CallEvent): void {
    switch (e.type) {
      case 'ring':
        this.emit({ type: 'ring', desk: e.desk, callerId: e.callerId });
        break;
      case 'missed':
        this.emit({ type: 'missed', desk: e.desk, callerId: e.callerId });
        break;
      case 'answered': {
        const caller = this.callers.find((c) => c.id === e.conversation.caller.id) ?? e.conversation.caller;
        const s = new CallSession(e.desk, e.callId, caller, this, this.src, new Rng(e.callId * 7919 + 17));
        const status = this.ai?.status() ?? 'off';
        s.engine = status === 'ready' ? 'ai' : 'local';
        s.aiNotice = status === 'ready' || status === 'off' ? null : status;
        this.sessions.set(e.desk, s);
        const pre = this.chosen.get(e.desk);
        if (pre) e.conversation.setScheme(pre);
        s.addReply(e.reply);
        s.deal();
        this.dossier.met(caller.id);
        this.emit({ type: 'answered', desk: e.desk, session: s });
        break;
      }
      case 'reply': {
        const s = this.sessions.get(e.desk);
        if (s && s.callId === e.callId) {
          s.addReply(e.reply);
          this.dossier.observe(s.caller.id, e.reply);
        }
        break;
      }
      case 'ended': {
        const s = this.sessions.get(e.desk);
        if (s && s.callId === e.record.id) {
          if (s.hungUp) s.cutOff();
          if (e.record.outcome === 'success') this.dossier.win(s.caller.id);
          s.record = e.record;
          s.hand = [];
          this.emit({ type: 'ended', desk: e.desk, session: s, record: e.record });
        }
        break;
      }
    }
  }

  private emit(e: PhoneEvent): void {
    for (const fn of this.listeners) fn(e);
  }
}

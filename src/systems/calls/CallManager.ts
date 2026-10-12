import { TUNING } from '../../config/tuning';
import type { CallerDef } from '../conversation/caller';
import { Conversation, makeVariant, type Outcome, type Reply } from '../conversation/engine';
import { Rng } from '../rng/rng';

export interface CallRecord {
  id: number;
  desk: number;
  callerId: string;
  outcome: Outcome;
  trust: number;
  duration: number;
  conversation: Conversation | null;
}

export type DeskView =
  | { desk: number; kind: 'idle'; next: number }
  | { desk: number; kind: 'ringing'; left: number; callerId: string; callId: number }
  | { desk: number; kind: 'active'; callerId: string; callId: number; hold: boolean };

export type CallEvent =
  | { type: 'ring'; desk: number; callerId: string; callId: number }
  | { type: 'missed'; desk: number; callerId: string; callId: number }
  | { type: 'answered'; desk: number; callId: number; conversation: Conversation; reply: Reply }
  | { type: 'reply'; desk: number; callId: number; reply: Reply }
  | { type: 'ended'; desk: number; record: CallRecord };

type DeskState =
  | { kind: 'idle'; next: number }
  | { kind: 'ringing'; left: number; caller: CallerDef; callId: number; seed: number }
  | { kind: 'active'; conversation: Conversation; callId: number; started: number };

/**
 * Eingehende Anrufe für alle Arbeitsplätze (CAL-01, CAL-02, CAL-25): jeder Platz klingelt in eigenem
 * Takt, unbesetzte seltener; nach dem Abnehm-Fenster gilt ein Anruf als verpasst. Laufende Gespräche
 * ticken weiter, auch wenn niemand mehr am Platz sitzt (OS-14).
 */
export class CallManager {
  private readonly desks: DeskState[];
  private readonly staffed = new Set<number>();
  private readonly listeners = new Set<(e: CallEvent) => void>();
  private nextId = 1;
  private lastCaller: string | null = null;
  private time = 0;
  /** Neue zufällige Anrufe (am Tagesende aus). */
  open = true;
  /** Fest geplante Anrufer: klingeln nacheinander, sobald sich jemand an einen freien Platz setzt (Tutorial, Tests). */
  scripted: string[] = [];
  readonly history: CallRecord[] = [];

  constructor(
    private readonly rng: Rng,
    private readonly callers: readonly CallerDef[],
    deskCount: number,
    /** Arbeitstag: kürzere Abstände, mehr schwere Anrufer und Köder (DAY-15). */
    private readonly day = 1,
  ) {
    const c = TUNING.calls;
    this.desks = Array.from({ length: deskCount }, () => ({ kind: 'idle' as const, next: this.rng.range(c.firstRingMin, c.firstRingMax) * c.unstaffedGapFactor }));
  }

  on(fn: (e: CallEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Jemand sitzt am Platz (Spieler, später Bots): dort klingelt es im normalen Takt. */
  setStaffed(desk: number, on: boolean): void {
    if (on) {
      this.staffed.add(desk);
      const s = this.desks[desk];
      if (s?.kind !== 'idle') return;
      const next = this.scripted.shift();
      const caller = next ? this.callers.find((c) => c.id === next) : undefined;
      if (caller) this.ring(desk, caller);
      // Wer sich hinsetzt, muss nicht ewig warten.
      else s.next = Math.min(s.next, this.rng.range(TUNING.calls.firstRingMin, TUNING.calls.firstRingMax));
    } else this.staffed.delete(desk);
  }

  /** Platz sofort klingeln lassen (Tutorial, Tests); `callerId` sonst der nächste geplante bzw. zufällige. */
  ringNow(desk: number, callerId?: string): void {
    if (this.desks[desk]?.kind !== 'idle') return;
    const id = callerId ?? this.scripted.shift();
    this.ring(desk, id ? this.callers.find((c) => c.id === id) : undefined);
  }

  view(desk: number): DeskView {
    const s = this.desks[desk]!;
    if (s.kind === 'idle') return { desk, kind: 'idle', next: s.next };
    if (s.kind === 'ringing') return { desk, kind: 'ringing', left: s.left, callerId: s.caller.id, callId: s.callId };
    return { desk, kind: 'active', callerId: s.conversation.caller.id, callId: s.callId, hold: s.conversation.state === 'hold' };
  }

  views(): DeskView[] {
    return this.desks.map((_, i) => this.view(i));
  }

  conversation(desk: number): Conversation | null {
    const s = this.desks[desk];
    return s?.kind === 'active' ? s.conversation : null;
  }

  tick(dt: number): void {
    this.time += dt;
    this.desks.forEach((s, desk) => {
      if (s.kind === 'idle') {
        if (!this.open) return;
        s.next -= dt;
        if (s.next <= 0) this.ring(desk);
      } else if (s.kind === 'ringing') {
        s.left -= dt;
        if (s.left <= 0) {
          this.emit({ type: 'missed', desk, callerId: s.caller.id, callId: s.callId });
          this.history.push({ id: s.callId, desk, callerId: s.caller.id, outcome: 'missed', trust: 0, duration: 0, conversation: null });
          this.toIdle(desk);
        }
      } else {
        const reply = s.conversation.tick(dt);
        if (reply) this.emit({ type: 'reply', desk, callId: s.callId, reply });
        if (s.conversation.ended) this.finish(desk);
      }
    });
  }

  /** Abheben; liefert das Gespräch (oder null, wenn dort nichts klingelt). */
  answer(desk: number): Conversation | null {
    const s = this.desks[desk];
    if (s?.kind !== 'ringing') return null;
    const rng = new Rng(s.seed);
    const conversation = new Conversation(s.caller, rng, makeVariant(rng));
    this.desks[desk] = { kind: 'active', conversation, callId: s.callId, started: this.time };
    const reply = conversation.answer();
    this.emit({ type: 'answered', desk, callId: s.callId, conversation, reply });
    return conversation;
  }

  /** Spieler-Eingabe an das Gespräch an diesem Platz. */
  say(desk: number, text: string, source: 'typed' | 'voice' | 'card'): Reply | null {
    const s = this.desks[desk];
    if (s?.kind !== 'active') return null;
    const reply = s.conversation.say(text, source);
    this.emit({ type: 'reply', desk, callId: s.callId, reply });
    if (s.conversation.ended) this.finish(desk);
    return reply;
  }

  /** Beliebige Aktion am Gespräch (Masche, Geschenk, Fernzugriff …); Antwort und Ende wie bei `say`. */
  act(desk: number, fn: (c: Conversation) => Reply): Reply | null {
    const s = this.desks[desk];
    if (s?.kind !== 'active') return null;
    const reply = fn(s.conversation);
    if (reply.lines.length > 0 || reply.trustDelta !== 0 || reply.learned || reply.moodChanged || reply.ended) this.emit({ type: 'reply', desk, callId: s.callId, reply });
    if (s.conversation.ended) this.finish(desk);
    return reply;
  }

  hold(desk: number, on: boolean): Reply | null {
    const s = this.desks[desk];
    if (s?.kind !== 'active') return null;
    const reply = on ? s.conversation.hold() : s.conversation.resume();
    this.emit({ type: 'reply', desk, callId: s.callId, reply });
    return reply;
  }

  hangUp(desk: number): void {
    const s = this.desks[desk];
    if (s?.kind !== 'active') return;
    s.conversation.hangUp();
    this.finish(desk);
  }

  /** Klingelnden Anruf ablehnen (zählt als verpasst). */
  decline(desk: number): void {
    const s = this.desks[desk];
    if (s?.kind !== 'ringing') return;
    this.emit({ type: 'missed', desk, callerId: s.caller.id, callId: s.callId });
    this.history.push({ id: s.callId, desk, callerId: s.caller.id, outcome: 'missed', trust: 0, duration: 0, conversation: null });
    this.toIdle(desk);
  }

  private ring(desk: number, forced?: CallerDef): void {
    const busy = new Set(this.desks.flatMap((d) => (d.kind === 'ringing' ? [d.caller.id] : d.kind === 'active' ? [d.conversation.caller.id] : [])));
    const pool = this.callers.filter((c) => !busy.has(c.id) && c.id !== this.lastCaller);
    const caller = forced ?? this.pickWeighted(pool.length > 0 ? pool : this.callers);
    this.lastCaller = caller.id;
    const callId = this.nextId++;
    this.desks[desk] = { kind: 'ringing', left: TUNING.calls.ringSeconds, caller, callId, seed: this.rng.int(1, 2 ** 31 - 1) };
    this.emit({ type: 'ring', desk, callerId: caller.id, callId });
  }

  private finish(desk: number): void {
    const s = this.desks[desk];
    if (s?.kind !== 'active') return;
    const c = s.conversation;
    const record: CallRecord = { id: s.callId, desk, callerId: c.caller.id, outcome: c.outcome ?? 'hangup', trust: Math.round(c.trust), duration: this.time - s.started, conversation: c };
    this.history.push(record);
    this.toIdle(desk);
    this.emit({ type: 'ended', desk, record });
  }

  private toIdle(desk: number): void {
    const c = TUNING.calls;
    const d = TUNING.day;
    const base = Math.max(d.gapMinSeconds, this.rng.range(c.gapMin, c.gapMax) * (1 - d.gapShrinkPerDay) ** (this.day - 1));
    this.desks[desk] = { kind: 'idle', next: base * (this.staffed.has(desk) ? 1 : c.unstaffedGapFactor) };
  }

  /** Anrufer nach Tages-Gewicht: Mit jedem Tag kommen mehr schwere Anrufer und Köder (DAY-15). */
  private pickWeighted(pool: readonly CallerDef[]): CallerDef {
    const d = TUNING.day;
    const n = this.day - 1;
    const weight = (c: CallerDef): number => {
      const w = Math.max(0.05, d.callerWeight[c.difficulty] + d.callerWeightPerDay[c.difficulty] * n);
      return c.traits?.includes('baiter') ? w * (1 + d.baitWeightPerDay * n) : w;
    };
    const total = pool.reduce((sum, c) => sum + weight(c), 0);
    let r = this.rng.next() * total;
    for (const c of pool) {
      r -= weight(c);
      if (r <= 0) return c;
    }
    return pool[pool.length - 1]!;
  }

  private emit(e: CallEvent): void {
    for (const fn of this.listeners) fn(e);
  }
}

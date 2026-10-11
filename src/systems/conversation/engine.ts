import { TUNING } from '../../config/tuning';
import { Rng } from '../rng/rng';
import type { CallerDef, Trait } from './caller';
import { MOOD_FX, MoodState, NO_SIGNALS, type MoodSignals } from './mood';
import { understand } from './nlu';
import { jaccard, normalize } from './text';
import type { DemandKind, Features, Intent, Mood, Role } from './types';

/** Standard-Wirkung je Absicht auf das Vertrauen (Prozentpunkte je Einheit). */
export const DEFAULT_INTENT_WEIGHTS: Readonly<Record<Intent, number>> = {
  greet: 3,
  introduce: 4,
  smalltalk: 3,
  compliment: 4,
  empathy: 4,
  urgency: -3,
  threat: -8,
  calm: 3,
  explain: 2,
  demand: 0,
  confirm: 1,
  deny: -1,
  insult: -12,
  apology: 2,
  laugh: 1.5,
  thanks: 2,
  farewell: 0,
  promise: 2,
};

export type Outcome = 'success' | 'bait' | 'hangup' | 'farewell' | 'playerHangup' | 'missed';
export type HangupReason = 'trust' | 'angry' | 'patience' | 'hold' | 'contradiction';
export type CallState = 'active' | 'hold' | 'ended';
export type Phase = 'einstieg' | 'vertrauen' | 'forderung' | 'ende';

/** Eine Zeile des Anrufers: Situation (wird über i18n zu Text) plus Platzhalter. */
export interface LineRef {
  situation: string;
  params?: Record<string, string | number>;
}

export interface Loot {
  kind: DemandKind;
  value: string;
}

export interface Reply {
  lines: LineRef[];
  trustDelta: number;
  trust: number;
  mood: Mood;
  moodChanged: boolean;
  ended: boolean;
  outcome?: Outcome;
  reason?: HangupReason;
  loot?: Loot;
  features?: Features;
}

export interface LogEntry {
  t: number;
  who: 'player' | 'caller' | 'system';
  text?: string;
  situation?: string;
  source?: InputSource;
  trust: number;
  mood: Mood;
  dTrust?: number;
}

export type InputSource = 'typed' | 'voice' | 'card';

/** Zufällige Tagesform eines Anrufs (NPC-25): Laune, Hintergrund, Beute-Daten. */
export interface CallVariant {
  trustShift: number;
  noise: 'none' | 'tv' | 'hund' | 'baustelle' | 'kaffee' | 'wind' | 'radio' | 'kinder';
  loot: Record<DemandKind, string>;
}

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const NOISES: CallVariant['noise'][] = ['none', 'none', 'tv', 'hund', 'baustelle', 'kaffee', 'wind', 'radio', 'kinder'];

export function makeVariant(rng: Rng): CallVariant {
  const d = (n: number): string => Array.from({ length: n }, () => String(rng.int(0, 9))).join('');
  const l = (n: number): string => Array.from({ length: n }, () => LETTERS[rng.int(0, LETTERS.length - 1)]).join('');
  const mix = (n: number): string => Array.from({ length: n }, () => (rng.chance(0.5) ? l(1) : d(1))).join('');
  const num = d(6);
  return {
    trustShift: rng.int(-8, 8),
    noise: rng.pick(NOISES),
    loot: {
      // Fiktive Formate (GAME_DESIGN §5): bewusst unähnlich zu echten Nummern.
      nummer: `${l(2)} ${num.slice(0, 2)} ${num.slice(2, 4)} ${num.slice(4)}`,
      code: `${d(3)} ${d(3)}`,
      gutschein: `${mix(4)}-${mix(4)}`,
      geld: String(rng.int(3, 18) * 25),
      daten: `${rng.int(1, 99)}`,
      klick: 'ok',
      jawort: 'ja',
    },
  };
}

/**
 * Ein Telefongespräch mit einem Anrufer. Reine Logik: Eingaben (Text aus Tippen, Sprache oder Karte)
 * werden verstanden, gegen Persönlichkeit, Gedächtnis, Phase und Abnutzung verrechnet und ergeben
 * Vertrauen, Stimmung und die Antwort-Situationen. Zeit läuft über `tick()`.
 */
export class Conversation {
  readonly caller: CallerDef;
  readonly variant: CallVariant;
  trust: number;
  patience = 1;
  state: CallState = 'active';
  phase: Phase = 'einstieg';
  outcome: Outcome | null = null;
  reason: HangupReason | null = null;
  loot: Loot | null = null;
  readonly log: LogEntry[] = [];
  /** Gesprächszeit (s). */
  time = 0;
  turns = 0;
  /** Gedächtnis (CAL-12). */
  readonly memory: { role: Role | null; name: string | null; said: string[][]; promises: number; earlyDemands: number };
  /** Schläft gerade (Gerd). */
  asleep = false;

  private readonly mood: MoodState;
  private readonly rng: Rng;
  private readonly uses = new Map<string, number>();
  private silence = 0;
  private prompts = 0;
  private holdTime = 0;
  private angryLow = 0;
  private sinceTrait = 0;
  private chatterTimer = 0;

  constructor(caller: CallerDef, rng: Rng, variant?: CallVariant) {
    this.caller = caller;
    this.rng = rng;
    this.variant = variant ?? makeVariant(rng);
    const [lo, hi] = caller.startTrust;
    this.trust = clamp(rng.int(lo, hi) + this.variant.trustShift, 1, 95);
    this.mood = new MoodState(caller.startMood ?? 'neutral', caller.temper);
    this.memory = { role: null, name: null, said: [], promises: 0, earlyDemands: 0 };
  }

  get currentMood(): Mood {
    return this.mood.mood;
  }

  get ended(): boolean {
    return this.state === 'ended';
  }

  get threshold(): number {
    return this.caller.demandThreshold ?? TUNING.calls.demandThreshold;
  }

  /** Sekunden ohne Eingabe bis zur ersten Mahnung. */
  get patienceSeconds(): number {
    return this.caller.patience ?? TUNING.calls.patienceSeconds;
  }

  has(trait: Trait): boolean {
    return this.caller.traits?.includes(trait) ?? false;
  }

  /** Abheben: Der Anrufer meldet sich. */
  answer(): Reply {
    const lines: LineRef[] = [{ situation: 'answer' }];
    if (this.variant.noise !== 'none') lines.push({ situation: `noise.${this.variant.noise}` });
    this.logCaller(lines);
    return this.reply(lines, 0, false);
  }

  /** Eingabe des Spielers (getippt, gesprochen oder als Karte). */
  say(text: string, source: InputSource = 'typed'): Reply {
    if (this.state !== 'active' || text.trim().length === 0) return this.reply([], 0, false);
    const f = understand(text, { callerNames: this.caller.names });
    this.turns++;
    this.log.push({ t: this.time, who: 'player', text, source, trust: this.trust, mood: this.mood.mood });
    const out = this.evaluate(f, text);
    this.silence = 0;
    this.prompts = 0;
    this.patience = Math.min(1, this.patience + TUNING.calls.patienceRefill);
    out.features = f;
    return out;
  }

  /** Halten (Warteschleife). */
  hold(): Reply {
    if (this.state !== 'active') return this.reply([], 0, false);
    this.state = 'hold';
    this.holdTime = 0;
    const lines = [{ situation: 'hold.start' }];
    this.logCaller(lines);
    return this.reply(lines, 0, false);
  }

  resume(): Reply {
    if (this.state !== 'hold') return this.reply([], 0, false);
    this.state = 'active';
    const long = this.holdTime > TUNING.calls.holdMaxSeconds / 2;
    let moodChanged = false;
    if (long) moodChanged = this.mood.apply({ ...NO_SIGNALS, repetition: 0.5, silence: true }, this.trust) !== null;
    const lines = [{ situation: long ? 'hold.backLong' : 'hold.back' }];
    if (long) this.addTrust(-4);
    this.silence = 0;
    this.logCaller(lines);
    return this.reply(lines, long ? -4 : 0, moodChanged);
  }

  /** Spieler legt auf. */
  hangUp(): void {
    if (this.state === 'ended') return;
    this.end('playerHangup');
  }

  /** Zeit läuft (nur während des Gesprächs). Liefert Zeilen, wenn der Anrufer von sich aus etwas sagt. */
  tick(dt: number): Reply | null {
    if (this.state === 'ended') return null;
    this.time += dt;
    const fx = MOOD_FX[this.mood.mood];
    if (this.state === 'hold') {
      this.holdTime += dt;
      if (this.holdTime >= TUNING.calls.holdMaxSeconds * this.patienceScale()) return this.hangup('hold');
      return null;
    }
    let moodChanged = this.mood.decay(dt, this.trust) !== null;
    this.silence += dt;
    this.sinceTrait += dt;
    const lines: LineRef[] = [];

    // Wut bei sehr wenig Vertrauen: nach kurzer Zeit legt der Anrufer auf.
    if (this.mood.mood === 'wuetend' && this.trust < TUNING.calls.angryHangupTrust) {
      this.angryLow += dt;
      if (this.angryLow >= TUNING.calls.angryHangupSeconds) return this.hangup('angry');
    } else this.angryLow = 0;

    // Schläfer nicken bei Stille ein.
    if (this.has('sleepy') && !this.asleep && this.silence > this.patienceSeconds * 0.5) {
      this.asleep = true;
      lines.push({ situation: 'trait.sleep' });
    }

    // Vielredner füllen Stille selbst.
    if (this.has('chatty')) {
      this.chatterTimer += dt;
      if (this.chatterTimer >= 9 && this.silence > 6) {
        this.chatterTimer = 0;
        lines.push({ situation: 'trait.chatter' });
      }
    }

    // Zurückschlagen (Moonboy): von sich aus Coin anpreisen oder sticheln.
    if (this.has('strikesBack') && this.sinceTrait >= 16 && this.silence > 4) {
      this.sinceTrait = 0;
      lines.push({ situation: this.trust < 45 ? 'trait.strikeThreat' : 'trait.strike' });
    }

    // Geduld: nach patienceSeconds ohne Eingabe mahnen, danach leert sie sich bis zum Auflegen.
    const ps = this.patienceSeconds * this.patienceScale();
    if (this.silence > ps) {
      const drain = (1 / (ps * TUNING.calls.patienceDrainFactor)) * fx.patience * (this.asleep ? 0.3 : 1) * (this.has('chatty') ? 0.4 : 1);
      this.patience = Math.max(0, this.patience - drain * dt);
      if (this.prompts === 0 || (this.prompts === 1 && this.patience < 0.5)) {
        this.prompts++;
        if (!this.asleep) lines.push({ situation: this.prompts === 1 ? 'silence.1' : 'silence.2' });
        moodChanged = this.mood.apply({ ...NO_SIGNALS, silence: true }, this.trust) !== null || moodChanged;
      }
      if (this.patience <= 0) return this.hangup('patience');
    }

    if (lines.length === 0 && !moodChanged) return null;
    if (moodChanged && lines.length === 0) lines.push({ situation: `mood.${this.mood.mood}` });
    this.logCaller(lines);
    return this.reply(lines, 0, moodChanged);
  }

  // ------------------------------------------------------------------ Bewertung einer Eingabe

  private evaluate(f: Features, text: string): Reply {
    const c = this.caller;
    const fx = MOOD_FX[this.mood.mood];
    const lines: LineRef[] = [];
    const sig: MoodSignals = { ...NO_SIGNALS };
    let gain = 0;
    let loss = 0;
    /** Beitrag je Auslöser, um die Hauptreaktion zu bestimmen. */
    const parts: { key: string; v: number; params?: Record<string, string | number> }[] = [];
    const add = (key: string, v: number, params?: Record<string, string | number>): void => {
      if (v === 0) return;
      parts.push({ key, v, ...(params ? { params } : {}) });
      if (v > 0) gain += v;
      else loss += -v;
    };

    // Ein Schläfer muss erst geweckt werden.
    if (this.asleep) {
      const wakes = (f.intents.greet ?? 0) > 0 || f.shouting || f.nameMention || f.words >= 6;
      if (!wakes) {
        const l = [{ situation: 'trait.snore' }];
        this.logCaller(l);
        return this.reply(l, 0, false);
      }
      this.asleep = false;
      lines.push({ situation: 'trait.wake' });
    }

    // Ähnlicher Satz wie zuvor? (Abnutzung, CAL-13)
    let similar = 0;
    for (const prev of this.memory.said) similar = Math.max(similar, jaccard(prev, f.stems));
    const repeat = f.stems.length > 0 && similar > TUNING.calls.similarSentenceJaccard;
    this.memory.said.push(f.stems);
    if (repeat) sig.repetition = 1;
    const repFactor = repeat ? TUNING.calls.similarSentenceFactor : 1;

    // Absichten.
    for (const [intent, value] of Object.entries(f.intents) as [Intent, number][]) {
      if (intent === 'demand' || intent === 'farewell') continue;
      let w = c.intents?.[intent] ?? DEFAULT_INTENT_WEIGHTS[intent];
      if (intent === 'greet' && this.turns > 2) w *= 0.2;
      if (intent === 'introduce' && this.turns > 3) w *= 0.3;
      if (intent === 'urgency' && this.phase === 'einstieg') w *= 1.5;
      if (intent === 'explain' && this.has('protocol')) w *= 1.5;
      if (intent === 'urgency' && this.has('protocol')) w *= 2;
      if (intent === 'empathy' && this.has('complainer')) w *= 1.5;
      if (intent === 'apology' && (this.mood.mood === 'wuetend' || this.mood.mood === 'genervt')) w += this.has('fragile') ? 10 : 4;
      if (intent === 'promise') this.memory.promises++;
      const wear = w > 0 ? this.wear(`i:${intent}`) * repFactor : 1;
      add(`react.${intent}`, w * value * wear);
    }

    // Signale für die Stimmung.
    sig.insult = f.intents.insult ?? 0;
    sig.threat = f.intents.threat ?? 0;
    sig.urgency = f.intents.urgency ?? 0;
    sig.laugh = f.intents.laugh ?? 0;
    sig.compliment = f.intents.compliment ?? 0;
    sig.empathy = f.intents.empathy ?? 0;
    sig.calm = f.intents.calm ?? 0;
    sig.apology = f.intents.apology ?? 0;
    sig.nonsense = f.nonsense;
    sig.shouting = f.shouting;

    // Rollen und Namen merken; Widersprüche kosten (CAL-12).
    let contradiction: LineRef | null = null;
    for (const role of f.roleClaims) {
      if (this.memory.role === null) {
        this.memory.role = role;
        add(`role.${(c.roles?.[role] ?? 0) >= 0 ? 'pos' : 'neg'}`, (c.roles?.[role] ?? 0) * 6, { role });
        if (this.has('protocol') && f.claimedName) add('trait.protocolOk', 6);
      } else if (this.memory.role !== role && !contradiction) {
        contradiction = { situation: 'contradiction.role', params: { role: this.memory.role, newRole: role } };
        add('contradiction', -TUNING.calls.contradictionPenalty * (0.5 + c.temper.suspicion));
        sig.contradiction = true;
      }
    }
    if (f.claimedName) {
      if (this.memory.name === null) this.memory.name = f.claimedName;
      else if (normalize(this.memory.name) !== normalize(f.claimedName) && !contradiction) {
        contradiction = { situation: 'contradiction.name', params: { name: this.memory.name, newName: f.claimedName } };
        add('contradiction', -TUNING.calls.contradictionPenalty * (0.5 + c.temper.suspicion));
        sig.contradiction = true;
      }
    }

    // Vorlieben und Abneigungen.
    for (const topic of f.topics) {
      if (c.likes.includes(topic)) {
        add('topic.like', 5 * this.wear(`t:${topic}`) * repFactor, { topic });
        sig.like += 1;
      } else if (c.dislikes.includes(topic)) {
        add('topic.dislike', -5, { topic });
        sig.dislike += 1;
      }
    }

    if (f.nameMention) add('name', 3 * this.wear('name') * repFactor);
    if (f.polite > 0) add('polite', 2 * f.polite * this.wear('polite'));
    if (f.nonsense > 0) add('react.nonsense', -4 * f.nonsense * (1 - c.temper.humor * 0.7), f.echo ? { echo: f.echo } : undefined);
    if (f.shouting) add('react.shouting', -4);
    if (f.question && f.nonsense === 0) add('react.question', 0.5);
    if (f.words > 35) add(this.has('chatty') ? 'trait.chattyLikes' : 'react.monologue', this.has('chatty') ? 2 : -1);
    if (repeat) add('react.repeat', -1);

    // Besserwisser: schlampige Eingaben werden korrigiert, saubere Sätze gelobt.
    if (this.has('grammar')) {
      const words = text.trim().split(/\s+/).length;
      if (words >= 3 && text === text.toLowerCase()) add('trait.grammar', -2);
      else if (words >= 8 && /^[A-ZÄÖÜ]/.test(text.trim()) && /[.!?]$/.test(text.trim())) add('trait.grammarOk', 3);
    }
    // Abergläubische deuten genannte Zahlen.
    if (this.has('omens') && f.numbers.length > 0) add('trait.omen', 2);

    // Viele Schlagwörter in einem Satz addieren sich nicht einfach (stärkster Auslöser zuerst).
    gain = parts
      .filter((p) => p.v > 0)
      .map((p) => p.v)
      .sort((a, b) => b - a)
      .reduce((sum, v, i) => sum + v * TUNING.calls.stackFalloff ** i, 0);

    // Charakter-Verstärker.
    if (this.has('stoic')) {
      gain *= 0.7;
      loss *= 0.7;
    }
    if (this.has('baiter')) gain *= 1.3;
    // Wer sich widerspricht, dem glaubt man den Rest des Satzes auch nicht mehr.
    if (sig.contradiction) gain *= 0.3;
    let explode = false;
    if (this.has('fragile') && ((f.intents.insult ?? 0) > 0 || f.shouting)) {
      loss += 10;
      explode = true;
    }

    // Stimmung wirkt auf Gewinne und Verluste.
    let delta = gain * fx.gain - loss * fx.loss;

    // Forderung (CAL-11): erst Vertrauen, dann fragen.
    const demanding = f.demands.length > 0 || (f.intents.demand ?? 0) > 0;
    let success = false;
    if (demanding) {
      const kind: DemandKind = f.demands[0] ?? 'nummer';
      const trustAfter = this.trust + delta;
      if (trustAfter >= this.threshold && !(f.intents.insult ?? 0)) {
        success = true;
        this.loot = { kind, value: this.variant.loot[kind] };
      } else {
        this.memory.earlyDemands++;
        const missing = Math.max(0, 1 - Math.max(0, trustAfter) / this.threshold);
        const penalty = (TUNING.calls.earlyDemandBase + TUNING.calls.earlyDemandScale * missing) * (0.6 + c.temper.suspicion) * Math.pow(1.3, this.memory.earlyDemands - 1);
        delta -= penalty;
        parts.push({ key: 'demand.early', v: -penalty, params: { demand: kind } });
        sig.earlyDemand = true;
        this.phase = 'forderung';
      }
    }

    sig.dTrust = delta;
    this.addTrust(delta);
    if (this.phase === 'einstieg' && this.turns >= 2) this.phase = 'vertrauen';

    // Stimmung.
    let moodChanged = false;
    if (explode) moodChanged = this.mood.force('wuetend') !== null;
    moodChanged = this.mood.apply(sig, this.trust) !== null || moodChanged;

    // ---------------------------------------------------------------- Antwort wählen
    if (contradiction) lines.push(contradiction);
    if (success) {
      this.phase = 'ende';
      const baiter = this.has('baiter');
      lines.push({ situation: baiter ? 'demand.bait' : 'demand.agree', params: { demand: this.loot!.kind } });
      lines.push({ situation: baiter ? 'loot.bait' : `loot.${this.loot!.kind}`, params: { loot: this.loot!.value } });
      lines.push({ situation: 'end.success' });
      this.logCaller(lines);
      this.end(baiter ? 'bait' : 'success');
      return this.reply(lines, delta, moodChanged);
    }
    if (this.trust <= 0) {
      lines.push(...this.mainReaction(parts, f, explode));
      return this.hangup('trust', lines, delta);
    }
    if (f.intents.farewell) {
      lines.push({ situation: 'end.farewell' });
      this.logCaller(lines);
      this.end('farewell');
      return this.reply(lines, delta, moodChanged);
    }
    lines.push(...this.mainReaction(parts, f, explode));
    if (moodChanged && !explode) lines.push({ situation: `mood.${this.mood.mood}` });
    // Zurückschlagen als Antwort auf Druck.
    if (this.has('strikesBack') && ((f.intents.insult ?? 0) > 0 || (f.intents.threat ?? 0) > 0) && this.rng.chance(0.7)) {
      lines.push({ situation: 'trait.strikeThreat' });
      this.sinceTrait = 0;
    }
    if (this.has('complainer') && this.rng.chance(0.25)) lines.push({ situation: 'trait.complain' });
    this.logCaller(lines);
    return this.reply(lines, delta, moodChanged);
  }

  /** Hauptreaktion: der stärkste Auslöser dieses Satzes (positiv oder negativ). */
  private mainReaction(parts: { key: string; v: number; params?: Record<string, string | number> }[], f: Features, explode: boolean): LineRef[] {
    if (explode) return [{ situation: 'trait.explode' }];
    const early = parts.find((p) => p.key === 'demand.early');
    if (early) return [{ situation: 'demand.early', ...(early.params ? { params: early.params } : {}) }];
    const top = [...parts].filter((p) => p.key !== 'polite' && p.key !== 'contradiction').sort((a, b) => Math.abs(b.v) - Math.abs(a.v))[0];
    if (!top) {
      if (f.echo) return [{ situation: 'react.echo', params: { echo: f.echo } }];
      return [{ situation: f.question ? 'react.question' : 'react.neutral' }];
    }
    const params = { ...(top.params ?? {}), ...(f.echo ? { echo: f.echo } : {}) };
    if (top.key.startsWith('react.') && !['react.nonsense', 'react.shouting', 'react.question', 'react.monologue', 'react.repeat', 'react.echo'].includes(top.key)) {
      return [{ situation: `${top.key}.${top.v >= 0 ? 'pos' : 'neg'}`, params }];
    }
    if (top.key === 'name') return [{ situation: 'react.name' }];
    if (top.key === 'react.nonsense' && this.caller.temper.humor >= 0.6) return [{ situation: 'react.nonsenseAmused', params }];
    return [{ situation: top.key, params }];
  }

  // ------------------------------------------------------------------ Hilfen

  private wear(key: string): number {
    const n = this.uses.get(key) ?? 0;
    this.uses.set(key, n + 1);
    return Math.pow(TUNING.calls.wearPerRepeat, n);
  }

  private patienceScale(): number {
    return this.has('chatty') ? 1.6 : 1;
  }

  private addTrust(d: number): void {
    this.trust = clamp(this.trust + d, 0, 100);
  }

  private hangup(reason: HangupReason, lines: LineRef[] = [], delta = 0): Reply {
    lines.push({ situation: `hangup.${reason}` });
    this.reason = reason;
    this.logCaller(lines);
    this.end('hangup');
    return this.reply(lines, delta, false);
  }

  private end(outcome: Outcome): void {
    this.state = 'ended';
    this.outcome = outcome;
    this.log.push({ t: this.time, who: 'system', situation: `end.${outcome}`, trust: this.trust, mood: this.mood.mood });
  }

  private logCaller(lines: LineRef[]): void {
    for (const l of lines) this.log.push({ t: this.time, who: 'caller', situation: l.situation, trust: this.trust, mood: this.mood.mood });
  }

  private reply(lines: LineRef[], delta: number, moodChanged: boolean): Reply {
    const r: Reply = { lines, trustDelta: Math.round(delta * 10) / 10, trust: Math.round(this.trust), mood: this.mood.mood, moodChanged, ended: this.state === 'ended' };
    if (this.outcome) r.outcome = this.outcome;
    if (this.reason) r.reason = this.reason;
    if (this.loot) r.loot = this.loot;
    return r;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}


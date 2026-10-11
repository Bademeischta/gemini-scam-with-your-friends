import { TUNING } from '../../config/tuning';
import type { SchemeDef } from '../../data/schemes';
import { Rng } from '../rng/rng';
import type { CallerDef, Trait } from './caller';
import { MOOD_FX, MoodState, NO_SIGNALS, type MoodSignals } from './mood';
import { understand } from './nlu';
import { jaccard, normalize } from './text';
import type { DemandKind, Features, Intent, Mood, Role, Topic } from './types';

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
/** Gesprächsphasen (CAL-14): mit Masche inkl. Pitch; ohne Masche entfällt der Pitch. */
export const PHASES = ['einstieg', 'vertrauen', 'pitch', 'forderung', 'beute', 'ende'] as const;
export type Phase = (typeof PHASES)[number];

/** Ereignisse beim Fernzugriff auf den PC des Anrufers (SCH-22). */
export type RemoteEvent = 'start' | 'ok' | 'suspicious' | 'bank' | 'transferOk' | 'transferBig' | 'wrongRecipient' | 'end';

/** Eine Zeile des Anrufers: Situation (wird über i18n zu Text) plus Platzhalter. */
export interface LineRef {
  situation: string;
  params?: Record<string, string | number>;
}

export interface Loot {
  kind: DemandKind;
  value: string;
  /** Masche, für die die Beute erfragt wurde (null = ohne Masche). */
  schemeId: string | null;
  /** Gutschein: vorgelesener Betrag (₮). */
  amount?: number;
  /** Köder: wertlose Beute. */
  bait?: boolean;
  /** So wurde sie vorgelesen (mit Versprechern), für den Notizblock. */
  heard: string;
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
  /** Vorlieben/Abneigungen, auf die der Anrufer in diesem Satz reagiert hat (Kundenkartei). */
  learned?: { likes: Topic[]; dislikes: Topic[] };
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
  /** Betrag des Gutscheins (₮). */
  gutscheinAmount: number;
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
      // Zahlungs-Code der „Überweisung“ (fiktives Format).
      geld: `${l(2)}-${d(4)}`,
      daten: `${rng.int(1, 99)}`,
      klick: 'ok',
      jawort: 'ja ja ja',
    },
    gutscheinAmount: rng.int(4, 15) * 20,
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
  readonly log: LogEntry[] = [];
  /** Gesprächszeit (s). */
  time = 0;
  turns = 0;
  /** Gedächtnis (CAL-12). */
  readonly memory: { role: Role | null; name: string | null; said: string[][]; promises: number; earlyDemands: number; demandsTried: number };
  /** Schläft gerade (Gerd). */
  asleep = false;
  /** Gewählte Masche (SCH-17) und ihr Fortschritt. */
  scheme: SchemeDef | null = null;
  pitched = false;
  demandIndex = 0;
  /** Turbo-Geschenk ist angekommen (SCH-03). */
  giftSent = false;
  /** Bisher erhaltene Beute (Diktat abgeschlossen). */
  readonly loots: Loot[] = [];

  /** Zuletzt erhaltene Beute. */
  get loot(): Loot | null {
    return this.loots[this.loots.length - 1] ?? null;
  }
  private yeses = 0;
  private repeats = 0;
  private sinceLoot = 0;
  private newLoot: Loot | null = null;
  private learned: { likes: Topic[]; dislikes: Topic[] } = { likes: [], dislikes: [] };

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
    this.memory = { role: null, name: null, said: [], promises: 0, earlyDemands: 0, demandsTried: 0 };
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
    // Wer redet, füllt die Geduld auf – vor der Auswertung, damit Nachfragen trotzdem Geduld kosten.
    this.patience = Math.min(1, this.patience + TUNING.calls.patienceRefill);
    const out = this.evaluate(f, text);
    this.silence = 0;
    this.prompts = 0;
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

  /** Spieler legt auf (nach erhaltener Beute zählt der Anruf als Erfolg). */
  hangUp(): void {
    if (this.state === 'ended') return;
    this.end(this.lootOutcome() ?? 'playerHangup');
  }

  // ------------------------------------------------------------------ Maschen (CAL-14, SCH-17)

  /** Masche für dieses Gespräch wählen (vorher oder mittendrin). */
  setScheme(def: SchemeDef | null): void {
    if (this.scheme?.id === def?.id) return;
    this.scheme = def;
    this.pitched = false;
    this.demandIndex = 0;
    this.yeses = 0;
    this.updatePhase();
  }

  /** Fan (+1), Skeptiker (−1) oder neutral (0) gegenüber der gewählten Masche. */
  get affinity(): number {
    const s = this.scheme;
    if (!s) return 0;
    if (s.fans.includes(this.caller.id)) return 1;
    if (s.skeptics.includes(this.caller.id)) return -1;
    return 0;
  }

  /** Nächste Forderung der Masche (null = alle erfüllt bzw. keine Masche). */
  get nextDemand(): DemandKind | null {
    return this.scheme?.demands[this.demandIndex] ?? null;
  }

  /** Vertrauen, ab dem eine Forderung dieser Art klappt. */
  thresholdFor(kind: DemandKind): number {
    const a = this.affinity;
    return this.threshold + TUNING.calls.demandOffset[kind] - (a > 0 ? TUNING.calls.fanBonus : 0) + (a < 0 ? TUNING.calls.skepticMalus : 0);
  }

  /** Ab diesem Vertrauen wirkt der Pitch der gewählten Masche. */
  get pitchTrust(): number {
    const a = this.affinity;
    return TUNING.calls.pitchTrust - (a > 0 ? TUNING.calls.fanBonus : 0) + (a < 0 ? TUNING.calls.skepticMalus : 0);
  }

  /** Turbo-Geschenk über die Plauderbude geschickt (SCH-03). */
  gift(): Reply {
    if (this.state !== 'active' || this.giftSent) return this.reply([], 0, false);
    this.giftSent = true;
    this.addTrust(2);
    const lines = [{ situation: 'gift.received' }];
    this.logCaller(lines);
    return this.reply(lines, 2, false);
  }

  /** Ereignis beim Fernzugriff (SCH-22): Der Anrufer kommentiert, verdächtige Klicks kosten Vertrauen. */
  remote(ev: RemoteEvent, amount = 0): Reply {
    if (this.state !== 'active') return this.reply([], 0, false);
    const susp = this.caller.temper.suspicion;
    const cost: Partial<Record<RemoteEvent, number>> = { suspicious: 5 + 6 * susp, transferBig: 10 + 6 * susp, wrongRecipient: 3 };
    const d = cost[ev] ? -cost[ev] : 0;
    this.addTrust(d);
    this.silence = 0;
    let moodChanged = false;
    if (ev === 'suspicious' || ev === 'transferBig') moodChanged = this.mood.apply({ ...NO_SIGNALS, threat: 0.4, dTrust: d }, this.trust) !== null;
    const lines: LineRef[] = [{ situation: `remote.${ev}`, ...(ev === 'transferBig' ? { params: { amount } } : {}) }];
    if (this.trust <= 0) return this.hangup('trust', lines, d);
    this.logCaller(lines);
    return this.reply(lines, d, moodChanged);
  }

  /** Phase aus dem Gesprächsstand (für Leitfaden und Fortschrittsbalken). */
  private updatePhase(): void {
    if (this.phase === 'beute' || this.phase === 'ende') {
      if (this.scheme && this.nextDemand) this.phase = 'forderung';
      return;
    }
    // Erzählte Geschichte zählt immer (auch wenn man gleich mit der Tür ins Haus fällt).
    if (this.scheme && this.pitched) this.phase = 'forderung';
    else if (this.turns < 2 && this.memory.role === null) this.phase = 'einstieg';
    else if (this.scheme) this.phase = this.trust >= this.pitchTrust ? 'pitch' : 'vertrauen';
    else if (this.memory.demandsTried > 0) this.phase = 'forderung';
    else this.phase = 'vertrauen';
  }

  private lootOutcome(): Outcome | null {
    if (this.loots.length === 0) return null;
    return this.loots.every((l) => l.bait) ? 'bait' : 'success';
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
    this.sinceLoot += dt;
    if (this.phase === 'beute' && this.sinceLoot >= TUNING.calls.lootPhaseSeconds) this.phase = this.scheme && this.nextDemand ? 'forderung' : 'ende';
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

    // Bitte um Wiederholung nach dem Diktat (CAL-15): kostet Geduld, ab dem zweiten Mal Vertrauen.
    const lastLoot = this.loots[this.loots.length - 1];
    const demandsNew = f.demands.length > 0 && f.demands[0] !== lastLoot?.kind;
    if (lastLoot && !lastLoot.bait && f.askRepeat && !demandsNew && lastLoot.kind !== 'jawort') {
      this.repeats++;
      const cost = this.repeats >= 2 ? TUNING.calls.repeatTrustCost * (this.repeats - 1) : 0;
      this.addTrust(-cost);
      this.patience = Math.max(0.1, this.patience - TUNING.calls.repeatPatienceCost);
      lines.push({ situation: this.repeats >= 3 ? 'dictate.repeatAnnoyed' : 'dictate.repeat', params: { all: lastLoot.value } });
      this.logCaller(lines);
      return this.reply(lines, -cost, false);
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
        // Passt die Rolle zur gewählten Masche, wirkt die Vorstellung glaubwürdiger.
        if (this.scheme?.roles.includes(role)) add('roleFit', TUNING.calls.roleFitBonus);
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
        this.learned.likes.push(topic);
      } else if (c.dislikes.includes(topic)) {
        add('topic.dislike', -5, { topic });
        sig.dislike += 1;
        this.learned.dislikes.push(topic);
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

    // Pitch: die Geschichte der gewählten Masche (CAL-14). Zu früh erzählt wirkt sie unglaubwürdig,
    // Skeptiker reagieren dann richtig sauer; Fans sind früher bereit und begeistert.
    const sch = this.scheme;
    if (sch && f.schemes.includes(sch.id)) {
      const a = this.affinity;
      const params = { scheme: sch.id };
      if (this.trust < this.pitchTrust) {
        if (a < 0) add('scheme.pitch.neg', -6 * (0.6 + c.temper.suspicion), params);
        else add('scheme.pitch.early', -4 * (0.6 + c.temper.suspicion), params);
      } else {
        add('scheme.pitch.pos', (TUNING.calls.pitchGain + (a > 0 ? 3 : 0)) * this.wear('pitch') * repFactor, params);
        this.pitched = true;
      }
    }

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

    // Forderung (CAL-11): erst Vertrauen, dann fragen. Mit Masche: erst die Geschichte, dann die Forderung.
    const demanding = f.demands.length > 0 || (f.intents.demand ?? 0) > 0;
    let success: DemandKind | null = null;
    if (demanding) {
      const expected = this.nextDemand;
      const kind: DemandKind = f.demands.find((d) => d === expected) ?? f.demands[0] ?? expected ?? 'nummer';
      const forScheme = sch !== null && kind === expected;
      this.memory.demandsTried++;
      const trustAfter = this.trust + delta;
      if (forScheme && !this.pitched) {
        // Forderung ohne Geschichte: „Wofür brauchen Sie das denn?“
        const pen = 5 * (0.6 + c.temper.suspicion);
        delta -= pen;
        parts.push({ key: 'scheme.why', v: -pen, params: { scheme: sch.id } });
        sig.earlyDemand = true;
      } else if (forScheme && sch.input === 'plauderbude' && !this.giftSent) {
        // Turbo-Geschenk: ohne Geschenk in der Plauderbude gibt es keinen Login-Code.
        delta -= 1;
        parts.push({ key: 'gift.missing', v: -1 });
      } else if (trustAfter >= this.thresholdFor(kind) && !(f.intents.insult ?? 0)) {
        success = kind;
      } else {
        this.memory.earlyDemands++;
        const th = this.thresholdFor(kind);
        const missing = Math.max(0, 1 - Math.max(0, trustAfter) / th);
        const penalty = (TUNING.calls.earlyDemandBase + TUNING.calls.earlyDemandScale * missing) * (0.6 + c.temper.suspicion) * Math.pow(1.3, this.memory.earlyDemands - 1);
        delta -= penalty;
        parts.push({ key: 'demand.early', v: -penalty, params: { demand: kind } });
        sig.earlyDemand = true;
      }
    }

    sig.dTrust = delta;
    this.addTrust(delta);
    this.updatePhase();

    // Stimmung.
    let moodChanged = false;
    if (explode) moodChanged = this.mood.force('wuetend') !== null;
    moodChanged = this.mood.apply(sig, this.trust) !== null || moodChanged;

    // ---------------------------------------------------------------- Antwort wählen
    if (contradiction) lines.push(contradiction);
    if (success) {
      lines.push(...this.grantLoot(success));
      this.logCaller(lines);
      return this.reply(lines, delta, moodChanged);
    }
    if (this.trust <= 0) {
      lines.push(...this.mainReaction(parts, f, explode));
      return this.hangup('trust', lines, delta);
    }
    if (f.intents.farewell) {
      const out = this.lootOutcome();
      const last = this.loots[this.loots.length - 1];
      if (out === 'success' && last?.schemeId) lines.push({ situation: 'scheme.done', params: { scheme: last.schemeId } });
      else lines.push({ situation: out === 'success' ? 'end.success' : 'end.farewell' });
      this.logCaller(lines);
      this.end(out ?? 'farewell');
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
    const blocking = parts.find((p) => p.key === 'demand.early' || p.key === 'scheme.why' || p.key === 'gift.missing');
    if (blocking) return [{ situation: blocking.key, ...(blocking.params ? { params: blocking.params } : {}) }];
    const top = [...parts].filter((p) => p.key !== 'polite' && p.key !== 'contradiction' && p.key !== 'roleFit').sort((a, b) => Math.abs(b.v) - Math.abs(a.v))[0];
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

  // ------------------------------------------------------------------ Beute (CAL-15)

  /** Forderung erfüllt: Zusage, Diktat (bzw. „Ja“), Beute merken. */
  private grantLoot(kind: DemandKind): LineRef[] {
    const sch = this.scheme && kind === this.nextDemand ? this.scheme : null;
    const baiter = this.has('baiter');
    const lines: LineRef[] = [];
    if (sch) this.demandIndex++;
    this.sinceLoot = 0;
    this.repeats = 0;
    this.phase = 'beute';
    if (kind === 'jawort' && !baiter) {
      // Ja-Wort wird mitgeschnitten; bei der Abo-Masche zählt erst das letzte Ja als Beute.
      this.yeses++;
      lines.push({ situation: this.yeses > 1 ? 'jawort.more' : 'demand.agree', params: { demand: kind } }, { situation: 'loot.jawort' });
      if (sch && this.nextDemand === 'jawort') {
        this.phase = 'forderung';
        return lines;
      }
      this.recordLoot({ kind, value: this.variant.loot.jawort, schemeId: sch?.id ?? null, heard: this.variant.loot.jawort });
      return lines;
    }
    lines.push({ situation: baiter ? 'demand.bait' : 'demand.agree', params: { demand: kind } });
    if (baiter) {
      // Köder: liest eine wertlose Nummer vor (gleiches Format, aber nirgends gültig).
      const fake = makeVariant(this.rng).loot[kind];
      lines.push({ situation: 'loot.bait' });
      this.recordLoot({ kind, value: fake, schemeId: sch?.id ?? null, heard: fake, bait: true });
      return lines;
    }
    const value = this.variant.loot[kind];
    if (kind === 'klick' || kind === 'daten') {
      lines.push({ situation: `loot.${kind}`, params: { loot: value } });
      this.recordLoot({ kind, value, schemeId: sch?.id ?? null, heard: value });
      return lines;
    }
    const d = this.dictate(kind, value);
    lines.push(...d.lines);
    this.recordLoot({ kind, value, schemeId: sch?.id ?? null, heard: d.heard, ...(kind === 'gutschein' ? { amount: this.variant.gutscheinAmount } : {}) });
    return lines;
  }

  private recordLoot(loot: Loot): void {
    this.loots.push(loot);
    this.newLoot = loot;
  }

  /** Ziffer für Ziffer vorlesen, mit Versprechern und Korrekturen (CAL-15). */
  private dictate(kind: DemandKind, value: string): { lines: LineRef[]; heard: string } {
    const careful = this.has('careful');
    const chance = careful ? 0 : TUNING.calls.slipChance * (this.has('sleepy') || this.has('chatty') ? 1.6 : 1);
    const lines: LineRef[] = [{ situation: 'dictate.start' }];
    const heard: string[] = [];
    let slips = 0;
    for (const group of value.split(/[\s-]+/).filter(Boolean)) {
      const chunk = spaced(group);
      if (slips < TUNING.calls.maxSlips && this.rng.chance(chance)) {
        const wrong = mutate(group, this.rng);
        slips++;
        lines.push({ situation: 'dictate.slip', params: { wrong: spaced(wrong), chunk } });
        heard.push(`${wrong} (${group})`);
      } else {
        lines.push({ situation: 'dictate.chunk', params: { chunk } });
        heard.push(group);
      }
    }
    if (kind === 'gutschein') lines.push({ situation: 'dictate.amount', params: { amount: this.variant.gutscheinAmount } });
    // Sorgfältige Anrufer wiederholen alles noch einmal am Stück.
    if (careful && kind !== 'geld') lines.push({ situation: `loot.${kind}`, params: { loot: value } });
    else lines.push({ situation: 'dictate.end' });
    return { lines, heard: heard.join(' ') };
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
    this.end(this.lootOutcome() ?? 'hangup');
    return this.reply(lines, delta, false);
  }

  private end(outcome: Outcome): void {
    this.state = 'ended';
    this.phase = 'ende';
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
    if (this.newLoot) r.loot = this.newLoot;
    this.newLoot = null;
    if (this.learned.likes.length > 0 || this.learned.dislikes.length > 0) r.learned = this.learned;
    this.learned = { likes: [], dislikes: [] };
    return r;
  }
}

/** „SV“ → „S V“, „4821“ → „4 8 2 1“ (zum Vorlesen Zeichen für Zeichen). */
function spaced(group: string): string {
  return group.split('').join(' ');
}

/** Ein Zeichen falsch lesen (Ziffer ±1, Buchstabe daneben) – für Versprecher. */
function mutate(group: string, rng: Rng): string {
  const i = rng.int(0, group.length - 1);
  const ch = group[i]!;
  let w: string;
  if (/\d/.test(ch)) w = String((Number(ch) + (rng.chance(0.5) ? 1 : 9)) % 10);
  else {
    const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const j = L.indexOf(ch.toUpperCase());
    w = L[(Math.max(0, j) + (rng.chance(0.5) ? 1 : L.length - 1)) % L.length]!;
  }
  return group.slice(0, i) + w + group.slice(i + 1);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}


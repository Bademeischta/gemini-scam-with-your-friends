import { TUNING } from '../../config/tuning';
import type { Temperament } from './caller';
import { MOODS, type Mood } from './types';

/** Was in einem Gesprächsschritt passiert ist (Auslöser für Stimmungswechsel). */
export interface MoodSignals {
  dTrust: number;
  insult: number;
  threat: number;
  urgency: number;
  nonsense: number;
  laugh: number;
  compliment: number;
  empathy: number;
  calm: number;
  apology: number;
  like: number;
  dislike: number;
  repetition: number;
  contradiction: boolean;
  earlyDemand: boolean;
  shouting: boolean;
  /** Schweigen-Mahnung ausgelöst. */
  silence: boolean;
}

export const NO_SIGNALS: MoodSignals = {
  dTrust: 0, insult: 0, threat: 0, urgency: 0, nonsense: 0, laugh: 0, compliment: 0, empathy: 0, calm: 0, apology: 0, like: 0, dislike: 0, repetition: 0,
  contradiction: false, earlyDemand: false, shouting: false, silence: false,
};

/** Wirkung der Stimmung auf Vertrauensgewinne, -verluste und Geduld. */
export const MOOD_FX: Readonly<Record<Mood, { gain: number; loss: number; patience: number }>> = {
  vertrauensvoll: { gain: 1.15, loss: 0.9, patience: 0.8 },
  neutral: { gain: 1, loss: 1, patience: 1 },
  misstrauisch: { gain: 0.7, loss: 1.2, patience: 1.1 },
  verwirrt: { gain: 0.6, loss: 1, patience: 1.1 },
  amuesiert: { gain: 1.2, loss: 0.8, patience: 0.7 },
  genervt: { gain: 0.7, loss: 1.2, patience: 1.4 },
  wuetend: { gain: 0.4, loss: 1.4, patience: 1.6 },
  aengstlich: { gain: 0.9, loss: 1.1, patience: 1 },
  gelangweilt: { gain: 0.8, loss: 1, patience: 1.5 },
};

function zero(): Record<Mood, number> {
  return Object.fromEntries(MOODS.map((m) => [m, 0])) as Record<Mood, number>;
}

/**
 * Stimmung als Zustandsautomat mit Trägheit: Ereignisse bauen „Druck“ in Richtung einer Stimmung auf,
 * erst ab einer Schwelle (abhängig vom Temperament) kippt sie. Druck baut sich mit der Zeit ab;
 * ohne neuen Druck kehrt die Stimmung zu einer Grundstimmung zurück, die vom Vertrauen abhängt.
 * So kann jemand bei 65 % vertrauensvoll und ein anderer bei 50 % wütend sein.
 */
export class MoodState {
  mood: Mood;
  private readonly pressure = zero();
  /** Zeit seit dem letzten Wechsel (s). */
  private since = 0;

  constructor(
    start: Mood,
    private readonly t: Temperament,
  ) {
    this.mood = start;
    this.pressure[start] = 0.5;
  }

  /** Druck je Stimmung (für Tests und Gesprächsanalyse). */
  get pressures(): Readonly<Record<Mood, number>> {
    return this.pressure;
  }

  /** Ereignisse eines Gesprächsschritts einrechnen; liefert die neue Stimmung, falls sie kippt. */
  apply(s: MoodSignals, trust: number): Mood | null {
    const t = this.t;
    const p = this.pressure;
    const pos = Math.max(0, s.dTrust);
    const neg = Math.max(0, -s.dTrust);
    p.vertrauensvoll += pos / 10 + (s.compliment + s.empathy) * 0.25 + (trust > 65 ? 0.25 : 0);
    // Verluste durch Beleidigung oder Drohung machen wütend bzw. ängstlich, nicht misstrauisch.
    const hostile = s.insult + s.threat > 0;
    p.misstrauisch += ((s.contradiction ? 0.9 : 0) + (s.earlyDemand ? 0.8 : 0) + (hostile ? 0 : neg / 14)) * (0.5 + t.suspicion) + (trust < 25 && !hostile ? 0.2 : 0);
    p.verwirrt += s.nonsense * 0.9 * (1 - t.humor * 0.6);
    p.amuesiert += (s.laugh * 0.6 + s.nonsense * 0.7) * t.humor + s.like * 0.15;
    p.genervt += s.repetition * 0.6 + s.urgency * 0.3 * t.irritability + s.dislike * 0.35 + (s.shouting ? 0.4 : 0) + (s.silence ? 0.5 : 0);
    p.wuetend += (s.insult * 0.9 + s.threat * 0.35 + (s.shouting ? 0.3 : 0)) * t.irritability;
    p.aengstlich += (s.threat * 0.7 + s.urgency * 0.25) * t.fearfulness;
    p.gelangweilt += s.repetition * 0.4 + (s.silence ? 0.3 : 0);
    // Beruhigen und Entschuldigen bauen Ärger und Angst ab.
    const soothe = s.calm * 0.5 + s.apology * 0.7 + s.empathy * 0.3;
    if (soothe > 0) {
      p.wuetend *= Math.max(0, 1 - soothe);
      p.aengstlich *= Math.max(0, 1 - soothe);
      p.genervt *= Math.max(0, 1 - soothe * 0.7);
      if ((this.mood === 'wuetend' || this.mood === 'aengstlich' || this.mood === 'genervt') && soothe >= 0.7) return this.set(this.baseline(trust));
    }
    return this.pick(trust);
  }

  /** Zeit vergeht: Druck baut sich ab, ohne Druck zurück zur Grundstimmung. */
  decay(dt: number, trust: number): Mood | null {
    this.since += dt;
    const k = Math.exp(-TUNING.calls.moodDecay * dt);
    for (const m of MOODS) this.pressure[m] *= k;
    if (this.since > 8 && this.pressure[this.mood] < 0.15) {
      const base = this.baseline(trust);
      if (base !== this.mood) return this.set(base);
    }
    return null;
  }

  /** Stimmung von außen setzen (z. B. Wutausbruch bei Chanti). */
  force(m: Mood): Mood | null {
    return m === this.mood ? null : this.set(m);
  }

  private baseline(trust: number): Mood {
    if (trust >= 65) return 'vertrauensvoll';
    if (trust < 20) return 'misstrauisch';
    return 'neutral';
  }

  private pick(trust: number): Mood | null {
    let best: Mood = this.mood;
    let bestP = -Infinity;
    for (const m of MOODS) {
      if (m === this.mood || m === 'neutral') continue;
      if (this.pressure[m] > bestP) {
        bestP = this.pressure[m];
        best = m;
      }
    }
    const threshold = TUNING.calls.moodThreshold / this.t.volatility;
    if (best !== this.mood && bestP >= threshold && bestP > this.pressure[this.mood] + 0.2) return this.set(best);
    // Vertrauen hoch und keine starke Gegenkraft: vertrauensvoll.
    if (this.mood !== 'vertrauensvoll' && trust >= 70 && bestP < threshold * 0.6 && (this.mood === 'neutral' || this.mood === 'misstrauisch')) return this.set('vertrauensvoll');
    return null;
  }

  private set(m: Mood): Mood {
    this.mood = m;
    this.since = 0;
    this.pressure[m] = Math.max(this.pressure[m], 0.5);
    return m;
  }
}

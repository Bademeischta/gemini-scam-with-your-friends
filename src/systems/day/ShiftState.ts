import { TUNING } from '../../config/tuning';
import { quotaFor } from './quota';

/**
 * Zustand eines Arbeitstags: Tag, persönliches Guthaben, Team-Summe, Quota und Countdown
 * bis zur Leistungsbewertung. Wird im festen Logik-Takt fortgeschrieben (nur wenn nicht pausiert).
 * Bewertung, Ausstempeln und Rauswurf kommen mit M5 hinzu.
 */
export class ShiftState {
  day: number;
  teamSize: number;
  /** Persönliches Guthaben (bleibt über die Tage eines Runs erhalten). */
  personal: number;
  /** Heute vom Team verdient (zählt zur Quota). */
  team = 0;
  quota: number;
  readonly dayLength: number;
  timeLeft: number;

  constructor(opts: { day?: number; teamSize?: number; personal?: number; dayLength?: number } = {}) {
    this.day = opts.day ?? 1;
    this.teamSize = opts.teamSize ?? 1;
    this.personal = opts.personal ?? 0;
    this.dayLength = opts.dayLength ?? TUNING.day.lengthSeconds;
    this.timeLeft = this.dayLength;
    this.quota = quotaFor(this.day, this.teamSize);
  }

  tick(dt: number): void {
    if (dt > 0) this.timeLeft = Math.max(0, this.timeLeft - dt);
  }

  /** Einnahme: zählt zum eigenen Geld und zur Team-Summe. */
  earn(amount: number): void {
    if (!(amount > 0)) return;
    this.personal += amount;
    this.team += amount;
  }

  /** Ausgabe vom persönlichen Guthaben (Team-Summe bleibt unberührt). */
  spend(amount: number): boolean {
    if (!(amount > 0) || amount > this.personal) return false;
    this.personal -= amount;
    return true;
  }

  get quotaReached(): boolean {
    return this.team >= this.quota;
  }

  get progress(): number {
    return this.quota > 0 ? Math.min(1, this.team / this.quota) : 1;
  }

  get timeUp(): boolean {
    return this.timeLeft <= 0;
  }

  /** Countdown als „m:ss“. */
  get countdownText(): string {
    const s = Math.ceil(this.timeLeft);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
}

import { TUNING } from '../../config/tuning';
import type { Rng } from '../rng/rng';

/** Bühne der Bewertung in Art-Pixeln (Chef oben, Team unten auf dem Teppich). */
export const STAGE = { w: 240, h: 135, bossY: 34, playerY: 118, margin: 14 } as const;

export interface Stapler {
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
}

/**
 * Fliegende Tacker während der Leistungsbewertung (DAY-11): Brülling wirft Tacker in Richtung des
 * Teams, man weicht seitlich aus. Treffer = kurz k.o. (Sternchen), wird gezählt
 * („verschluckte Tacker“). Der Tacker-Helm aus dem Ramschazon (M6) schützt.
 */
export class StaplerGame {
  readonly staplers: Stapler[] = [];
  playerX: number = STAGE.w / 2;
  ko = 0;
  hits = 0;
  time = 0;
  bossX: number = STAGE.w / 2;
  private next = 0.6;

  constructor(
    private readonly rng: Rng,
    private readonly helmet = false,
  ) {}

  /** Wirft der Chef noch? */
  get throwing(): boolean {
    return this.time < TUNING.review.staplerSeconds;
  }

  get done(): boolean {
    return !this.throwing && this.staplers.length === 0;
  }

  /** `move` −1 … 1 (links/rechts). */
  tick(dt: number, move: number): { hit: boolean; thrown: boolean } {
    const r = TUNING.review;
    this.time += dt;
    let thrown = false;
    let hit = false;
    if (this.ko > 0) this.ko = Math.max(0, this.ko - dt);
    else this.playerX = Math.max(STAGE.margin, Math.min(STAGE.w - STAGE.margin, this.playerX + move * r.playerSpeed * dt));
    // Der Chef tänzelt hin und her und zielt dorthin, wo man gerade steht (mit Streuung).
    this.bossX = STAGE.w / 2 + Math.sin(this.time * 1.7) * 40;
    if (this.throwing) {
      this.next -= dt;
      if (this.next <= 0) {
        this.next = this.rng.range(r.staplerEvery[0], r.staplerEvery[1]);
        const tx = this.playerX + this.rng.range(-18, 18);
        const dx = tx - this.bossX;
        const dy = STAGE.playerY - STAGE.bossY;
        const len = Math.hypot(dx, dy);
        this.staplers.push({ x: this.bossX, y: STAGE.bossY, vx: (dx / len) * r.staplerSpeed, vy: (dy / len) * r.staplerSpeed, spin: 0 });
        thrown = true;
      }
    }
    for (let i = this.staplers.length - 1; i >= 0; i--) {
      const s = this.staplers[i]!;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.spin += dt * 14;
      const hitsPlayer = this.ko === 0 && Math.abs(s.x - this.playerX) < 8 && Math.abs(s.y - (STAGE.playerY - 10)) < 10;
      if (hitsPlayer) {
        this.staplers.splice(i, 1);
        if (!this.helmet) {
          this.ko = r.koSeconds;
          this.hits++;
          hit = true;
        }
        continue;
      }
      if (s.y > STAGE.h + 8 || s.x < -8 || s.x > STAGE.w + 8) this.staplers.splice(i, 1);
    }
    return { hit, thrown };
  }
}

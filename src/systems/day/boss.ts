import { TUNING } from '../../config/tuning';
import type { Rng } from '../rng/rng';

export interface Point {
  x: number;
  y: number;
}

export type BossState = 'office' | 'patrol' | 'yell';

export type BossEvent =
  | { type: 'patrolStart' }
  | { type: 'patrolEnd' }
  | { type: 'yell' }
  /** Faulenzer erwischt: Standpauke und Strafgeld (DAY-13). */
  | { type: 'catch'; fine: number };

export interface BossInput {
  /** Spieler sitzt am Platz (arbeitet). */
  seated: boolean;
  /** Spielerposition (Füße, Art-Pixel). */
  player: Point;
  /** Anteil der Quota erreicht (0–1) und Anteil des Tages vergangen (0–1). */
  progress: number;
  elapsed: number;
}

/**
 * Direktor Brülling (DAY-12/13), ohne Phaser: Wut-Anzeige, Kontrollgänge auf fester Route,
 * Brüllanfälle und das Erwischen von Faulenzern. Die Büro-Szene zeichnet nur, was hier steht.
 */
export class BossBrain {
  rage = 10;
  state: BossState = 'office';
  readonly pos: Point;
  /** Laufrichtung (für die Figur). */
  dir: Point = { x: 0, y: 1 };
  moving = false;
  /** Wie lange der Spieler schon nicht am Platz ist. */
  slack = 0;
  yells = 0;
  catches = 0;
  private route = 0;
  private timer: number;
  private yellLeft = 0;
  private resumeState: BossState = 'office';
  private catchCooldown = 0;
  private walked = 0;

  constructor(
    private readonly rng: Rng,
    private readonly day: number,
    private readonly path: readonly Point[],
    private readonly seat: Point,
  ) {
    this.pos = { ...seat };
    this.timer = this.nextPatrol();
  }

  /** Nächsten Kontrollgang in … s beginnen (Tests, Tutorial). */
  patrolIn(seconds: number): void {
    if (this.state === 'office') this.timer = seconds;
  }

  get angry(): boolean {
    return this.rage >= TUNING.boss.angryAt;
  }

  /** Zurückgelegte Strecke (für die Lauf-Animation). */
  get distance(): number {
    return this.walked;
  }

  /** Ergebnis eines Anrufs: Erfolg beruhigt, Fehlschlag ärgert. */
  onCallEnded(success: boolean): void {
    this.addRage(success ? TUNING.boss.rageSuccess : TUNING.boss.rageFail);
  }

  onMissed(): void {
    this.addRage(TUNING.boss.rageMissed);
  }

  tick(dt: number, input: BossInput): BossEvent[] {
    const b = TUNING.boss;
    const events: BossEvent[] = [];
    // Faulenzen zählt nur außerhalb des Platzes.
    this.slack = input.seated ? 0 : this.slack + dt;
    this.catchCooldown = Math.max(0, this.catchCooldown - dt);

    // Wut: kühlt ab, steigt aber, solange das Team hinter dem Zeitplan liegt.
    if (input.progress < input.elapsed - b.behindMargin) this.addRage(b.rageBehindPerSecond * dt);
    else this.addRage(-b.rageDecay * dt);

    if (this.state === 'yell') {
      this.moving = false;
      this.yellLeft -= dt;
      if (this.yellLeft <= 0) this.state = this.resumeState;
      return events;
    }
    if (this.rage >= b.yellAt) {
      this.resumeState = this.state;
      this.state = 'yell';
      this.yellLeft = b.yellSeconds;
      this.yells++;
      this.addRage(-b.yellDrop);
      events.push({ type: 'yell' });
      return events;
    }

    if (this.state === 'office') {
      this.moving = false;
      this.timer -= dt;
      if (this.timer <= 0) {
        this.state = 'patrol';
        this.route = 0;
        events.push({ type: 'patrolStart' });
      }
      return events;
    }

    // Kontrollgang: Wegpunkt für Wegpunkt.
    this.walk(dt);
    if (this.route >= this.path.length) {
      this.state = 'office';
      this.route = 0;
      this.pos.x = this.seat.x;
      this.pos.y = this.seat.y;
      this.dir = { x: 0, y: 1 };
      this.moving = false;
      this.timer = this.nextPatrol();
      events.push({ type: 'patrolEnd' });
      return events;
    }
    const near = Math.hypot(input.player.x - this.pos.x, input.player.y - this.pos.y) <= b.catchRadiusTiles * 16;
    if (near && this.slack >= b.slackSeconds && this.catchCooldown <= 0) {
      this.catches++;
      this.slack = 0;
      this.catchCooldown = 20;
      this.addRage(b.rageCatch);
      events.push({ type: 'catch', fine: b.fineBase + b.finePerDay * (this.day - 1) });
    }
    return events;
  }

  private walk(dt: number): void {
    let budget = TUNING.boss.walkSpeedTiles * 16 * dt;
    this.moving = true;
    while (budget > 0 && this.route < this.path.length) {
      const target = this.path[this.route]!;
      const dx = target.x - this.pos.x;
      const dy = target.y - this.pos.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.01) {
        this.route++;
        continue;
      }
      this.dir = { x: dx / dist, y: dy / dist };
      const step = Math.min(budget, dist);
      this.pos.x += this.dir.x * step;
      this.pos.y += this.dir.y * step;
      this.walked += step;
      budget -= step;
      if (step >= dist) this.route++;
    }
  }

  private nextPatrol(): number {
    const [lo, hi] = this.angry ? TUNING.boss.patrolEveryAngry : TUNING.boss.patrolEvery;
    return this.rng.range(lo, hi);
  }

  private addRage(d: number): void {
    this.rage = Math.max(0, Math.min(100, this.rage + d));
  }
}

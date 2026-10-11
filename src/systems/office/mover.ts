import type { Facing } from '../../gfx/characters';
import type { CollisionWorld } from './collision';

/**
 * Bewegung einer Figur im Büro (Spieler, später Bots, Chef, Polizei):
 * Beschleunigen und Abbremsen auf Zielgeschwindigkeit, Kollision, Blickrichtung.
 * Wird im festen Logik-Takt aufgerufen.
 */
export interface MoverState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: Facing;
  /** Zurückgelegte Strecke (für die Lauf-Animation). */
  distance: number;
}

export interface MoverParams {
  /** Höchstgeschwindigkeit in Art-Pixeln pro Sekunde. */
  speed: number;
  accelTime: number;
  decelTime: number;
  hitbox: { w: number; h: number };
}

export function createMover(x: number, y: number, facing: Facing = 'up'): MoverState {
  return { x, y, vx: 0, vy: 0, facing, distance: 0 };
}

/** Blickrichtung aus einer Eingaberichtung (dominante Achse). */
export function facingFrom(x: number, y: number, fallback: Facing): Facing {
  if (Math.abs(x) < 0.2 && Math.abs(y) < 0.2) return fallback;
  if (Math.abs(x) > Math.abs(y)) return x > 0 ? 'right' : 'left';
  return y > 0 ? 'down' : 'up';
}

export function stepMover(s: MoverState, input: { x: number; y: number }, dt: number, p: MoverParams, world: CollisionWorld): void {
  const len = Math.hypot(input.x, input.y);
  const ix = len > 1 ? input.x / len : input.x;
  const iy = len > 1 ? input.y / len : input.y;
  const tx = ix * p.speed;
  const ty = iy * p.speed;
  const accel = (p.speed / Math.max(1e-4, p.accelTime)) * dt;
  const decel = (p.speed / Math.max(1e-4, p.decelTime)) * dt;
  // Geschwindigkeit als Vektor auf das Ziel zuführen (diagonal also nicht schneller):
  // Beschleunigen in Eingaberichtung, Abbremsen ohne Eingabe, beim Umkehren beides zusammen.
  const idle = tx === 0 && ty === 0;
  const reversing = s.vx * tx + s.vy * ty < 0;
  const rate = idle ? decel : reversing ? decel + accel : accel;
  const dvx = tx - s.vx;
  const dvy = ty - s.vy;
  const dist = Math.hypot(dvx, dvy);
  if (dist <= rate) {
    s.vx = tx;
    s.vy = ty;
  } else {
    s.vx += (dvx / dist) * rate;
    s.vy += (dvy / dist) * rate;
  }
  s.facing = facingFrom(ix, iy, s.facing);
  if (s.vx === 0 && s.vy === 0) return;
  const before = { x: s.x, y: s.y };
  const r = world.move(s, p.hitbox, s.vx * dt, s.vy * dt);
  s.x = r.x;
  s.y = r.y;
  if (r.hitX) s.vx = 0;
  if (r.hitY) s.vy = 0;
  s.distance += Math.hypot(s.x - before.x, s.y - before.y);
}

export function speedOf(s: MoverState): number {
  return Math.hypot(s.vx, s.vy);
}

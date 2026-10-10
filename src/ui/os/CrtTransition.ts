import type Phaser from 'phaser';
import { hex } from '../../config/palette';

/**
 * Röhrenmonitor-Effekt beim Hinsetzen (an) und Aufstehen (aus): Ein heller Strich springt auf
 * und öffnet sich zum Bild bzw. das Bild fällt zu einem Strich und einem Punkt zusammen.
 */
export class CrtTransition {
  private readonly g: Phaser.GameObjects.Graphics;
  private t = 0;
  private mode: 'on' | 'off' | null = null;
  private done: (() => void) | null = null;

  constructor(
    scene: Phaser.Scene,
    depth: number,
    private readonly duration: number,
  ) {
    this.g = scene.add.graphics().setDepth(depth);
  }

  get running(): boolean {
    return this.mode !== null;
  }

  play(mode: 'on' | 'off', done?: () => void): void {
    this.mode = mode;
    this.t = 0;
    this.done = done ?? null;
  }

  /** Fortschritt zeichnen; `w`/`h` = Bildschirmgröße in physischen Pixeln. */
  update(dt: number, w: number, h: number): void {
    const g = this.g;
    if (!this.mode) return;
    g.clear();
    this.t += dt;
    const p = Math.min(1, this.t / this.duration);
    // „an“ läuft vorwärts, „aus“ rückwärts durch dieselben Phasen.
    const k = this.mode === 'on' ? p : 1 - p;
    const line = Math.max(2, Math.round(h * 0.006));
    if (k < 0.35) {
      // Phase 1: Schwarz mit wachsendem bzw. schrumpfendem Leuchtstrich.
      const lw = Math.round(w * (k / 0.35));
      g.fillStyle(hex('ink0'), 1).fillRect(0, 0, w, h);
      g.fillStyle(hex('white'), 1).fillRect(Math.round(w / 2 - lw / 2), Math.round(h / 2 - line / 2), Math.max(line, lw), line);
    } else {
      // Phase 2: Der Spalt öffnet sich von der Mitte zum ganzen Bild.
      const open = (k - 0.35) / 0.65;
      const gap = Math.round(h * open * open);
      const shutter = Math.round((h - gap) / 2);
      g.fillStyle(hex('ink0'), 1).fillRect(0, 0, w, shutter).fillRect(0, h - shutter, w, shutter);
      g.fillStyle(hex('white'), Math.max(0, 0.5 - open)).fillRect(0, shutter, w, Math.max(line, gap));
    }
    if (p >= 1) {
      const fn = this.done;
      // Nach „aus“ bleibt es schwarz, bis die Szene endet (kein Aufblitzen des Desktops).
      if (this.mode === 'on') g.clear();
      this.mode = null;
      this.done = null;
      fn?.();
    }
  }

  destroy(): void {
    this.g.destroy();
  }
}

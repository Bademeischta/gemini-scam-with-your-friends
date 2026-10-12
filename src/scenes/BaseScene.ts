import Phaser from 'phaser';
import { TUNING } from '../config/tuning';
import { services, type Services } from '../core/services';
import { FixedStepClock } from '../systems/time/FixedStepClock';
import type { ViewportState } from '../systems/viewport/viewportMath';

/**
 * Grundlage aller Szenen:
 * - `build()` baut die Szene einmalig auf, `layout(vp)` positioniert alles (auch nach Resize/Drehung).
 * - `fixedUpdate(dt)` läuft im festen Logik-Takt, `frameUpdate(dt, alpha)` einmal pro Bild.
 * - Szenen mit `pausable = true` frieren ihre Logik ein, solange das Spiel pausiert ist.
 */
export abstract class BaseScene extends Phaser.Scene {
  protected readonly pausable: boolean = false;
  protected vp!: ViewportState;
  private clock = new FixedStepClock(TUNING.loop.fixedHz, TUNING.loop.maxStepsPerFrame, TUNING.loop.maxFrameDelta);

  protected get s(): Services {
    return services();
  }

  create(data?: unknown): void {
    this.clock = new FixedStepClock(TUNING.loop.fixedHz, TUNING.loop.maxStepsPerFrame, TUNING.loop.maxFrameDelta);
    this.vp = this.s.viewport.state;
    const off = this.s.viewport.onChange((v) => {
      this.vp = v;
      this.layout(v);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
    this.build(data);
    this.layout(this.vp);
  }

  override update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, TUNING.loop.maxFrameDelta);
    if (this.pausable && this.s.pause.paused) {
      this.clock.reset();
      this.frameUpdate(dt, 0);
      return;
    }
    this.clock.advance(dt, (step) => this.fixedUpdate(step));
    this.frameUpdate(dt, this.clock.alpha);
  }

  protected abstract build(data?: unknown): void;
  protected abstract layout(vp: ViewportState): void;
  protected fixedUpdate(_dt: number): void {}
  protected frameUpdate(_dt: number, _alpha: number): void {}
}

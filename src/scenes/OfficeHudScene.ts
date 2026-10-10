import Phaser from 'phaser';
import type { ViewportState } from '../systems/viewport/viewportMath';
import { TouchControls, type ContextIcon } from '../ui/touch/TouchControls';
import { BaseScene } from './BaseScene';

/**
 * Bildschirm-Ebene über dem Büro (eigene Kamera ohne Zoom): Touch-Steuerung,
 * ab M5 auch Quota, Countdown und Geld.
 */
export class OfficeHudScene extends BaseScene {
  private controls!: TouchControls;

  constructor() {
    super('OfficeHud');
  }

  protected build(): void {
    this.controls = new TouchControls(this, this.s);
    this.controls.onPause = () => this.events.emit('pause-request');
    this.controls.setVisible(this.s.device.hintMode === 'touch');
    const off = this.s.device.onChange((mode) => this.controls.setVisible(mode === 'touch'));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      off();
      this.controls.destroy();
    });
  }

  protected layout(vp: ViewportState): void {
    this.cameras.main.setSize(vp.width, vp.height);
    this.controls.layout(vp);
    this.registry.set('touchRects', this.controls.rects(vp.dpr));
  }

  setContext(ctx: ContextIcon, label: string): void {
    this.controls?.setContext(ctx, label);
  }
}

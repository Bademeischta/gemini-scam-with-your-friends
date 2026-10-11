import Phaser from 'phaser';
import { buildRingArrow } from '../gfx/callArt';
import { gridTexture } from '../gfx/phaserTextures';
import { pixelScale, safeRect, type ViewportState } from '../systems/viewport/viewportMath';
import { TouchControls, type ContextIcon } from '../ui/touch/TouchControls';
import { BaseScene } from './BaseScene';

/**
 * Bildschirm-Ebene über dem Büro (eigene Kamera ohne Zoom): Touch-Steuerung,
 * ab M5 auch Quota, Countdown und Geld.
 */
export class OfficeHudScene extends BaseScene {
  private controls!: TouchControls;
  /** Pfeile zu klingelnden Telefonen außerhalb des Bildes (HUD-04). */
  private arrows: Phaser.GameObjects.Image[] = [];
  private arrowTime = 0;

  constructor() {
    super('OfficeHud');
  }

  protected build(): void {
    gridTexture(this, 'ring-arrow', buildRingArrow);
    this.arrows = [];
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

  /**
   * Klingelnde Telefone in Bildschirm-Koordinaten (physische Pixel). Liegt eines außerhalb des
   * sichtbaren Bereichs, zeigt ein pulsierender Pfeil am Rand in seine Richtung.
   */
  setRingTargets(targets: readonly { x: number; y: number; desk: number }[]): void {
    if (!this.sys.isActive() || !this.vp) return;
    const vp = this.vp;
    const margin = Math.round(28 * vp.dpr);
    const safe = safeRect(vp, margin);
    const scale = Math.round(pixelScale(vp, 2) * 1.5);
    this.arrowTime += 1 / 60;
    let used = 0;
    for (const t of targets) {
      const inside = t.x >= safe.x && t.x <= safe.x + safe.width && t.y >= safe.y && t.y <= safe.y + safe.height;
      if (inside) continue;
      const cx = vp.width / 2;
      const cy = vp.height / 2;
      const angle = Math.atan2(t.y - cy, t.x - cx);
      // Schnittpunkt der Richtung mit dem sicheren Rand.
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      const kx = dx !== 0 ? (dx > 0 ? safe.x + safe.width - cx : safe.x - cx) / dx : Infinity;
      const ky = dy !== 0 ? (dy > 0 ? safe.y + safe.height - cy : safe.y - cy) / dy : Infinity;
      const k = Math.min(kx, ky);
      let a = this.arrows[used];
      if (!a) {
        a = this.add.image(0, 0, 'ring-arrow').setDepth(50);
        this.arrows.push(a);
      }
      const pulse = 1 + Math.sin(this.arrowTime * 8) * 0.12;
      a.setVisible(true).setRotation(angle).setScale(scale * pulse).setPosition(Math.round(cx + dx * k), Math.round(cy + dy * k));
      used++;
    }
    for (let i = used; i < this.arrows.length; i++) this.arrows[i]!.setVisible(false);
    this.registry.set('ringArrows', used);
  }
}

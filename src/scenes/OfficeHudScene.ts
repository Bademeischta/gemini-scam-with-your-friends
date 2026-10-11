import Phaser from 'phaser';
import { hex } from '../config/palette';
import { TUNING } from '../config/tuning';
import { currentRun, hasRun } from '../core/run';
import { buildRingArrow } from '../gfx/callArt';
import { i18n, t } from '../i18n';
import { PixelLabel } from '../ui/PixelLabel';
import { gridTexture } from '../gfx/phaserTextures';
import { pixelScale, safeRect, type ViewportState } from '../systems/viewport/viewportMath';
import { TouchControls, type ContextIcon } from '../ui/touch/TouchControls';
import { BaseScene } from './BaseScene';

/**
 * Bildschirm-Ebene über dem Büro (eigene Kamera ohne Zoom): Touch-Steuerung und das Büro-HUD
 * (HUD-01): Tag, Countdown, eigenes Geld, Mini-Quota-Balken, Laune des Chefs.
 */
export class OfficeHudScene extends BaseScene {
  private controls!: TouchControls;
  /** Pfeile zu klingelnden Telefonen außerhalb des Bildes (HUD-04). */
  private arrows: Phaser.GameObjects.Image[] = [];
  private arrowTime = 0;
  private hudBg!: Phaser.GameObjects.Graphics;
  private dayLabel!: PixelLabel;
  private clockLabel!: PixelLabel;
  private moneyLabel!: PixelLabel;
  private teamLabel!: PixelLabel;
  private rageLabel!: PixelLabel;
  private hintLabel!: PixelLabel;
  private hudRect = { x: 0, y: 0, w: 0, h: 0 };
  private barRect = { x: 0, y: 0, w: 0, h: 0 };
  private rageRect = { x: 0, y: 0, w: 0, h: 0 };
  private blink = 0;

  constructor() {
    super('OfficeHud');
  }

  protected build(): void {
    gridTexture(this, 'ring-arrow', buildRingArrow);
    this.arrows = [];
    this.controls = new TouchControls(this, this.s);
    this.controls.onPause = () => this.events.emit('pause-request');
    this.controls.setVisible(this.s.device.hintMode === 'touch');
    this.hudBg = this.add.graphics().setDepth(40);
    const label = (color: 'white' | 'fog' | 'mustard' | 'mint'): PixelLabel => new PixelLabel(this, '', { scale: 2, color, shadow: 'ink0', depth: 41 });
    this.dayLabel = label('mustard');
    this.clockLabel = label('white');
    this.moneyLabel = label('white');
    this.teamLabel = label('fog');
    this.rageLabel = label('fog');
    this.hintLabel = label('mint');
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
    // HUD oben links (oben rechts liegt der Pause-Knopf für Touch).
    const u = pixelScale(vp, TUNING.display.uiArtScale);
    const safe = safeRect(vp, Math.round(8 * vp.dpr));
    const w = Math.min(Math.round(safe.width * 0.6), 150 * u);
    this.hudRect = { x: safe.x, y: safe.y, w, h: 33 * u };
    for (const l of [this.dayLabel, this.clockLabel, this.moneyLabel, this.teamLabel, this.rageLabel, this.hintLabel]) l.setScale(u);
    const x = safe.x + 4 * u;
    this.dayLabel.setPosition(x, safe.y + 3 * u);
    this.clockLabel.setOrigin(0.5, 0).setPosition(safe.x + w / 2, safe.y + 3 * u);
    this.moneyLabel.setOrigin(1, 0).setPosition(safe.x + w - 4 * u, safe.y + 3 * u);
    this.barRect = { x, y: safe.y + 12 * u, w: w - 8 * u, h: 5 * u };
    this.teamLabel.setPosition(x, safe.y + 19 * u);
    this.rageLabel.setOrigin(1, 0).setPosition(safe.x + w - 4 * u - 26 * u, safe.y + 19 * u);
    this.rageRect = { x: safe.x + w - 4 * u - 24 * u, y: safe.y + 20 * u, w: 24 * u, h: 4 * u };
    this.hintLabel.setPosition(safe.x, safe.y + this.hudRect.h + 3 * u);
  }

  protected override frameUpdate(dt: number): void {
    if (!hasRun() || this.hudRect.w === 0) return;
    const run = currentRun();
    const s = run.shift;
    const u = pixelScale(this.vp, TUNING.display.uiArtScale);
    this.blink = (this.blink + dt) % 1;
    this.dayLabel.setText(t('hud.day', { day: s.day }));
    const urgent = s.timeLeft <= TUNING.os.countdownWarnSeconds;
    this.clockLabel.setText(s.countdownText).setColor(urgent && this.blink < 0.5 ? 'red' : 'white');
    this.moneyLabel.setText(i18n.formatMoney(s.personal));
    this.teamLabel.setText(t('os.taskbar.teamShort', { team: i18n.formatMoney(s.team), quota: i18n.formatMoney(s.quota) }));
    this.rageLabel.setText(t('hud.rage'));
    this.hintLabel.setText(t('hud.clockOut')).setVisible(s.quotaReached && !run.clockedOut && this.blink < 0.7);
    const g = this.hudBg.clear();
    const r = this.hudRect;
    g.fillStyle(hex('ink0'), 0.72).fillRect(r.x, r.y, r.w, r.h);
    const b = this.barRect;
    g.fillStyle(hex('ink1'), 1).fillRect(b.x, b.y, b.w, b.h);
    g.fillStyle(hex(s.quotaReached ? 'mint' : 'mustard'), 1).fillRect(b.x + u, b.y + u, Math.round((b.w - 2 * u) * s.progress), b.h - 2 * u);
    const rg = this.rageRect;
    const rage = run.boss.rage / 100;
    g.fillStyle(hex('ink1'), 1).fillRect(rg.x, rg.y, rg.w, rg.h);
    g.fillStyle(hex(run.boss.angry ? 'red' : rage > 0.35 ? 'amber' : 'sky'), 1).fillRect(rg.x + u, rg.y + u, Math.round((rg.w - 2 * u) * rage), rg.h - 2 * u);
    this.registry.set('hud', { day: s.day, countdown: s.countdownText, money: s.personal, team: s.team, quota: s.quota, rage: Math.round(run.boss.rage), clockHint: this.hintLabel.main.visible || (s.quotaReached && !run.clockedOut) });
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

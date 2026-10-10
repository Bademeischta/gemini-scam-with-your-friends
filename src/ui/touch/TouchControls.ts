import Phaser from 'phaser';
import { TUNING } from '../../config/tuning';
import type { Services } from '../../core/services';
import { gridTexture } from '../../gfx/phaserTextures';
import { pixelScale, safeRect, type ViewportState } from '../../systems/viewport/viewportMath';
import { PixelLabel } from '../PixelLabel';
import { actionButton, icon, joystickKnob, joystickRing, smallButton, type IconName } from './touchArt';

export type ContextIcon = 'sit' | 'stand' | 'none';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Touch-Steuerung im Büro: schwebender Joystick (linke Bildschirmhälfte), Kontext-Button
 * (Hinsetzen, Aufstehen …) und Pause-Button. Daumengroß, halbtransparent, passt sich an
 * Hoch- und Querformat an. Ab M11 sind die Positionen im Layout-Editor verschiebbar.
 */
export class TouchControls {
  private readonly ring: Phaser.GameObjects.Image;
  private readonly knob: Phaser.GameObjects.Image;
  private readonly action: Phaser.GameObjects.Image;
  private readonly actionIcon: Phaser.GameObjects.Image;
  private readonly actionLabel: PixelLabel;
  private readonly pauseBtn: Phaser.GameObjects.Image;
  private readonly pauseIcon: Phaser.GameObjects.Image;
  private visible = true;
  private context: ContextIcon = 'none';
  private stickPointer: number | null = null;
  private actionPointer: number | null = null;
  private stickBase = { x: 0, y: 0 };
  private stickRest = { x: 0, y: 0 };
  private stickRadius = 0;
  private stickZone: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private actionRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private pauseRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private actionScale = 1;
  onPause: () => void = () => undefined;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly s: Services,
  ) {
    gridTexture(scene, 'touch-ring', joystickRing);
    gridTexture(scene, 'touch-knob', joystickKnob);
    gridTexture(scene, 'touch-btn', () => actionButton(false));
    gridTexture(scene, 'touch-btn-down', () => actionButton(true));
    gridTexture(scene, 'touch-small', smallButton);
    for (const name of ['sit', 'stand', 'hand', 'pause'] as IconName[]) gridTexture(scene, `icon-${name}`, () => icon(name));

    const alpha = TUNING.touch.opacity;
    this.ring = scene.add.image(0, 0, 'touch-ring').setAlpha(alpha * 0.6).setDepth(100);
    this.knob = scene.add.image(0, 0, 'touch-knob').setAlpha(alpha).setDepth(101);
    this.action = scene.add.image(0, 0, 'touch-btn').setAlpha(alpha).setDepth(100);
    this.actionIcon = scene.add.image(0, 0, 'icon-hand').setAlpha(alpha + 0.2).setDepth(101);
    this.actionLabel = new PixelLabel(scene, '', { scale: 2, color: 'white', shadow: 'ink0', originX: 0.5, originY: 0, depth: 101 });
    this.pauseBtn = scene.add.image(0, 0, 'touch-small').setAlpha(alpha).setDepth(100);
    this.pauseIcon = scene.add.image(0, 0, 'icon-pause').setAlpha(alpha + 0.2).setDepth(101);

    const input = scene.input;
    input.addPointer(3);
    input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
    input.on(Phaser.Input.Events.GAME_OUT, () => this.releaseAll());
  }

  /** Bildschirm-Rechtecke in CSS-Pixeln (für Tests). */
  rects(dpr: number): { stickZone: Rect; stickRest: { x: number; y: number }; action: Rect; pause: Rect } {
    const css = (r: Rect): Rect => ({ x: r.x / dpr, y: r.y / dpr, w: r.w / dpr, h: r.h / dpr });
    return {
      stickZone: css(this.stickZone),
      stickRest: { x: this.stickRest.x / dpr, y: this.stickRest.y / dpr },
      action: css(this.actionRect),
      pause: css(this.pauseRect),
    };
  }

  setVisible(on: boolean): void {
    if (this.visible === on) return;
    this.visible = on;
    if (!on) this.releaseAll();
    for (const o of [this.ring, this.knob, this.action, this.actionIcon, this.pauseBtn, this.pauseIcon]) o.setVisible(on);
    this.actionLabel.setVisible(on && this.context !== 'none');
  }

  setContext(ctx: ContextIcon, label: string): void {
    if (ctx !== this.context) {
      this.context = ctx;
      this.actionIcon.setTexture(ctx === 'none' ? 'icon-hand' : `icon-${ctx}`);
      this.action.setAlpha(ctx === 'none' ? TUNING.touch.opacity * 0.5 : TUNING.touch.opacity);
    }
    this.actionLabel.setText(label).setVisible(this.visible && ctx !== 'none');
  }

  layout(vp: ViewportState): void {
    const margin = Math.round(TUNING.ui.edgeMargin * vp.dpr);
    const safe = safeRect(vp, margin);
    const ringScale = Math.max(1, Math.round((TUNING.touch.joystickRadius * 2 * vp.dpr) / 32));
    this.stickRadius = 16 * ringScale * 0.8;
    this.ring.setScale(ringScale);
    this.knob.setScale(ringScale);
    // Ruheposition des Joysticks unten links (Daumen).
    this.stickRest = { x: Math.round(safe.x + 16 * ringScale), y: Math.round(safe.y + safe.height - 16 * ringScale) };
    // Joystick-Zone: linke 55 % unterhalb der oberen Leiste.
    const top = safe.y + Math.round(TUNING.touch.smallButton * vp.dpr) + margin;
    this.stickZone = { x: 0, y: top, w: Math.round(vp.width * 0.55), h: vp.height - top };

    this.actionScale = Math.max(1, Math.round((TUNING.touch.actionButton * vp.dpr) / 32));
    const aSize = 32 * this.actionScale;
    const ax = safe.x + safe.width - aSize;
    const ay = safe.y + safe.height - aSize - 14 * pixelScale(vp, 1);
    this.actionRect = { x: ax, y: ay, w: aSize, h: aSize };
    this.action.setScale(this.actionScale).setPosition(ax + aSize / 2, ay + aSize / 2);
    this.actionIcon.setScale(Math.max(1, Math.round(this.actionScale * 1.4))).setPosition(ax + aSize / 2, ay + aSize / 2);
    this.actionLabel.setScale(pixelScale(vp, 1.5)).setPosition(Math.round(ax + aSize / 2), ay + aSize + 2 * pixelScale(vp, 1));

    const pSize = Math.round(TUNING.touch.smallButton * vp.dpr);
    const pScale = Math.max(1, Math.round((pSize * 0.6) / 16));
    this.pauseRect = { x: safe.x + safe.width - pSize, y: safe.y, w: pSize, h: pSize };
    this.pauseBtn.setScale(pScale).setPosition(this.pauseRect.x + pSize / 2, this.pauseRect.y + pSize / 2);
    this.pauseIcon.setScale(pScale).setPosition(this.pauseRect.x + pSize / 2, this.pauseRect.y + pSize / 2);
    if (this.stickPointer === null) this.placeStick(this.stickRest.x, this.stickRest.y, 0, 0);
  }

  /** Beim Szenen-Ende: nur Eingaben lösen und Listener entfernen (Spielobjekte räumt Phaser selbst ab). */
  destroy(): void {
    this.releaseInput();
    const input = this.scene.input;
    input.off(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    input.off(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    input.off(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (!this.visible || !p.wasTouch) return;
    const x = p.x;
    const y = p.y;
    if (inside(this.pauseRect, x, y)) {
      this.s.sfx.confirm();
      this.onPause();
      return;
    }
    if (this.actionPointer === null && inside(grow(this.actionRect, this.actionRect.w * 0.15), x, y)) {
      this.actionPointer = p.id;
      this.action.setTexture('touch-btn-down');
      this.s.input.setVirtual('interact', true);
      this.vibrate(12);
      return;
    }
    if (this.stickPointer === null && inside(this.stickZone, x, y)) {
      this.stickPointer = p.id;
      // Basis dort, wo der Daumen aufsetzt (aber vollständig sichtbar).
      const r = this.stickRadius;
      this.stickBase = {
        x: Phaser.Math.Clamp(x, r, this.scene.scale.width - r),
        y: Phaser.Math.Clamp(y, r, this.scene.scale.height - r),
      };
      this.ring.setAlpha(TUNING.touch.opacity);
      this.placeStick(this.stickBase.x, this.stickBase.y, 0, 0);
    }
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (p.id !== this.stickPointer) return;
    const dx = p.x - this.stickBase.x;
    const dy = p.y - this.stickBase.y;
    const len = Math.hypot(dx, dy);
    const r = this.stickRadius;
    const k = len > r ? r / len : 1;
    this.placeStick(this.stickBase.x, this.stickBase.y, dx * k, dy * k);
    let vx = (dx * k) / r;
    let vy = (dy * k) / r;
    const mag = Math.hypot(vx, vy);
    if (mag < TUNING.touch.joystickDeadzone) {
      vx = 0;
      vy = 0;
    } else {
      // Totzone herausrechnen, damit leichte Auslenkung trotzdem sanft beginnt.
      const scaled = (mag - TUNING.touch.joystickDeadzone) / (1 - TUNING.touch.joystickDeadzone);
      vx = (vx / mag) * scaled;
      vy = (vy / mag) * scaled;
    }
    this.s.input.setVirtualStick(vx, vy);
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (p.id === this.stickPointer) {
      this.stickPointer = null;
      this.s.input.setVirtualStick(0, 0);
      this.ring.setAlpha(TUNING.touch.opacity * 0.6);
      this.placeStick(this.stickRest.x, this.stickRest.y, 0, 0);
    }
    if (p.id === this.actionPointer) {
      this.actionPointer = null;
      this.action.setTexture('touch-btn');
      this.s.input.setVirtual('interact', false);
    }
  }

  private releaseInput(): void {
    this.stickPointer = null;
    this.actionPointer = null;
    this.s.input.setVirtualStick(0, 0);
    this.s.input.setVirtual('interact', false);
  }

  private releaseAll(): void {
    this.releaseInput();
    this.action.setTexture('touch-btn');
    this.placeStick(this.stickRest.x, this.stickRest.y, 0, 0);
  }

  private placeStick(bx: number, by: number, kx: number, ky: number): void {
    this.ring.setPosition(Math.round(bx), Math.round(by));
    this.knob.setPosition(Math.round(bx + kx), Math.round(by + ky));
  }

  private vibrate(ms: number): void {
    if (!this.s.settings.get().vibration) return;
    try {
      navigator.vibrate?.(ms);
    } catch {
      /* nicht unterstützt */
    }
  }
}

function inside(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

function grow(r: Rect, d: number): Rect {
  return { x: r.x - d, y: r.y - d, w: r.w + 2 * d, h: r.h + 2 * d };
}

import Phaser from 'phaser';
import { hex } from '../../config/palette';
import { TUNING } from '../../config/tuning';
import { PixelLabel } from '../PixelLabel';
import type { ToastOptions } from './apps/types';
import type { Rect } from './focusNav';
import type { HostBase } from './host';
import { drawBevel } from './widgets';

interface Toast {
  opts: ToastOptions;
  c: Phaser.GameObjects.Container;
  g: Phaser.GameObjects.Graphics;
  icon: Phaser.GameObjects.Image;
  title: PixelLabel;
  body: PixelLabel;
  zone: Phaser.GameObjects.Zone;
  age: number;
  w: number;
  h: number;
  y: number;
  leaving: boolean;
}

/**
 * Benachrichtigungen (OS-11): gleiten am Rand herein, stapeln sich, verschwinden nach einigen
 * Sekunden. Antippen führt die hinterlegte Aktion aus (z. B. App öffnen) und schließt.
 */
export class Toasts {
  private readonly list: Toast[] = [];
  private area: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private anchor: 'bottom' | 'top' = 'bottom';

  constructor(
    private readonly base: HostBase,
    private readonly depth: number,
  ) {}

  push(opts: ToastOptions): void {
    const sc = this.base.scene;
    const u = this.base.u();
    const c = sc.add.container(0, 0).setDepth(this.depth);
    const g = sc.add.graphics();
    const icon = sc.add.image(0, 0, `os-icon-${opts.icon}`).setScale(Math.max(1, Math.round(u * 0.75)));
    c.add([g, icon]);
    const title = new PixelLabel(sc, opts.title, { scale: u, color: 'white', shadow: null, container: c });
    const body = new PixelLabel(sc, opts.body, { scale: u, color: 'white', shadow: null, container: c });
    const zone = sc.add.zone(0, 0, 1, 1).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    c.add(zone);
    const toast: Toast = { opts, c, g, icon, title, body, zone, age: 0, w: 0, h: 0, y: 0, leaving: false };
    zone.on('pointerup', () => {
      this.base.s.sfx.move();
      opts.onClick?.();
      toast.leaving = true;
      toast.age = Math.max(toast.age, TUNING.os.toastSeconds - 0.3);
    });
    this.list.push(toast);
    // Zu viele? Die ältesten machen Platz.
    const visible = this.list.filter((t) => !t.leaving);
    for (let i = 0; i < visible.length - TUNING.os.toastMax; i++) {
      const old = visible[i]!;
      old.leaving = true;
      old.age = Math.max(old.age, TUNING.os.toastSeconds - 0.3);
    }
    this.measure(toast);
    this.base.s.sfx.notify();
  }

  /** Bereich, in dem Benachrichtigungen erscheinen, und Ecke (unten rechts bzw. oben rechts). */
  layout(area: Rect, anchor: 'bottom' | 'top'): void {
    this.area = area;
    this.anchor = anchor;
    for (const t of this.list) this.measure(t);
  }

  update(dt: number): void {
    const u = this.base.u();
    const life = TUNING.os.toastSeconds;
    let offset = 0;
    const gap = 3 * u;
    // Neueste am Rand, ältere rücken weiter weg.
    for (let i = this.list.length - 1; i >= 0; i--) {
      const t = this.list[i]!;
      t.age += dt;
      if (t.age >= life) {
        this.remove(i);
        continue;
      }
      const slideIn = Math.min(1, t.age / 0.25);
      const fadeOut = Math.min(1, (life - t.age) / 0.35);
      const ease = 1 - (1 - slideIn) ** 3;
      const targetY = this.anchor === 'bottom' ? this.area.y + this.area.h - offset - t.h : this.area.y + offset;
      t.y = t.age < 0.05 ? targetY : t.y + (targetY - t.y) * Math.min(1, dt * 14);
      const x = this.area.x + this.area.w - t.w + Math.round((1 - ease) * (t.w + 8 * u));
      t.c.setPosition(Math.round(x), Math.round(t.y));
      t.c.setAlpha(fadeOut);
      offset += t.h + gap;
    }
  }

  snapshot(): { title: string; body: string }[] {
    return this.list.filter((t) => !t.leaving).map((t) => ({ title: t.opts.title, body: t.opts.body }));
  }

  /** Bildschirm-Rechtecke der sichtbaren Benachrichtigungen (für Tests). */
  rects(): Rect[] {
    return this.list.filter((t) => !t.leaving).map((t) => ({ x: t.c.x, y: t.c.y, w: t.w, h: t.h }));
  }

  redraw(): void {
    for (const t of this.list) this.measure(t);
  }

  destroy(): void {
    while (this.list.length) this.remove(0);
  }

  private remove(i: number): void {
    const [t] = this.list.splice(i, 1);
    if (!t) return;
    t.title.destroy();
    t.body.destroy();
    t.c.destroy(true);
  }

  private measure(t: Toast): void {
    const u = this.base.u();
    const th = this.base.theme();
    const w = Math.round(Math.min(TUNING.os.toastWidth * this.base.dpr(), this.area.w - 4 * u));
    const iconW = 16 * t.icon.scaleX;
    const textX = 6 * u + iconW;
    const textW = Math.max(20 * u, w - textX - 4 * u);
    t.title.setScale(u).setColor(th.accent).setMaxWidth(textW).setPosition(textX, 4 * u);
    t.body.setScale(u).setColor(th.text).setMaxWidth(textW).setPosition(textX, 4 * u + t.title.height + 2 * u);
    const h = Math.round(Math.max(iconW + 8 * u, 4 * u + t.title.height + 2 * u + t.body.height + 5 * u));
    t.w = w;
    t.h = h;
    t.icon.setPosition(Math.round(4 * u + iconW / 2), Math.round(4 * u + iconW / 2));
    t.g.clear();
    t.g.fillStyle(hex('ink0'), 0.5).fillRect(2 * u, 2 * u, w, h);
    drawBevel(t.g, 0, 0, w, h, u, th.window, th.frameLight, th.windowDark);
    t.g.fillStyle(hex(th.accent), 1).fillRect(u, u, u, h - 2 * u);
    t.zone.setSize(w, h);
    t.zone.input?.hitArea.setTo(0, 0, w, h);
  }
}

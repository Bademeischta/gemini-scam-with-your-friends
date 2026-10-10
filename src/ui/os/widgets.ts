import Phaser from 'phaser';
import { hex, PALETTE, type PaletteName } from '../../config/palette';
import { TUNING } from '../../config/tuning';
import type { Services } from '../../core/services';
import { PixelLabel } from '../PixelLabel';
import type { FocusManager } from './FocusManager';
import type { NavDir, Rect } from './focusNav';
import type { OsTheme } from './theme';

export const BODY_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", sans-serif';

/**
 * Umgebung eines Widgets: Container (lokale Koordinaten), Bildschirm-Ursprung des Containers,
 * Fokus-Verwaltung und aktuelles Farbschema.
 */
export interface Host {
  scene: Phaser.Scene;
  s: Services;
  focus: FocusManager;
  container: Phaser.GameObjects.Container;
  origin(): { x: number; y: number };
  theme(): OsTheme;
  /** OS-Pixel (physische Pixel pro Art-Pixel). */
  u(): number;
  dpr(): number;
  scope: string;
  /** Wird aufgerufen, wenn sich der Container bewegt (Masken nachziehen). */
  onMove(fn: () => void): void;
}

/** Erhabener Pixel-Rahmen wie bei klassischen Desktop-Oberflächen. */
export function drawBevel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, u: number, face: PaletteName, light: PaletteName, dark: PaletteName, pressed = false): void {
  g.fillStyle(hex('ink0'), 1).fillRect(x, y, w, h);
  g.fillStyle(hex(face), 1).fillRect(x + u, y + u, w - 2 * u, h - 2 * u);
  g.fillStyle(hex(pressed ? dark : light), 1).fillRect(x + u, y + u, w - 2 * u, u).fillRect(x + u, y + u, u, h - 2 * u);
  g.fillStyle(hex(pressed ? light : dark), 1).fillRect(x + u, y + h - 2 * u, w - 2 * u, u).fillRect(x + w - 2 * u, y + u, u, h - 2 * u);
}

abstract class Widget {
  protected rect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  protected unregister: (() => void) | null = null;
  protected visible = true;

  constructor(
    protected readonly host: Host,
    readonly id: string,
  ) {}

  screenRect(): Rect {
    const o = this.host.origin();
    return { x: o.x + this.rect.x, y: o.y + this.rect.y, w: this.rect.w, h: this.rect.h };
  }

  get bounds(): Rect {
    return this.rect;
  }

  abstract destroy(): void;
}

export interface ButtonOptions {
  label?: string;
  icon?: string;
  iconScale?: number;
  onClick: () => void;
  variant?: 'normal' | 'primary' | 'flat';
  /** Beschriftung links (mit Symbol davor) statt mittig. */
  align?: 'center' | 'left';
}

/**
 * Laufende Zeiger-Geste, die horizontales Wischen für sich beansprucht (Schieberegler).
 * Der Desktop wechselt dann nicht die App.
 */
export const gesture = { locked: false };

/** Text auf eine Breite kürzen („…“ am Ende). */
export function fitLabel(label: PixelLabel, text: string, maxW: number): void {
  label.setText(text);
  if (maxW <= 0 || label.width <= maxW) return;
  let n = text.length;
  while (n > 1) {
    n--;
    label.setText(`${text.slice(0, n).trimEnd()}…`);
    if (label.width <= maxW) return;
  }
}

/** Klickbarer Button mit Druck-Animation, Hover und Fokus. */
export class OsButton extends Widget {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly label: PixelLabel | null;
  private readonly icon: Phaser.GameObjects.Image | null;
  private readonly zone: Phaser.GameObjects.Zone;
  private text: string;
  private iconScale: number;
  private showLabel = true;
  private pressed = false;
  private hover = false;
  private enabled = true;
  private active = false;

  constructor(host: Host, id: string, private readonly opts: ButtonOptions) {
    super(host, id);
    const sc = host.scene;
    this.text = opts.label ?? '';
    this.iconScale = opts.iconScale ?? host.u();
    this.g = sc.add.graphics();
    host.container.add(this.g);
    this.icon = opts.icon ? sc.add.image(0, 0, opts.icon) : null;
    if (this.icon) host.container.add(this.icon);
    this.label = opts.label !== undefined ? new PixelLabel(sc, opts.label, { scale: host.u(), color: 'white', shadow: null, originX: 0.5, originY: 0.5, container: host.container }) : null;
    this.zone = sc.add.zone(0, 0, 1, 1).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    host.container.add(this.zone);
    this.zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.enabled || p.button !== 0) return;
      this.pressed = true;
      this.draw();
    });
    this.zone.on('pointerup', () => {
      if (!this.enabled || !this.pressed) return;
      this.pressed = false;
      this.draw();
      this.click();
    });
    this.zone.on('pointerout', () => {
      this.pressed = false;
      this.hover = false;
      this.draw();
    });
    this.zone.on('pointerover', (p: Phaser.Input.Pointer) => {
      this.hover = !p.wasTouch;
      this.draw();
    });
    this.unregister = host.focus.register({
      id,
      scope: host.scope,
      rect: () => this.screenRect(),
      activate: () => this.click(),
      enabled: () => this.enabled && this.visible && this.rect.w > 0,
    });
  }

  click(): void {
    if (!this.enabled) return;
    this.host.s.sfx.move();
    this.opts.onClick();
  }

  setLabel(text: string): this {
    if (text === this.text) return this;
    this.text = text;
    if (this.rect.w > 0) this.layout(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
    return this;
  }

  setLabelVisible(on: boolean): this {
    this.showLabel = on;
    this.label?.setVisible(on && this.visible);
    return this;
  }

  setIconScale(scale: number): this {
    this.iconScale = Math.max(1, Math.round(scale));
    return this;
  }

  setIcon(key: string): this {
    this.icon?.setTexture(key);
    return this;
  }

  /** Breite für Symbol plus vollständige Beschriftung (physische Pixel). */
  preferredWidth(): number {
    const u = this.host.u();
    let w = 8 * u;
    if (this.icon) w += this.icon.width * this.iconScale;
    if (this.label && this.showLabel) {
      this.label.setScale(u).setText(this.text);
      w += this.label.width + (this.icon ? 3 * u : 0);
    }
    return Math.ceil(w);
  }

  setEnabled(on: boolean): this {
    this.enabled = on;
    this.draw();
    return this;
  }

  /** Hervorgehoben (z. B. gedrückter Umschalter, aktives Fenster in der Taskleiste). */
  setActive(on: boolean): this {
    this.active = on;
    this.draw();
    return this;
  }

  setVisible(on: boolean): this {
    this.visible = on;
    this.g.setVisible(on);
    this.icon?.setVisible(on);
    this.label?.setVisible(on && this.showLabel);
    if (on) this.zone.setInteractive();
    else this.zone.disableInteractive();
    return this;
  }

  layout(x: number, y: number, w: number, h: number): this {
    this.rect = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
    this.zone.setPosition(this.rect.x, this.rect.y).setSize(this.rect.w, this.rect.h);
    this.zone.input?.hitArea.setTo(0, 0, this.rect.w, this.rect.h);
    const u = this.host.u();
    const cy = Math.round(this.rect.y + this.rect.h / 2);
    const withLabel = !!this.label && this.showLabel && this.text !== '';
    const iconW = this.icon ? this.icon.width * this.iconScale : 0;
    const leftAligned = withLabel && (this.opts.align === 'left' || !!this.icon);
    if (this.icon) {
      this.icon.setScale(this.iconScale);
      const ix = withLabel ? this.rect.x + 4 * u + iconW / 2 : this.rect.x + this.rect.w / 2;
      this.icon.setPosition(Math.round(ix), cy);
    }
    if (this.label) {
      this.label.setScale(u).setVisible(withLabel && this.visible);
      if (withLabel) {
        const left = this.icon ? this.rect.x + 7 * u + iconW : this.rect.x + 4 * u;
        fitLabel(this.label, this.text, leftAligned ? this.rect.x + this.rect.w - 3 * u - left : this.rect.w - 6 * u);
        if (leftAligned) this.label.setOrigin(0, 0.5).setPosition(Math.round(left), cy);
        else this.label.setOrigin(0.5, 0.5).setPosition(Math.round(this.rect.x + this.rect.w / 2), cy);
      }
    }
    this.draw();
    return this;
  }

  draw(): void {
    const g = this.g;
    g.clear();
    if (!this.visible || this.rect.w === 0) return;
    const t = this.host.theme();
    const u = this.host.u();
    const { x, y, w, h } = this.rect;
    const variant = this.opts.variant ?? 'normal';
    if (variant === 'flat') {
      if (this.active || this.hover || this.pressed) g.fillStyle(hex(this.pressed || this.active ? t.selection : t.button), 1).fillRect(x, y, w, h);
    } else {
      const face = variant === 'primary' ? t.accent : this.hover ? t.buttonLight : t.button;
      drawBevel(g, x, y, w, h, u, face, variant === 'primary' ? 'white' : t.buttonLight, t.buttonDark, this.pressed || this.active);
    }
    const alpha = this.enabled ? 1 : 0.4;
    this.label?.setAlpha(alpha).setColor(variant === 'primary' ? 'ink0' : t.text);
    this.icon?.setAlpha(alpha);
  }

  destroy(): void {
    this.unregister?.();
    this.g.destroy();
    this.icon?.destroy();
    this.label?.destroy();
    this.zone.destroy();
  }
}

export interface ListItem {
  id: string;
  label: string;
  icon?: string;
  right?: string;
  dim?: boolean;
}

/**
 * Scrollbare Liste (Dateien, Einstellungen …). Maus: Klick wählt, Doppelklick öffnet.
 * Touch: Tippen öffnet, Ziehen scrollt. Tastatur/Gamepad: hoch/runter, A/Enter öffnet.
 */
export class OsList extends Widget {
  private items: ListItem[] = [];
  private selected = 0;
  private scroll = 0;
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly rowContainer: Phaser.GameObjects.Container;
  private readonly maskShape: Phaser.GameObjects.Graphics;
  private readonly zone: Phaser.GameObjects.Zone;
  private rows: { icon: Phaser.GameObjects.Image | null; label: PixelLabel; right: PixelLabel | null }[] = [];
  private dragStart: { y: number; scroll: number; moved: boolean } | null = null;
  private lastClick = { index: -1, time: 0 };
  private longTimer: Phaser.Time.TimerEvent | null = null;
  onActivate: (item: ListItem) => void = () => undefined;
  onSelect: (item: ListItem) => void = () => undefined;
  /** Rechtsklick bzw. langes Drücken auf einer Zeile (Bildschirmkoordinaten). */
  onContext: ((item: ListItem, x: number, y: number) => void) | null = null;

  constructor(host: Host, id: string) {
    super(host, id);
    const sc = host.scene;
    this.g = sc.add.graphics();
    this.rowContainer = sc.add.container(0, 0);
    host.container.add([this.g, this.rowContainer]);
    this.maskShape = sc.make.graphics({}, false);
    this.rowContainer.setMask(this.maskShape.createGeometryMask());
    this.zone = sc.add.zone(0, 0, 1, 1).setOrigin(0, 0).setInteractive();
    host.container.add(this.zone);
    this.zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.cancelLong();
      if (p.rightButtonDown()) {
        this.dragStart = null;
        this.contextAt(p.x, p.y);
        return;
      }
      this.dragStart = { y: p.y, scroll: this.scroll, moved: false };
      if (p.wasTouch && this.onContext) {
        const x = p.x;
        const y = p.y;
        this.longTimer = sc.time.delayedCall(TUNING.os.longPressSeconds * 1000, () => {
          this.longTimer = null;
          if (!this.dragStart || this.dragStart.moved) return;
          this.dragStart = null;
          this.contextAt(x, y);
        });
      }
    });
    this.zone.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.dragStart || !p.isDown) return;
      const dy = p.y - this.dragStart.y;
      if (Math.abs(dy) > 4 * this.host.u()) {
        this.dragStart.moved = true;
        this.cancelLong();
      }
      if (this.dragStart.moved) this.setScroll(this.dragStart.scroll - dy);
    });
    this.zone.on('pointerout', () => this.cancelLong());
    this.zone.on('pointerup', (p: Phaser.Input.Pointer) => {
      this.cancelLong();
      if (!this.dragStart) return;
      const moved = this.dragStart.moved;
      this.dragStart = null;
      if (moved || p.button !== 0) return;
      const idx = this.indexAt(p.y);
      if (idx < 0) return;
      const now = performance.now();
      const isDouble = this.lastClick.index === idx && now - this.lastClick.time < 450;
      this.lastClick = { index: idx, time: now };
      this.select(idx);
      if (p.wasTouch || isDouble) this.activateSelected();
    });
    this.zone.on('wheel', (_p: Phaser.Input.Pointer, _dx: number, dy: number) => this.setScroll(this.scroll + dy));
    host.onMove(() => this.updateMask());
    this.unregister = host.focus.register({
      id,
      scope: host.scope,
      rect: () => this.selectedRect(),
      activate: () => this.activateSelected(),
      context: () => {
        const r = this.selectedRect();
        this.contextAt(r.x + r.w / 2, r.y + r.h / 2);
      },
      enabled: () => this.visible && this.items.length > 0 && this.rect.w > 0,
      navigate: (dir: NavDir) => {
        if (dir === 'up' && this.selected > 0) {
          this.select(this.selected - 1);
          return true;
        }
        if (dir === 'down' && this.selected < this.items.length - 1) {
          this.select(this.selected + 1);
          return true;
        }
        return false;
      },
    });
  }

  get selectedItem(): ListItem | undefined {
    return this.items[this.selected];
  }

  get entries(): readonly ListItem[] {
    return this.items;
  }

  setItems(items: ListItem[]): this {
    this.items = items;
    this.selected = Math.min(this.selected, Math.max(0, items.length - 1));
    for (const r of this.rows) {
      r.icon?.destroy();
      r.label.destroy();
      r.right?.destroy();
    }
    const sc = this.host.scene;
    this.rows = items.map((it) => ({
      icon: it.icon ? sc.add.image(0, 0, it.icon) : null,
      label: new PixelLabel(sc, it.label, { scale: this.host.u(), color: 'white', shadow: null, originY: 0.5, container: this.rowContainer }),
      right: it.right ? new PixelLabel(sc, it.right, { scale: this.host.u(), color: 'fog', shadow: null, originX: 1, originY: 0.5, container: this.rowContainer }) : null,
    }));
    for (const r of this.rows) if (r.icon) this.rowContainer.add(r.icon);
    this.relayoutRows();
    return this;
  }

  select(index: number): void {
    if (index < 0 || index >= this.items.length) return;
    this.selected = index;
    this.ensureVisible(index);
    this.relayoutRows();
    const it = this.items[index];
    if (it) this.onSelect(it);
  }

  activateSelected(): void {
    const it = this.items[this.selected];
    if (!it) return;
    this.host.s.sfx.confirm();
    this.onActivate(it);
  }

  layout(x: number, y: number, w: number, h: number): this {
    this.rect = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
    this.zone.setPosition(this.rect.x, this.rect.y).setSize(this.rect.w, this.rect.h);
    this.zone.input?.hitArea.setTo(0, 0, this.rect.w, this.rect.h);
    this.setScroll(this.scroll);
    this.updateMask();
    return this;
  }

  setVisible(on: boolean): this {
    this.visible = on;
    this.g.setVisible(on);
    this.rowContainer.setVisible(on);
    if (on) this.zone.setInteractive();
    else this.zone.disableInteractive();
    return this;
  }

  destroy(): void {
    this.cancelLong();
    this.unregister?.();
    this.g.destroy();
    this.rowContainer.destroy(true);
    this.maskShape.destroy();
    this.zone.destroy();
  }

  private cancelLong(): void {
    this.longTimer?.remove(false);
    this.longTimer = null;
  }

  private contextAt(x: number, y: number): void {
    if (!this.onContext) return;
    const idx = this.indexAt(y);
    const it = this.items[idx];
    if (!it) return;
    this.select(idx);
    this.onContext(it, x, y);
  }

  private get rowH(): number {
    return Math.max(14 * this.host.u(), Math.round(36 * this.host.dpr()));
  }

  private indexAt(screenY: number): number {
    const local = screenY - this.host.origin().y - this.rect.y + this.scroll;
    const i = Math.floor(local / this.rowH);
    return i >= 0 && i < this.items.length ? i : -1;
  }

  private selectedRect(): Rect {
    const r = this.screenRect();
    return { x: r.x, y: Math.max(r.y, Math.min(r.y + r.h - this.rowH, r.y + this.selected * this.rowH - this.scroll)), w: r.w, h: this.rowH };
  }

  private ensureVisible(i: number): void {
    const top = i * this.rowH;
    if (top < this.scroll) this.setScroll(top);
    else if (top + this.rowH > this.scroll + this.rect.h) this.setScroll(top + this.rowH - this.rect.h);
  }

  private setScroll(v: number): void {
    const max = Math.max(0, this.items.length * this.rowH - this.rect.h);
    this.scroll = Phaser.Math.Clamp(v, 0, max);
    this.relayoutRows();
  }

  private relayoutRows(): void {
    const t = this.host.theme();
    const u = this.host.u();
    const rh = this.rowH;
    const { x, y, w, h } = this.rect;
    const g = this.g;
    g.clear();
    g.fillStyle(hex(t.windowDark), 1).fillRect(x, y, w, h);
    this.rows.forEach((r, i) => {
      const ry = y + i * rh - this.scroll;
      const sel = i === this.selected;
      if (sel && ry + rh > y && ry < y + h) g.fillStyle(hex(t.selection), 1).fillRect(x, Math.max(y, ry), w, Math.min(rh, y + h - ry, ry + rh - y));
      let lx = x + 3 * u;
      if (r.icon) {
        r.icon.setScale(Math.max(1, Math.round(u * 0.75))).setPosition(Math.round(lx + (r.icon.width * r.icon.scaleX) / 2), Math.round(ry + rh / 2));
        lx += r.icon.width * r.icon.scaleX + 3 * u;
      }
      const item = this.items[i];
      r.label.setScale(u).setColor(item?.dim ? t.textDim : t.text).setPosition(Math.round(lx), Math.round(ry + rh / 2));
      r.right?.setScale(u).setPosition(Math.round(x + w - 3 * u), Math.round(ry + rh / 2));
    });
    // Scrollbalken, wenn nötig.
    const total = this.items.length * rh;
    if (total > h) {
      const barH = Math.max(6 * u, (h * h) / total);
      const barY = y + ((h - barH) * this.scroll) / (total - h);
      g.fillStyle(hex(t.buttonLight), 1).fillRect(x + w - 2 * u, barY, 2 * u, barH);
    }
  }

  private updateMask(): void {
    const r = this.screenRect();
    this.maskShape.clear().fillStyle(0xffffff, 1).fillRect(r.x, r.y, r.w, r.h);
  }
}

/** Schieberegler 0–1 (Lautstärke …). */
export class OsSlider extends Widget {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly zone: Phaser.GameObjects.Zone;
  private value: number;
  onChange: (v: number) => void = () => undefined;

  constructor(host: Host, id: string, initial: number) {
    super(host, id);
    this.value = Phaser.Math.Clamp(initial, 0, 1);
    this.g = host.scene.add.graphics();
    this.zone = host.scene.add.zone(0, 0, 1, 1).setOrigin(0, 0).setInteractive({ useHandCursor: true, draggable: false });
    host.container.add([this.g, this.zone]);
    const setFrom = (p: Phaser.Input.Pointer): void => {
      const r = this.screenRect();
      this.set((p.x - r.x) / Math.max(1, r.w));
    };
    this.zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
      gesture.locked = true;
      setFrom(p);
    });
    this.zone.on('pointermove', (p: Phaser.Input.Pointer) => p.isDown && gesture.locked && setFrom(p));
    this.unregister = host.focus.register({
      id,
      scope: host.scope,
      rect: () => this.screenRect(),
      activate: () => undefined,
      enabled: () => this.visible && this.rect.w > 0,
      navigate: (dir) => {
        if (dir === 'left' || dir === 'right') {
          this.set(this.value + (dir === 'left' ? -0.1 : 0.1));
          return true;
        }
        return false;
      },
    });
  }

  get current(): number {
    return this.value;
  }

  setVisible(on: boolean): this {
    this.visible = on;
    this.g.setVisible(on);
    if (on) this.zone.setInteractive();
    else this.zone.disableInteractive();
    return this;
  }

  set(v: number): void {
    const nv = Math.round(Phaser.Math.Clamp(v, 0, 1) * 20) / 20;
    if (nv === this.value) return;
    this.value = nv;
    this.draw();
    this.onChange(nv);
  }

  layout(x: number, y: number, w: number, h: number): this {
    this.rect = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
    this.zone.setPosition(this.rect.x, this.rect.y).setSize(this.rect.w, this.rect.h);
    this.zone.input?.hitArea.setTo(0, 0, this.rect.w, this.rect.h);
    this.draw();
    return this;
  }

  draw(): void {
    const t = this.host.theme();
    const u = this.host.u();
    const { x, y, w, h } = this.rect;
    const g = this.g;
    const cy = Math.round(y + h / 2);
    g.clear();
    g.fillStyle(hex('ink0'), 1).fillRect(x, cy - 2 * u, w, 4 * u);
    g.fillStyle(hex(t.accent), 1).fillRect(x + u, cy - u, Math.round((w - 2 * u) * this.value), 2 * u);
    const kx = Math.round(x + (w - 6 * u) * this.value);
    drawBevel(g, kx, cy - 5 * u, 6 * u, 10 * u, u, t.button, t.buttonLight, t.buttonDark);
  }

  destroy(): void {
    this.unregister?.();
    this.g.destroy();
    this.zone.destroy();
  }
}

/** Kontrollkästchen mit Beschriftung. */
export class OsToggle extends Widget {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly label: PixelLabel;
  private readonly zone: Phaser.GameObjects.Zone;
  private on: boolean;
  onChange: (v: boolean) => void = () => undefined;

  constructor(host: Host, id: string, text: string, initial: boolean) {
    super(host, id);
    this.on = initial;
    this.g = host.scene.add.graphics();
    host.container.add(this.g);
    this.label = new PixelLabel(host.scene, text, { scale: host.u(), color: 'white', shadow: null, originY: 0.5, container: host.container });
    this.zone = host.scene.add.zone(0, 0, 1, 1).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    host.container.add(this.zone);
    this.zone.on('pointerup', () => this.toggle());
    this.unregister = host.focus.register({
      id,
      scope: host.scope,
      rect: () => this.screenRect(),
      activate: () => this.toggle(),
      enabled: () => this.visible && this.rect.w > 0,
    });
  }

  get value(): boolean {
    return this.on;
  }

  setVisible(on: boolean): this {
    this.visible = on;
    this.g.setVisible(on);
    this.label.setVisible(on);
    if (on) this.zone.setInteractive();
    else this.zone.disableInteractive();
    return this;
  }

  toggle(): void {
    this.on = !this.on;
    this.host.s.sfx.move();
    this.draw();
    this.onChange(this.on);
  }

  layout(x: number, y: number, w: number, h: number): this {
    this.rect = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
    this.zone.setPosition(this.rect.x, this.rect.y).setSize(this.rect.w, this.rect.h);
    this.zone.input?.hitArea.setTo(0, 0, this.rect.w, this.rect.h);
    this.draw();
    return this;
  }

  draw(): void {
    const t = this.host.theme();
    const u = this.host.u();
    const { x, y, h } = this.rect;
    const box = 9 * u;
    const by = Math.round(y + h / 2 - box / 2);
    const g = this.g;
    g.clear();
    drawBevel(g, x, by, box, box, u, t.windowDark, t.buttonDark, t.buttonLight, true);
    if (this.on) {
      g.fillStyle(hex(t.accent), 1);
      for (let i = 0; i < 3; i++) g.fillRect(x + (2 + i) * u, by + (4 + i) * u, u, u);
      for (let i = 0; i < 4; i++) g.fillRect(x + (5 + i) * u, by + (5 - i) * u, u, u);
    }
    this.label.setScale(u).setColor(t.text).setPosition(x + box + 4 * u, Math.round(y + h / 2));
  }

  destroy(): void {
    this.unregister?.();
    this.g.destroy();
    this.label.destroy();
    this.zone.destroy();
  }
}

/** Längerer Text in Systemschrift, scrollbar (Datei-Inhalte, Beschreibungen). */
export class OsTextView extends Widget {
  private readonly text: Phaser.GameObjects.Text;
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly maskShape: Phaser.GameObjects.Graphics;
  private readonly zone: Phaser.GameObjects.Zone;
  private scroll = 0;
  private drag: { y: number; scroll: number } | null = null;

  constructor(host: Host, id: string, content: string) {
    super(host, id);
    const sc = host.scene;
    this.g = sc.add.graphics();
    this.text = sc.add.text(0, 0, content, { fontFamily: BODY_FONT, color: PALETTE.paper, fontSize: '14px' });
    this.maskShape = sc.make.graphics({}, false);
    this.text.setMask(this.maskShape.createGeometryMask());
    this.zone = sc.add.zone(0, 0, 1, 1).setOrigin(0, 0).setInteractive();
    host.container.add([this.g, this.text, this.zone]);
    this.zone.on('pointerdown', (p: Phaser.Input.Pointer) => (this.drag = { y: p.y, scroll: this.scroll }));
    this.zone.on('pointermove', (p: Phaser.Input.Pointer) => this.drag && p.isDown && this.setScroll(this.drag.scroll - (p.y - this.drag.y)));
    this.zone.on('pointerup', () => (this.drag = null));
    this.zone.on('wheel', (_p: Phaser.Input.Pointer, _dx: number, dy: number) => this.setScroll(this.scroll + dy));
    host.onMove(() => this.updateMask());
    this.unregister = host.focus.register({
      id,
      scope: host.scope,
      rect: () => this.screenRect(),
      activate: () => undefined,
      enabled: () => this.visible && this.rect.w > 0,
      navigate: (dir) => {
        const step = 40 * this.host.dpr();
        if (dir === 'down' && this.scroll < this.maxScroll()) {
          this.setScroll(this.scroll + step);
          return true;
        }
        if (dir === 'up' && this.scroll > 0) {
          this.setScroll(this.scroll - step);
          return true;
        }
        return false;
      },
    });
  }

  setVisible(on: boolean): this {
    this.visible = on;
    this.g.setVisible(on);
    this.text.setVisible(on);
    if (on) this.zone.setInteractive();
    else this.zone.disableInteractive();
    return this;
  }

  setContent(content: string): this {
    this.text.setText(content);
    this.setScroll(0);
    return this;
  }

  layout(x: number, y: number, w: number, h: number): this {
    this.rect = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
    const u = this.host.u();
    const t = this.host.theme();
    this.text.setStyle({ fontSize: `${Math.round(14 * this.host.dpr())}px`, color: PALETTE[t.text], wordWrap: { width: this.rect.w - 8 * u, useAdvancedWrap: true } });
    this.text.setLineSpacing(Math.round(4 * this.host.dpr()));
    this.zone.setPosition(this.rect.x, this.rect.y).setSize(this.rect.w, this.rect.h);
    this.zone.input?.hitArea.setTo(0, 0, this.rect.w, this.rect.h);
    this.g.clear().fillStyle(hex(t.windowDark), 1).fillRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
    this.setScroll(this.scroll);
    this.updateMask();
    return this;
  }

  destroy(): void {
    this.unregister?.();
    this.g.destroy();
    this.text.destroy();
    this.maskShape.destroy();
    this.zone.destroy();
  }

  private maxScroll(): number {
    return Math.max(0, this.text.height - this.rect.h + 8 * this.host.u());
  }

  private setScroll(v: number): void {
    this.scroll = Phaser.Math.Clamp(v, 0, this.maxScroll());
    const u = this.host.u();
    this.text.setPosition(this.rect.x + 4 * u, Math.round(this.rect.y + 4 * u - this.scroll));
  }

  private updateMask(): void {
    const r = this.screenRect();
    this.maskShape.clear().fillStyle(0xffffff, 1).fillRect(r.x, r.y, r.w, r.h);
  }
}

/** Höhe für Buttons, Reiter und Zeilen: Daumengröße auf Touch, kompakter mit Maus. */
export function controlHeight(host: Pick<Host, 'u' | 'dpr' | 's'>): number {
  const css = host.s.device.hintMode === 'touch' ? 44 : 30;
  return Math.max(12 * host.u(), Math.round(css * host.dpr()));
}

/** Reiterleiste (Ordner, Einstellungs-Seiten). */
export class OsTabs {
  private readonly buttons: OsButton[];
  private current = 0;
  onChange: (index: number) => void = () => undefined;

  constructor(host: Host, id: string, labels: string[]) {
    this.buttons = labels.map(
      (label, i) =>
        new OsButton(host, `${id}:${i}`, {
          label,
          onClick: () => {
            this.select(i);
          },
        }),
    );
    this.buttons[0]?.setActive(true);
  }

  get index(): number {
    return this.current;
  }

  select(i: number): void {
    if (i === this.current || i < 0 || i >= this.buttons.length) return;
    this.current = i;
    this.buttons.forEach((b, j) => b.setActive(j === i));
    this.onChange(i);
  }

  layout(x: number, y: number, w: number, h: number, gap: number): void {
    const n = this.buttons.length;
    const each = (w - gap * (n - 1)) / n;
    this.buttons.forEach((b, i) => b.layout(x + i * (each + gap), y, each, h));
  }

  redraw(): void {
    for (const b of this.buttons) b.draw();
  }

  destroy(): void {
    for (const b of this.buttons) b.destroy();
  }
}

import Phaser from 'phaser';
import { hex } from '../../config/palette';
import type { Services } from '../../core/services';
import { PixelLabel } from '../PixelLabel';
import type { FocusManager } from './FocusManager';
import type { Rect } from './focusNav';
import type { OsTheme } from './theme';
import { drawBevel, type Host } from './widgets';

export interface WindowOptions {
  id: string;
  title: string;
  icon: string;
  scene: Phaser.Scene;
  s: Services;
  focus: FocusManager;
  theme: () => OsTheme;
  u: () => number;
  dpr: () => number;
  onClose: (w: OsWindow) => void;
  onFocusRequest: (w: OsWindow) => void;
  onMinimize: (w: OsWindow) => void;
  /** Fenster darf verschoben werden (nicht im Handy-Vollbildmodus). */
  draggable: () => boolean;
  /** Höhe der Titelleiste (physische Pixel). */
  titleBarHeight: () => number;
}

/**
 * Ein Fenster von MogelOS: Rahmen, Titelleiste (Symbol, Titel, Minimieren, Schließen),
 * Inhaltsbereich als Container. Verschiebbar per Maus/Touch an der Titelleiste.
 */
export class OsWindow {
  readonly id: string;
  readonly root: Phaser.GameObjects.Container;
  readonly content: Phaser.GameObjects.Container;
  readonly host: Host;
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly titleLabel: PixelLabel;
  private readonly icon: Phaser.GameObjects.Image;
  private readonly titleZone: Phaser.GameObjects.Zone;
  private readonly closeZone: Phaser.GameObjects.Zone;
  private readonly minZone: Phaser.GameObjects.Zone;
  private readonly bodyZone: Phaser.GameObjects.Zone;
  private readonly moveListeners: (() => void)[] = [];
  private readonly unregs: (() => void)[] = [];
  private drag: { px: number; py: number; wx: number; wy: number } | null = null;
  bounds: Rect = { x: 0, y: 0, w: 100, h: 100 };
  active = false;
  minimized = false;
  visible = true;
  private title: string;

  constructor(private readonly o: WindowOptions) {
    this.id = o.id;
    this.title = o.title;
    const sc = o.scene;
    this.root = sc.add.container(0, 0);
    this.frame = sc.add.graphics();
    this.icon = sc.add.image(0, 0, o.icon);
    this.titleLabel = new PixelLabel(sc, o.title, { scale: o.u(), color: 'ink0', shadow: null, originY: 0.5 });
    this.content = sc.add.container(0, 0);
    this.bodyZone = sc.add.zone(0, 0, 1, 1).setOrigin(0, 0).setInteractive();
    this.titleZone = sc.add.zone(0, 0, 1, 1).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    this.minZone = sc.add.zone(0, 0, 1, 1).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    this.closeZone = sc.add.zone(0, 0, 1, 1).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    this.root.add([this.bodyZone, this.frame, this.icon, this.titleLabel.main, this.content, this.titleZone, this.minZone, this.closeZone]);

    this.host = {
      scene: sc,
      s: o.s,
      focus: o.focus,
      container: this.content,
      origin: () => ({ x: this.root.x + this.content.x, y: this.root.y + this.content.y }),
      theme: o.theme,
      u: o.u,
      dpr: o.dpr,
      scope: `win:${o.id}`,
      onMove: (fn) => this.moveListeners.push(fn),
    };

    this.bodyZone.on('pointerdown', () => o.onFocusRequest(this));
    this.titleZone.on('pointerdown', (p: Phaser.Input.Pointer) => {
      o.onFocusRequest(this);
      if (o.draggable()) this.drag = { px: p.x, py: p.y, wx: this.bounds.x, wy: this.bounds.y };
    });
    sc.input.on(Phaser.Input.Events.POINTER_MOVE, this.onDrag, this);
    sc.input.on(Phaser.Input.Events.POINTER_UP, this.endDrag, this);
    this.closeZone.on('pointerup', () => {
      o.s.sfx.back();
      o.onClose(this);
    });
    this.minZone.on('pointerup', () => {
      o.s.sfx.move();
      o.onMinimize(this);
    });
    const scope = this.host.scope;
    this.unregs.push(
      o.focus.register({ id: `${o.id}:close`, scope, rect: () => this.closeRect(), activate: () => o.onClose(this), enabled: () => this.visible }),
      o.focus.register({ id: `${o.id}:min`, scope, rect: () => this.minRect(), activate: () => o.onMinimize(this), enabled: () => this.visible }),
    );
  }

  get titleText(): string {
    return this.title;
  }

  setTitle(t: string): void {
    this.title = t;
    this.titleLabel.setText(t);
    this.draw();
  }

  get titleBarHeight(): number {
    return this.o.titleBarHeight();
  }

  /** Titelleiste in Bildschirmkoordinaten (zum Verschieben). */
  titleRect(): Rect {
    return { x: this.bounds.x, y: this.bounds.y, w: Math.max(0, this.minRect().x - this.bounds.x), h: this.titleBarHeight };
  }

  /** Fenster neu zeichnen (z. B. nach Wechsel des Farbschemas). */
  redraw(): void {
    this.draw();
  }

  /** Inhaltsfläche relativ zum Fenster. */
  contentRect(): Rect {
    const u = this.o.u();
    const tb = this.titleBarHeight;
    return { x: 2 * u, y: tb + u, w: this.bounds.w - 4 * u, h: this.bounds.h - tb - 3 * u };
  }

  setBounds(r: Rect): void {
    this.bounds = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) };
    this.root.setPosition(this.bounds.x, this.bounds.y);
    const c = this.contentRect();
    this.content.setPosition(c.x, c.y);
    this.bodyZone.setSize(this.bounds.w, this.bounds.h);
    this.bodyZone.input?.hitArea.setTo(0, 0, this.bounds.w, this.bounds.h);
    this.draw();
    for (const fn of this.moveListeners) fn();
  }

  setActive(on: boolean): void {
    this.active = on;
    this.draw();
  }

  setVisible(on: boolean): void {
    this.visible = on;
    this.root.setVisible(on);
    for (const z of [this.bodyZone, this.titleZone, this.minZone, this.closeZone]) {
      if (on) z.setInteractive();
      else z.disableInteractive();
    }
  }

  setDepth(d: number): void {
    this.root.setDepth(d);
  }

  screenRect(): Rect {
    return { ...this.bounds };
  }

  destroy(): void {
    this.o.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.onDrag, this);
    this.o.scene.input.off(Phaser.Input.Events.POINTER_UP, this.endDrag, this);
    for (const un of this.unregs) un();
    this.root.destroy(true);
  }

  private closeRect(): Rect {
    const tb = this.titleBarHeight;
    const size = tb - 2 * this.o.u();
    return { x: this.bounds.x + this.bounds.w - size - 2 * this.o.u(), y: this.bounds.y + this.o.u(), w: size, h: size };
  }

  private minRect(): Rect {
    const c = this.closeRect();
    return { x: c.x - c.w - this.o.u(), y: c.y, w: c.w, h: c.h };
  }

  private onDrag(p: Phaser.Input.Pointer): void {
    if (!this.drag || !p.isDown) return;
    const vw = this.o.scene.scale.width;
    const vh = this.o.scene.scale.height;
    const nx = Phaser.Math.Clamp(this.drag.wx + p.x - this.drag.px, -this.bounds.w + 40 * this.o.u(), vw - 40 * this.o.u());
    const ny = Phaser.Math.Clamp(this.drag.wy + p.y - this.drag.py, 0, vh - this.titleBarHeight * 2);
    this.setBounds({ ...this.bounds, x: nx, y: ny });
  }

  private endDrag(): void {
    this.drag = null;
  }

  private draw(): void {
    const t = this.o.theme();
    const u = this.o.u();
    const { w, h } = this.bounds;
    const tb = this.titleBarHeight;
    const g = this.frame;
    g.clear();
    // Schlagschatten, Rahmen, Titelleiste.
    g.fillStyle(hex('ink0'), 0.5).fillRect(2 * u, 2 * u, w, h);
    drawBevel(g, 0, 0, w, h, u, t.window, t.frameLight, t.windowDark);
    g.fillStyle(hex(this.active ? t.title : t.titleInactive), 1).fillRect(2 * u, u, w - 4 * u, tb - u);
    if (this.active) g.fillStyle(hex('white'), 0.25).fillRect(2 * u, u, w - 4 * u, u);
    // Knöpfe.
    const c = this.closeRect();
    const m = this.minRect();
    for (const [r, kind] of [
      [c, 'close'],
      [m, 'min'],
    ] as const) {
      const lx = r.x - this.bounds.x;
      const ly = r.y - this.bounds.y;
      drawBevel(g, lx, ly, r.w, r.h, u, kind === 'close' ? 'red' : t.button, kind === 'close' ? 'rose' : t.buttonLight, kind === 'close' ? 'wine' : t.buttonDark);
      g.fillStyle(hex('white'), 1);
      const cx = lx + r.w / 2;
      const cy = ly + r.h / 2;
      if (kind === 'close') for (let i = -2; i <= 2; i++) g.fillRect(Math.round(cx + i * u - u / 2), Math.round(cy + i * u - u / 2), u, u).fillRect(Math.round(cx - i * u - u / 2), Math.round(cy + i * u - u / 2), u, u);
      else g.fillRect(Math.round(cx - 3 * u), Math.round(cy + u), 6 * u, u);
    }
    this.closeZone.setPosition(c.x - this.bounds.x, c.y - this.bounds.y).setSize(c.w, c.h);
    this.closeZone.input?.hitArea.setTo(0, 0, c.w, c.h);
    this.minZone.setPosition(m.x - this.bounds.x, m.y - this.bounds.y).setSize(m.w, m.h);
    this.minZone.input?.hitArea.setTo(0, 0, m.w, m.h);
    const titleW = Math.max(1, m.x - this.bounds.x - 2 * u);
    this.titleZone.setPosition(0, 0).setSize(titleW, tb);
    this.titleZone.input?.hitArea.setTo(0, 0, titleW, tb);
    this.icon.setScale(Math.max(1, Math.round((tb - 4 * u) / 16))).setPosition(Math.round(4 * u + (this.icon.width * this.icon.scaleX) / 2), Math.round(u + tb / 2));
    this.titleLabel.setScale(u).setColor(this.active ? t.titleText : t.textDim);
    this.titleLabel.setPosition(Math.round(7 * u + this.icon.width * this.icon.scaleX), Math.round(u + tb / 2));
  }
}

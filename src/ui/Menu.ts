import Phaser from 'phaser';
import { hex } from '../config/palette';
import { TUNING } from '../config/tuning';
import type { Services } from '../core/services';
import { NavRepeat } from '../systems/input/NavRepeat';
import { PixelLabel } from './PixelLabel';

export interface MenuItem {
  id: string;
  label: () => string;
  onSelect: () => void;
}

interface Entry {
  item: MenuItem;
  frame: Phaser.GameObjects.Graphics;
  label: PixelLabel;
  zone: Phaser.GameObjects.Zone;
  rect: { x: number; y: number; w: number; h: number };
  squash: number;
}

/**
 * Senkrechtes Menü mit Pixel-Buttons. Bedienbar per Maus (Hover + Klick), Touch (Antippen),
 * Tastatur und Gamepad (Fokus-Navigation mit Halte-Wiederholung).
 */
export class Menu {
  private entries: Entry[] = [];
  private focus = 0;
  private readonly navUp = new NavRepeat(TUNING.input.navRepeatDelay, TUNING.input.navRepeatInterval);
  private readonly navDown = new NavRepeat(TUNING.input.navRepeatDelay, TUNING.input.navRepeatInterval);
  private enabled = true;
  private visible = true;
  /** Art-Pixel-Skalierung (physische Pixel pro Art-Pixel). */
  private scale = 2;
  private cx = 0;
  private cy = 0;
  private minHeightPx = 0;
  private columns = 1;
  /** Eintrag, auf dem der aktuelle Zeiger gedrückt wurde (Auslösen nur beim Loslassen auf demselben). */
  private pressedIndex = -1;
  /** Tastatur/Gamepad erst ab dem nächsten Frame annehmen (sonst löst der öffnende Tastendruck aus). */
  private armed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly s: Services,
    items: MenuItem[],
    private readonly depth = 10,
  ) {
    for (const item of items) this.addEntry(item);
    const clearPress = (): void => {
      this.pressedIndex = -1;
    };
    scene.input.on(Phaser.Input.Events.POINTER_UP, clearPress);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, clearPress);
  }

  get focusedId(): string | undefined {
    return this.entries[this.focus]?.item.id;
  }

  get count(): number {
    return this.entries.length;
  }

  /** Rechtecke aller Buttons (physische Pixel), z. B. für Tests und Hilfslinien. */
  rects(): { id: string; x: number; y: number; w: number; h: number }[] {
    return this.entries.map((e) => ({ id: e.item.id, ...e.rect }));
  }

  /** Umschließendes Rechteck aller Buttons (physische Pixel). */
  get bounds(): { x: number; y: number; width: number; height: number } {
    if (this.entries.length === 0) return { x: this.cx, y: this.cy, width: 0, height: 0 };
    const rs = this.entries.map((e) => e.rect);
    const x = Math.min(...rs.map((r) => r.x));
    const y = Math.min(...rs.map((r) => r.y));
    return { x, y, width: Math.max(...rs.map((r) => r.x + r.w)) - x, height: Math.max(...rs.map((r) => r.y + r.h)) - y };
  }

  /** Breite eines Buttons bei dieser Skalierung (physische Pixel), z. B. um die Spaltenzahl zu wählen. */
  buttonWidth(scale: number): number {
    const labelW = Math.max(...this.entries.map((e) => e.label.setScale(scale).width), 0);
    return Math.round(labelW + 10 * scale * 2 + 8 * scale);
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.armed = false;
  }

  setVisible(on: boolean): void {
    this.visible = on;
    this.armed = false;
    for (const e of this.entries) {
      e.frame.setVisible(on);
      e.label.setVisible(on);
      if (on) e.zone.setInteractive({ useHandCursor: true });
      else e.zone.disableInteractive();
    }
  }

  setFocus(index: number): void {
    const n = this.entries.length;
    if (n === 0) return;
    this.focus = ((index % n) + n) % n;
    this.redraw();
  }

  /** Texte neu holen (z. B. nach Sprach- oder Vollbild-Wechsel). */
  refreshLabels(): void {
    for (const e of this.entries) e.label.setText(e.item.label());
    this.layout(this.cx, this.cy, this.scale, this.minHeightPx, this.columns);
  }

  /**
   * Positioniert das Menü zentriert um (cx, cy).
   * @param scale Art-Pixel-Skalierung
   * @param minHeightPx Mindesthöhe eines Buttons in physischen Pixeln (Daumengröße)
   * @param columns Spalten (zeilenweise gefüllt; die Fokus-Reihenfolge bleibt die der Einträge)
   */
  layout(cx: number, cy: number, scale: number, minHeightPx: number, columns = this.columns): void {
    this.cx = cx;
    this.cy = cy;
    this.scale = scale;
    this.minHeightPx = minHeightPx;
    this.columns = Math.max(1, Math.min(columns, this.entries.length));
    const padX = 10 * scale;
    const padY = 4 * scale;
    for (const e of this.entries) e.label.setScale(scale);
    const labelW = Math.max(...this.entries.map((e) => e.label.width), 0);
    const w = Math.round(labelW + padX * 2 + 8 * scale);
    const h = Math.round(Math.max(minHeightPx, (this.entries[0]?.label.height ?? 10 * scale) + padY * 2));
    const gap = Math.round(3 * scale);
    const cols = this.columns;
    const rows = Math.ceil(this.entries.length / cols);
    const total = rows * h + (rows - 1) * gap;
    const y0 = Math.round(cy - total / 2);
    const gapX = 4 * gap;
    this.entries.forEach((e, i) => {
      const row = Math.floor(i / cols);
      // Letzte, unvollständige Zeile mittig.
      const inRow = Math.min(cols, this.entries.length - row * cols);
      const x = Math.round(cx - (inRow * w + (inRow - 1) * gapX) / 2 + (i % cols) * (w + gapX));
      const y = y0 + row * (h + gap);
      e.rect = { x, y, w, h };
      e.zone.setPosition(x, y).setSize(w, h);
      e.zone.input?.hitArea.setTo(0, 0, w, h);
    });
    this.redraw();
  }

  update(dt: number): void {
    let dirty = false;
    for (const e of this.entries) {
      if (e.squash > 0) {
        e.squash = Math.max(0, e.squash - dt * 6);
        dirty = true;
      }
    }
    if (this.enabled && this.visible && this.entries.length > 0 && !this.armed) {
      this.armed = true;
    } else if (this.enabled && this.visible && this.entries.length > 0) {
      const inp = this.s.input;
      if (this.navUp.update(dt, inp.isDown('uiUp'), inp.justPressed('uiUp'))) this.move(-1);
      if (this.navDown.update(dt, inp.isDown('uiDown'), inp.justPressed('uiDown'))) this.move(1);
      // Mehrspaltig: links/rechts wechselt die Spalte (Reihenfolge der Einträge).
      if (this.columns > 1 && inp.justPressed('uiLeft')) this.move(-1);
      if (this.columns > 1 && inp.justPressed('uiRight')) this.move(1);
      if (inp.justPressed('uiConfirm')) this.activate(this.focus);
    }
    if (dirty) this.redraw();
  }

  destroy(): void {
    for (const e of this.entries) {
      e.frame.destroy();
      e.label.destroy();
      e.zone.destroy();
    }
    this.entries = [];
  }

  private addEntry(item: MenuItem): void {
    const frame = this.scene.add.graphics().setDepth(this.depth);
    const label = new PixelLabel(this.scene, item.label(), { scale: this.scale, color: 'white', shadow: 'ink0', originX: 0.5, originY: 0.5, depth: this.depth + 1 });
    const zone = this.scene.add.zone(0, 0, 10, 10).setOrigin(0, 0).setDepth(this.depth + 2).setInteractive({ useHandCursor: true });
    const entry: Entry = { item, frame, label, zone, rect: { x: 0, y: 0, w: 0, h: 0 }, squash: 0 };
    const index = this.entries.length;
    zone.on('pointerover', (p: Phaser.Input.Pointer) => {
      if (!this.enabled || p.wasTouch) return;
      if (this.focus !== index) {
        this.focus = index;
        this.s.sfx.move();
        this.redraw();
      }
    });
    zone.on('pointerdown', () => {
      if (!this.enabled || !this.visible) return;
      this.pressedIndex = index;
      this.focus = index;
      entry.squash = 1;
      this.redraw();
    });
    zone.on('pointerup', () => {
      if (!this.enabled || !this.visible || this.pressedIndex !== index) return;
      this.pressedIndex = -1;
      this.activate(index);
    });
    this.entries.push(entry);
  }

  private move(dir: number): void {
    this.setFocus(this.focus + dir);
    this.s.sfx.move();
  }

  private activate(index: number): void {
    const e = this.entries[index];
    if (!e) return;
    e.squash = 1;
    this.redraw();
    this.s.sfx.confirm();
    e.item.onSelect();
  }

  private redraw(): void {
    const s = this.scale;
    this.entries.forEach((e, i) => {
      const focused = i === this.focus && this.visible;
      const { x, y, w, h } = e.rect;
      // Squash & Stretch beim Drücken: Button wird kurz breiter und flacher.
      const sq = e.squash;
      const dx = Math.round(sq * 2 * s);
      const dy = Math.round(sq * 1 * s);
      const g = e.frame;
      g.clear();
      const bx = x - dx;
      const by = y + dy;
      const bw = w + dx * 2;
      const bh = h - dy * 2;
      // Pixel-Rahmen: Schatten, Rand, Füllung, Glanzkante.
      g.fillStyle(hex('ink0'), 1).fillRect(bx + s, by + s, bw, bh);
      g.fillStyle(hex(focused ? 'mustard' : 'ink3'), 1).fillRect(bx, by, bw, bh);
      g.fillStyle(hex(focused ? 'ink2' : 'ink1'), 1).fillRect(bx + s, by + s, bw - 2 * s, bh - 2 * s);
      g.fillStyle(hex(focused ? 'mustardDark' : 'ink2'), 1).fillRect(bx + s, by + bh - 2 * s, bw - 2 * s, s);
      if (focused) {
        // Pfeil links als Fokus-Marker.
        const ax = bx + 4 * s;
        const ay = Math.round(by + bh / 2);
        g.fillStyle(hex('mustard'), 1);
        g.fillRect(ax, ay - 2 * s, s, 5 * s);
        g.fillRect(ax + s, ay - s, s, 3 * s);
        g.fillRect(ax + 2 * s, ay, s, s);
      }
      e.label.setColor(focused ? 'mustard' : 'white');
      e.label.setPosition(Math.round(x + w / 2 + 2 * s), Math.round(y + h / 2));
    });
  }
}

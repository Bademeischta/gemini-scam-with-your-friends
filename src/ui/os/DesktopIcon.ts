import Phaser from 'phaser';
import { hex } from '../../config/palette';
import { PixelLabel } from '../PixelLabel';
import type { Rect } from './focusNav';
import { attachPress } from './press';
import type { Host } from './widgets';

export interface DesktopIconOptions {
  id: string;
  texture: string;
  label: string;
  onOpen: () => void;
  onContext: (x: number, y: number) => void;
  /** Ein anderes Symbol wurde angeklickt → Auswahl wechseln. */
  onSelect: (icon: DesktopIcon) => void;
}

/**
 * Symbol auf dem Desktop: Maus = Klick wählt, Doppelklick öffnet; Touch = Tippen öffnet;
 * Rechtsklick bzw. langes Drücken = Kontextmenü; Tastatur/Gamepad über den Fokus.
 */
export class DesktopIcon {
  private readonly img: Phaser.GameObjects.Image;
  private readonly label: PixelLabel;
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly zone: Phaser.GameObjects.Zone;
  private readonly unregister: () => void;
  private rect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private selected = false;
  private lock: Phaser.GameObjects.Image | null = null;
  private lockedDay: number | null = null;

  constructor(
    private readonly host: Host,
    readonly o: DesktopIconOptions,
  ) {
    const sc = host.scene;
    this.g = sc.add.graphics();
    this.img = sc.add.image(0, 0, o.texture);
    host.container.add([this.g, this.img]);
    this.label = new PixelLabel(sc, o.label, { scale: host.u(), color: 'white', shadow: 'ink0', originX: 0.5, align: 'center', container: host.container });
    this.zone = sc.add.zone(0, 0, 1, 1).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    host.container.add(this.zone);
    attachPress(
      sc,
      this.zone,
      {
        onTap: (p, double) => {
          o.onSelect(this);
          if (p.wasTouch || double) o.onOpen();
          else host.s.sfx.move();
        },
        onContext: (p) => {
          o.onSelect(this);
          o.onContext(p.x, p.y);
        },
      },
      () => 8 * host.dpr(),
    );
    this.unregister = host.focus.register({
      id: `icon:${o.id}`,
      scope: host.scope,
      rect: () => this.screenRect(),
      activate: () => o.onOpen(),
      context: () => {
        const r = this.screenRect();
        o.onContext(r.x + r.w / 2, r.y + r.h / 2);
      },
    });
  }

  get id(): string {
    return this.o.id;
  }

  /** Gesperrt bis Tag `day` (OS-10): Symbol abgeblendet, Schloss darüber; null = frei. */
  setLocked(day: number | null): void {
    if (day === this.lockedDay) return;
    this.lockedDay = day;
    this.img.setAlpha(day === null ? 1 : 0.45);
    this.label.setAlpha(day === null ? 1 : 0.6);
    if (day !== null && !this.lock) {
      this.lock = this.host.scene.add.image(0, 0, 'os-icon-lock');
      this.host.container.add(this.lock);
    }
    this.lock?.setVisible(day !== null);
    this.placeLock();
  }

  get locked(): boolean {
    return this.lockedDay !== null;
  }

  private placeLock(): void {
    if (!this.lock) return;
    const s = Math.max(1, Math.round(this.img.scaleX * 0.6));
    this.lock.setScale(s).setPosition(Math.round(this.img.x + (this.img.width * this.img.scaleX) / 2 - 4 * s), Math.round(this.img.y + (this.img.height * this.img.scaleY) / 2 - 4 * s));
  }

  /** Breite der Beschriftung in einer Zeile (physische Pixel) bei Schriftgröße `u`. */
  labelWidth(u: number): number {
    this.label.setScale(u).setMaxWidth(0);
    return this.label.width;
  }

  setTexture(key: string): void {
    this.img.setTexture(key);
  }

  setSelected(on: boolean): void {
    this.selected = on;
    this.draw();
  }

  screenRect(): Rect {
    const o = this.host.origin();
    return { x: o.x + this.rect.x, y: o.y + this.rect.y, w: this.rect.w, h: this.rect.h };
  }

  /** Zelle (lokal): Symbol oben mittig, Beschriftung darunter (umbrechend). */
  layout(x: number, y: number, w: number, h: number, iconScale: number): void {
    this.rect = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
    const u = this.host.u();
    this.img.setScale(iconScale).setPosition(Math.round(x + w / 2), Math.round(y + 2 * u + (16 * iconScale) / 2));
    this.label.setScale(u).setMaxWidth(w - 2 * u).setPosition(Math.round(x + w / 2), Math.round(y + 4 * u + 16 * iconScale));
    this.zone.setPosition(this.rect.x, this.rect.y).setSize(this.rect.w, this.rect.h);
    this.zone.input?.hitArea.setTo(0, 0, this.rect.w, this.rect.h);
    this.placeLock();
    this.draw();
  }

  destroy(): void {
    this.unregister();
    this.g.destroy();
    this.img.destroy();
    this.label.destroy();
    this.lock?.destroy();
    this.zone.destroy();
  }

  private draw(): void {
    const g = this.g;
    g.clear();
    if (!this.selected) return;
    const t = this.host.theme();
    const { x, y, w, h } = this.rect;
    g.fillStyle(hex(t.selection), 0.75).fillRect(x, y, w, h);
    g.lineStyle(this.host.u(), hex(t.accent), 0.9).strokeRect(x, y, w, h);
  }
}

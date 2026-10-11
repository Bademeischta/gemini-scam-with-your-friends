import Phaser from 'phaser';
import { hex } from '../../config/palette';
import { PixelLabel } from '../PixelLabel';
import type { Rect } from './focusNav';
import { rootHost, type HostBase } from './host';
import { drawBevel, OsButton, type Host } from './widgets';

export interface PopupEntry {
  id: string;
  label: string;
  icon?: string;
  onSelect: () => void;
  /** Trennlinie davor. */
  separator?: boolean;
}

export interface PopupOptions {
  scope: string;
  depth: number;
  /** Überschrift (z. B. „MogelOS“ im Startmenü). */
  header?: string;
  entries: PopupEntry[];
  onClose: () => void;
}

/**
 * Aufklappmenü (Startmenü, Kontextmenü): Liste von Einträgen über einer unsichtbaren Fläche,
 * die bei einem Klick daneben schließt. Bedienbar per Maus, Touch, Tastatur und Gamepad.
 */
export class PopupMenu {
  private readonly blocker: Phaser.GameObjects.Zone;
  private readonly container: Phaser.GameObjects.Container;
  private readonly host: Host & { moved(): void };
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly header: PixelLabel | null;
  private readonly buttons: OsButton[] = [];
  private readonly panelZone: Phaser.GameObjects.Zone;
  private bounds: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private closed = false;

  constructor(
    private readonly base: HostBase,
    private readonly o: PopupOptions,
  ) {
    const sc = base.scene;
    this.blocker = sc.add.zone(0, 0, sc.scale.width, sc.scale.height).setOrigin(0, 0).setDepth(o.depth - 1).setInteractive();
    this.blocker.on('pointerdown', () => this.close());
    this.container = sc.add.container(0, 0).setDepth(o.depth);
    this.host = rootHost(base, this.container, o.scope);
    this.g = sc.add.graphics();
    this.container.add(this.g);
    // Klicks auf den Rand des Menüs sollen nicht „durchfallen“.
    this.panelZone = sc.add.zone(0, 0, 1, 1).setOrigin(0, 0).setInteractive();
    this.container.add(this.panelZone);
    this.header = o.header ? new PixelLabel(sc, o.header, { scale: base.u(), color: 'white', shadow: null, originY: 0.5, container: this.container }) : null;
    for (const e of o.entries) {
      this.buttons.push(
        new OsButton(this.host, `${o.scope}:${e.id}`, {
          label: e.label,
          icon: e.icon,
          iconScale: Math.max(1, Math.round(base.u() / 2)),
          variant: 'flat',
          align: 'left',
          onClick: () => {
            this.close(true);
            e.onSelect();
          },
        }),
      );
    }
  }

  get isClosed(): boolean {
    return this.closed;
  }

  /** Größe, die das Menü braucht (physische Pixel). */
  measure(minW = 0): { w: number; h: number } {
    const u = this.base.u();
    const rowH = this.rowH();
    let w = minW;
    for (const b of this.buttons) w = Math.max(w, b.preferredWidth() + 4 * u);
    if (this.header) w = Math.max(w, this.header.width + 12 * u);
    const seps = this.o.entries.filter((e) => e.separator).length;
    const h = (this.header ? rowH + 2 * u : 0) + this.buttons.length * rowH + seps * 3 * u + 4 * u;
    return { w: Math.ceil(w), h: Math.ceil(h) };
  }

  /**
   * Menü an eine Stelle legen. `anchor`: Ecke, an der das Menü hängt
   * ('top-left' = Kontextmenü am Zeiger, 'bottom-left' = Startmenü über dem Start-Button).
   */
  place(x: number, y: number, anchor: 'top-left' | 'bottom-left', screen: Rect, minW = 0): void {
    const u = this.base.u();
    const { w, h } = this.measure(minW);
    let px = x;
    let py = anchor === 'top-left' ? y : y - h;
    px = Phaser.Math.Clamp(px, screen.x, Math.max(screen.x, screen.x + screen.w - w));
    py = Phaser.Math.Clamp(py, screen.y, Math.max(screen.y, screen.y + screen.h - h));
    this.bounds = { x: Math.round(px), y: Math.round(py), w, h: Math.min(h, screen.h) };
    this.container.setPosition(this.bounds.x, this.bounds.y);
    this.host.moved();
    this.blocker.setSize(this.base.scene.scale.width, this.base.scene.scale.height);
    this.blocker.input?.hitArea.setTo(0, 0, this.base.scene.scale.width, this.base.scene.scale.height);
    this.panelZone.setSize(w, h);
    this.panelZone.input?.hitArea.setTo(0, 0, w, h);
    const t = this.base.theme();
    this.g.clear();
    this.g.fillStyle(hex('ink0'), 0.5).fillRect(2 * u, 2 * u, w, h);
    drawBevel(this.g, 0, 0, w, h, u, t.window, t.frameLight, t.windowDark);
    const rowH = this.rowH();
    let cy = 2 * u;
    if (this.header) {
      this.g.fillStyle(hex(t.title), 1).fillRect(2 * u, 2 * u, w - 4 * u, rowH);
      this.header.setScale(u).setColor(t.titleText).setPosition(6 * u, Math.round(cy + rowH / 2));
      cy += rowH + 2 * u;
    }
    this.o.entries.forEach((e, i) => {
      if (e.separator) {
        this.g.fillStyle(hex(t.buttonDark), 1).fillRect(4 * u, cy + u, w - 8 * u, u);
        cy += 3 * u;
      }
      this.buttons[i]?.layout(2 * u, cy, w - 4 * u, rowH);
      cy += rowH;
    });
  }

  /** Erstes Element für den Tastatur-/Gamepad-Fokus. */
  get firstId(): string | undefined {
    const e = this.o.entries[0];
    return e ? `${this.o.scope}:${e.id}` : undefined;
  }

  rect(): Rect {
    return { ...this.bounds };
  }

  /** Schließen; `silent` = nach einer Auswahl (der Button hat schon geklickt). */
  close(silent = false): void {
    if (this.closed) return;
    this.closed = true;
    if (!silent) this.base.s.sfx.back();
    this.destroy();
    this.o.onClose();
  }

  destroy(): void {
    for (const b of this.buttons) b.destroy();
    this.buttons.length = 0;
    this.blocker.destroy();
    this.container.destroy(true);
  }

  private rowH(): number {
    return Math.max(12 * this.base.u(), Math.round((this.base.s.device.hintMode === 'touch' ? 44 : 30) * this.base.dpr()));
  }
}

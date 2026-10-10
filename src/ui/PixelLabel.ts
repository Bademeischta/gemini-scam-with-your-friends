import Phaser from 'phaser';
import { hex, type PaletteName } from '../config/palette';
import { PIXEL_FONT } from '../gfx/pixelFont';

export interface PixelLabelOptions {
  scale: number;
  color?: PaletteName;
  /** Schattenfarbe (1 Art-Pixel nach rechts unten) oder null für keinen Schatten. */
  shadow?: PaletteName | null;
  /** Ursprung wie bei Phaser (0 = links/oben, 0.5 = Mitte, 1 = rechts/unten). */
  originX?: number;
  originY?: number;
  align?: 'left' | 'center' | 'right';
  depth?: number;
  /** Optional: in diesen Container einhängen (Positionen sind dann lokal). */
  container?: Phaser.GameObjects.Container;
}

/**
 * Text in der Pixel-Schrift mit ganzzahliger Skalierung (scharf auf jedem Display)
 * und optionalem Pixel-Schatten.
 */
export class PixelLabel {
  readonly main: Phaser.GameObjects.BitmapText;
  readonly shadow: Phaser.GameObjects.BitmapText | null;
  private _scale: number;
  private ox: number;
  private oy: number;
  private x = 0;
  private y = 0;

  constructor(scene: Phaser.Scene, text: string, opts: PixelLabelOptions) {
    this._scale = Math.max(1, Math.round(opts.scale));
    this.ox = opts.originX ?? 0;
    this.oy = opts.originY ?? 0;
    const align = opts.align === 'center' ? 1 : opts.align === 'right' ? 2 : 0;
    this.shadow =
      opts.shadow === null
        ? null
        : scene.add.bitmapText(0, 0, PIXEL_FONT, text, undefined, align).setTint(hex(opts.shadow ?? 'ink0'));
    this.main = scene.add.bitmapText(0, 0, PIXEL_FONT, text, undefined, align).setTint(hex(opts.color ?? 'white'));
    if (opts.depth !== undefined) {
      this.shadow?.setDepth(opts.depth);
      this.main.setDepth(opts.depth);
    }
    if (opts.container) {
      if (this.shadow) opts.container.add(this.shadow);
      opts.container.add(this.main);
    }
    this.applyScale();
  }

  get scale(): number {
    return this._scale;
  }

  get width(): number {
    return this.main.width;
  }

  get height(): number {
    return this.main.height;
  }

  setText(text: string): this {
    if (this.main.text !== text) {
      this.main.setText(text);
      this.shadow?.setText(text);
      this.place();
    }
    return this;
  }

  setColor(color: PaletteName): this {
    this.main.setTint(hex(color));
    return this;
  }

  setScale(scale: number): this {
    this._scale = Math.max(1, Math.round(scale));
    this.applyScale();
    return this;
  }

  setOrigin(ox: number, oy: number): this {
    this.ox = ox;
    this.oy = oy;
    this.place();
    return this;
  }

  setPosition(x: number, y: number): this {
    this.x = x;
    this.y = y;
    this.place();
    return this;
  }

  setAlpha(a: number): this {
    this.main.setAlpha(a);
    this.shadow?.setAlpha(a);
    return this;
  }

  /** Maximale Breite (physische Pixel, Phaser rechnet skaliert) für Zeilenumbruch; 0 = kein Umbruch. */
  setMaxWidth(px: number): this {
    const w = px > 0 ? Math.floor(px) : 0;
    this.main.setMaxWidth(w);
    this.shadow?.setMaxWidth(w);
    this.place();
    return this;
  }

  setVisible(v: boolean): this {
    this.main.setVisible(v);
    this.shadow?.setVisible(v);
    return this;
  }

  setDepth(d: number): this {
    this.main.setDepth(d);
    this.shadow?.setDepth(d);
    return this;
  }

  destroy(): void {
    this.main.destroy();
    this.shadow?.destroy();
  }

  private applyScale(): void {
    this.main.setScale(this._scale);
    this.shadow?.setScale(this._scale);
    this.place();
  }

  /** Position immer auf ganze physische Pixel runden, damit nichts verschwimmt. */
  private place(): void {
    const left = Math.round(this.x - this.main.width * this.ox);
    const top = Math.round(this.y - this.main.height * this.oy);
    this.main.setPosition(left, top);
    this.shadow?.setPosition(left + this._scale, top + this._scale);
  }
}

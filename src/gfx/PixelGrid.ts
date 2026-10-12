import { PALETTE, type PaletteName } from '../config/palette';

export type Px = PaletteName | null;

/**
 * Kleines Pixel-Raster mit Palettenfarben – die Leinwand für alle prozeduralen Sprites.
 * Rein in TypeScript (ohne Canvas), damit Grafiken testbar sind; `drawTo` überträgt es in einen 2D-Kontext.
 */
export class PixelGrid {
  readonly px: Px[];

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.px = new Array<Px>(w * h).fill(null);
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  get(x: number, y: number): Px {
    return this.inside(x, y) ? (this.px[y * this.w + x] ?? null) : null;
  }

  set(x: number, y: number, c: Px): this {
    if (this.inside(x, y)) this.px[y * this.w + x] = c;
    return this;
  }

  rect(x: number, y: number, w: number, h: number, c: Px): this {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c);
    return this;
  }

  /** Rechteck-Rahmen (1 px). */
  frame(x: number, y: number, w: number, h: number, c: Px): this {
    this.hline(x, y, w, c).hline(x, y + h - 1, w, c).vline(x, y, h, c).vline(x + w - 1, y, h, c);
    return this;
  }

  hline(x: number, y: number, len: number, c: Px): this {
    return this.rect(x, y, len, 1, c);
  }

  vline(x: number, y: number, len: number, c: Px): this {
    return this.rect(x, y, 1, len, c);
  }

  /** Schachbrett-Dithering: Farbe `c` auf jedes zweite Pixel (Parität 0 oder 1). */
  dither(x: number, y: number, w: number, h: number, c: Px, parity = 0): this {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if ((xx + yy) % 2 === parity) this.set(xx, yy, c);
    return this;
  }

  /** Gefüllter Kreis (Mittelpunkt + Radius, pixelig). */
  disc(cx: number, cy: number, r: number, c: Px): this {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) this.set(cx + x, cy + y, c);
    return this;
  }

  /** Text-Raster einstempeln ('.' = transparent). */
  stamp(x: number, y: number, art: readonly string[], legend: Readonly<Record<string, PaletteName>>): this {
    art.forEach((row, yy) => {
      for (let xx = 0; xx < row.length; xx++) {
        const ch = row[xx];
        if (ch && ch !== '.' && legend[ch]) this.set(x + xx, y + yy, legend[ch]);
      }
    });
    return this;
  }

  /** Umriss: jedes leere Pixel neben einem gefüllten bekommt die Umrissfarbe (4er-Nachbarschaft). */
  outline(c: PaletteName = 'ink0'): this {
    const add: number[] = [];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y) !== null) continue;
        if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)) add.push(y * this.w + x);
      }
    for (const i of add) this.px[i] = c;
    return this;
  }

  /** Spiegelt horizontal (z. B. Blick nach links ↔ rechts). */
  mirrored(): PixelGrid {
    const g = new PixelGrid(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) g.set(this.w - 1 - x, y, this.get(x, y));
    return g;
  }

  /** Kopiert ein anderes Raster hinein (transparente Pixel bleiben unberührt). */
  blit(src: PixelGrid, dx: number, dy: number): this {
    for (let y = 0; y < src.h; y++)
      for (let x = 0; x < src.w; x++) {
        const c = src.get(x, y);
        if (c) this.set(dx + x, dy + y, c);
      }
    return this;
  }

  countFilled(): number {
    return this.px.reduce((n, c) => n + (c ? 1 : 0), 0);
  }

  drawTo(ctx: CanvasRenderingContext2D, ox: number, oy: number, scale = 1): void {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const c = this.px[y * this.w + x];
        if (!c) continue;
        ctx.fillStyle = PALETTE[c];
        ctx.fillRect(ox + x * scale, oy + y * scale, scale, scale);
      }
  }
}

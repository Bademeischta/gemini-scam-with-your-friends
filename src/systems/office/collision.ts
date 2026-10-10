/**
 * Kollision im Büro: feste Kacheln (Wände) plus Rechtecke (Möbel, Glaswände).
 * Bewegung wird achsenweise und in kleinen Teilschritten aufgelöst, damit nichts „durchtunnelt“
 * und man an Kanten entlanggleiten kann.
 */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export class CollisionWorld {
  private readonly boxes: Rect[];
  private readonly cell = 32;
  private readonly grid = new Map<string, number[]>();

  constructor(
    private readonly isSolidTile: (tx: number, ty: number) => boolean,
    boxes: readonly Rect[],
    private readonly tile: number,
    readonly bounds: Rect,
  ) {
    this.boxes = [...boxes];
    this.boxes.forEach((b, i) => {
      for (const key of this.cellsFor(b)) {
        const list = this.grid.get(key);
        if (list) list.push(i);
        else this.grid.set(key, [i]);
      }
    });
  }

  /** Liegt ein Rechteck (ganz oder teilweise) in Wand oder Möbel? */
  blocked(r: Rect): boolean {
    if (r.x < this.bounds.x || r.y < this.bounds.y || r.x + r.w > this.bounds.x + this.bounds.w || r.y + r.h > this.bounds.y + this.bounds.h) {
      return true;
    }
    const t = this.tile;
    const tx0 = Math.floor(r.x / t);
    const ty0 = Math.floor(r.y / t);
    const tx1 = Math.floor((r.x + r.w - 1e-6) / t);
    const ty1 = Math.floor((r.y + r.h - 1e-6) / t);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) if (this.isSolidTile(tx, ty)) return true;
    const seen = new Set<number>();
    for (const key of this.cellsFor(r)) {
      for (const i of this.grid.get(key) ?? []) {
        if (seen.has(i)) continue;
        seen.add(i);
        if (overlaps(r, this.boxes[i]!)) return true;
      }
    }
    return false;
  }

  /**
   * Verschiebt eine Hitbox (relativ zu den Füßen) um (dx, dy) und stoppt an Hindernissen.
   * Rückgabe: neue Fußposition und ob auf x bzw. y blockiert wurde.
   */
  move(
    feet: { x: number; y: number },
    hitbox: { w: number; h: number },
    dx: number,
    dy: number,
  ): { x: number; y: number; hitX: boolean; hitY: boolean } {
    let { x, y } = feet;
    let hitX = false;
    let hitY = false;
    const rectAt = (fx: number, fy: number): Rect => ({ x: fx - hitbox.w / 2, y: fy - hitbox.h, w: hitbox.w, h: hitbox.h });
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 2));
    const sx = dx / steps;
    const sy = dy / steps;
    for (let i = 0; i < steps; i++) {
      if (sx !== 0 && !hitX) {
        if (this.blocked(rectAt(x + sx, y))) hitX = true;
        else x += sx;
      }
      if (sy !== 0 && !hitY) {
        if (this.blocked(rectAt(x, y + sy))) hitY = true;
        else y += sy;
      }
    }
    return { x, y, hitX, hitY };
  }

  private *cellsFor(r: Rect): Generator<string> {
    const c = this.cell;
    for (let cy = Math.floor(r.y / c); cy <= Math.floor((r.y + r.h) / c); cy++)
      for (let cx = Math.floor(r.x / c); cx <= Math.floor((r.x + r.w) / c); cx++) yield `${cx},${cy}`;
  }
}

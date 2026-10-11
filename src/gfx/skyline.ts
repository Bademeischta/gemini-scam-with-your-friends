import { PALETTE, type PaletteName } from '../config/palette';
import { Rng } from '../systems/rng/rng';

/**
 * Prozedurale Nacht-Skyline von Schwindelheim für den Titelbildschirm (Pixel-Art).
 * Liefert neben dem Bild die Fenster und Sterne, damit sie animiert werden können.
 */
export interface SkyWindow {
  x: number;
  y: number;
  w: number;
  h: number;
  lit: boolean;
  litColor: PaletteName;
  layer: 0 | 1;
}

export interface SkyStar {
  x: number;
  y: number;
  bright: boolean;
}

export interface SkyBuilding {
  x: number;
  w: number;
  h: number;
  layer: 0 | 1;
  antenna: boolean;
}

export interface SkylineModel {
  width: number;
  height: number;
  buildings: SkyBuilding[];
  windows: SkyWindow[];
  stars: SkyStar[];
  /** Fenster des Hinterhof-Callcenters (immer beleuchtet, mit Silhouetten). */
  office: { x: number; y: number; w: number; h: number };
}

const SKY_BANDS: PaletteName[] = ['ink0', 'ink1', 'ink2', 'navy'];

/** Schwellwerte für geordnetes Dithering (0–1). */
const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((row) => row.map((v) => (v + 0.5) / 16));

/** Entwirft die Szene (ohne Zeichnen) – deterministisch je Seed. */
export function designSkyline(width: number, height: number, seed = 7): SkylineModel {
  const rng = new Rng(seed);
  const buildings: SkyBuilding[] = [];
  const windows: SkyWindow[] = [];
  const stars: SkyStar[] = [];
  const horizon = Math.round(height * 0.62);
  for (let i = 0; i < Math.round((width * horizon) / 260); i++) {
    stars.push({ x: rng.int(0, width - 1), y: rng.int(0, Math.max(1, horizon - 20)), bright: rng.chance(0.25) });
  }
  // Callcenter-Gebäude mittig-unten.
  const ow = Math.min(width - 8, Math.max(46, Math.round(width * 0.22)));
  const oh = Math.round(height * 0.3);
  const office = { x: Math.round(width / 2 - ow / 2), y: height - oh, w: ow, h: oh };
  // Hintere und vordere Häuserreihe.
  for (const layer of [0, 1] as const) {
    let x = -rng.int(0, 6);
    while (x < width) {
      const bw = rng.int(12, 26) + layer * 4;
      const bh = Math.round(height * (layer === 0 ? rng.range(0.25, 0.48) : rng.range(0.14, 0.3)));
      const top = height - bh;
      buildings.push({ x, w: bw, h: bh, layer, antenna: layer === 0 && rng.chance(0.3) });
      const overlapsOffice = layer === 1 && x + bw > office.x - 2 && x < office.x + office.w + 2;
      if (!overlapsOffice) {
        for (let wy = top + 3; wy < height - 3; wy += 4) {
          for (let wx = x + 2; wx < x + bw - 3; wx += 4) {
            if (rng.chance(0.85)) {
              windows.push({
                x: wx,
                y: wy,
                w: 2,
                h: 2,
                lit: rng.chance(layer === 0 ? 0.25 : 0.35),
                litColor: rng.pick<PaletteName>(['mustard', 'amber', 'sand', 'mustard']),
                layer,
              });
            }
          }
        }
      }
      x += bw + rng.int(0, 2);
    }
  }
  // Fenster der hinteren Reihe, die von vorderen Häusern oder dem Callcenter verdeckt werden, entfallen.
  const covers = (b: { x: number; w: number; top: number }, w: SkyWindow): boolean =>
    w.x + w.w > b.x && w.x < b.x + b.w && w.y + w.h > b.top;
  const front = [
    ...buildings.filter((b) => b.layer === 1).map((b) => ({ x: b.x, w: b.w, top: height - b.h })),
    { x: office.x - 1, w: office.w + 2, top: office.y - 2 },
  ];
  const visible = windows.filter((w) => w.layer === 1 || !front.some((b) => covers(b, w)));
  return { width, height, buildings, windows: visible, stars, office };
}

/** Zeichnet das komplette Bild in einen 2D-Kontext (1 Canvas-Pixel = 1 Art-Pixel). */
export function drawSkyline(ctx: CanvasRenderingContext2D, model: SkylineModel): void {
  const { width, height, office } = model;
  // Himmel als Verlauf über Palettenfarben mit geordnetem Dithering (Bayer 4×4).
  const skyH = Math.max(1, Math.round(height * 0.72));
  const steps = SKY_BANDS.length - 1;
  for (let y = 0; y < height; y++) {
    const tY = Math.min(1, y / skyH) * steps;
    const i0 = Math.min(steps, Math.floor(tY));
    const frac = tY - i0;
    const c0 = PALETTE[SKY_BANDS[i0]!];
    const c1 = PALETTE[SKY_BANDS[Math.min(steps, i0 + 1)]!];
    ctx.fillStyle = c0;
    ctx.fillRect(0, y, width, 1);
    if (frac <= 0) continue;
    ctx.fillStyle = c1;
    for (let x = 0; x < width; x++) if (frac > BAYER4[y % 4]![x % 4]!) ctx.fillRect(x, y, 1, 1);
  }
  // Mond.
  const mx = Math.round(width * 0.82);
  const my = Math.round(height * 0.16);
  ctx.fillStyle = PALETTE.paper;
  for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) if (x * x + y * y <= 26) ctx.fillRect(mx + x, my + y, 1, 1);
  ctx.fillStyle = PALETTE.fog;
  ctx.fillRect(mx - 2, my - 1, 2, 2);
  ctx.fillRect(mx + 2, my + 2, 1, 1);
  // Gebäude (ohne Fenster) – Fenster werden separat gezeichnet.
  for (const b of model.buildings) {
    ctx.fillStyle = b.layer === 0 ? PALETTE.ink1 : PALETTE.ink0;
    ctx.fillRect(b.x, height - b.h, b.w, b.h);
    if (b.antenna) ctx.fillRect(b.x + Math.round(b.w / 2), height - b.h - 4, 1, 4);
  }
  // Hinterhof-Callcenter mit warm beleuchteter Fensterfront und Silhouetten an Schreibtischen.
  ctx.fillStyle = PALETTE.cocoa;
  ctx.fillRect(office.x, office.y, office.w, office.h);
  ctx.fillStyle = PALETTE.ink0;
  ctx.fillRect(office.x - 1, office.y - 2, office.w + 2, 2);
  const fy = office.y + 5;
  const fh = Math.max(6, Math.round(office.h * 0.35));
  ctx.fillStyle = PALETTE.amber;
  ctx.fillRect(office.x + 3, fy, office.w - 6, fh);
  ctx.fillStyle = PALETTE.mustard;
  ctx.fillRect(office.x + 3, fy, office.w - 6, 2);
  ctx.fillStyle = PALETTE.ink1;
  for (let sx = office.x + 6; sx < office.x + office.w - 8; sx += 9) {
    ctx.fillRect(sx, fy + fh - 5, 3, 5); // Körper
    ctx.fillRect(sx, fy + fh - 8, 3, 3); // Kopf
    ctx.fillRect(sx + 3, fy + fh - 7, 2, 1); // Hörer
    ctx.fillRect(sx + 5, fy + fh - 3, 3, 3); // Monitor
  }
  ctx.fillStyle = PALETTE.ink0;
  for (let sx = office.x + 3; sx < office.x + office.w - 3; sx += 12) ctx.fillRect(sx, fy, 1, fh); // Fensterrahmen
  // Tür.
  ctx.fillStyle = PALETTE.ink0;
  ctx.fillRect(Math.round(office.x + office.w / 2 - 3), office.y + office.h - 9, 6, 9);
  ctx.fillStyle = PALETTE.mustardDark;
  ctx.fillRect(Math.round(office.x + office.w / 2 + 1), office.y + office.h - 5, 1, 1);
  drawWindows(ctx, model);
  drawStars(ctx, model);
}

export function drawWindows(ctx: CanvasRenderingContext2D, model: SkylineModel): void {
  for (const w of model.windows) {
    ctx.fillStyle = w.lit ? PALETTE[w.litColor] : PALETTE.ink2;
    ctx.fillRect(w.x, w.y, w.w, w.h);
  }
}

export function drawStars(ctx: CanvasRenderingContext2D, model: SkylineModel, twinkle?: (s: SkyStar) => boolean): void {
  for (const s of model.stars) {
    const on = twinkle ? twinkle(s) : true;
    ctx.fillStyle = on ? (s.bright ? PALETTE.white : PALETTE.fog) : PALETTE.ink3;
    ctx.fillRect(s.x, s.y, 1, 1);
  }
}

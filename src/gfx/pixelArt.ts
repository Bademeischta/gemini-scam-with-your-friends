import { PALETTE, type PaletteName } from '../config/palette';

/**
 * Pixel-Art als Text-Raster: jedes Zeichen ist ein Art-Pixel, '.' ist transparent.
 * Die Legende ordnet Zeichen Palettenfarben zu.
 */
export type ArtGrid = readonly string[];
export type Legend = Readonly<Record<string, PaletteName>>;

export function artSize(art: ArtGrid): { width: number; height: number } {
  return { width: Math.max(0, ...art.map((r) => r.length)), height: art.length };
}

export function validateArt(art: ArtGrid, legend: Legend): void {
  const { width } = artSize(art);
  art.forEach((row, y) => {
    if (row.length !== width) throw new Error(`Art-Zeile ${y}: Breite ${row.length} statt ${width}`);
    for (const c of row) if (c !== '.' && !(c in legend)) throw new Error(`Art-Zeile ${y}: unbekanntes Zeichen '${c}'`);
  });
}

/** Zeichnet Pixel-Art in einen 2D-Kontext (ganzzahlige Skalierung, scharfe Kanten). */
export function drawArt(ctx: CanvasRenderingContext2D, art: ArtGrid, legend: Legend, ox: number, oy: number, scale = 1): void {
  art.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      if (c === undefined || c === '.') continue;
      const name = legend[c];
      if (!name) continue;
      ctx.fillStyle = PALETTE[name];
      ctx.fillRect(ox + x * scale, oy + y * scale, scale, scale);
    }
  });
}

/** Hörer eines alten Bürotelefons (20×11), Markenzeichen des Spiels. */
export const HANDSET_ART: ArtGrid = [
  '....kkkkkkkkkkkk....',
  '..kkrrrrrrrrrrrrkk..',
  '.krrwwwwrrrrrrrrrrk.',
  'krrwrrrrrrrrrrrrrrrk',
  'krrrkkkkkkkkkkkkrrrk',
  'krrrk..........krrrk',
  'krrrk..........krrrk',
  'kRrrrk........kRrrrk',
  'kRRrrrk......kRRrrrk',
  '.kRRRRk......kRRRRk.',
  '..kkkkk......kkkkk..',
];

export const HANDSET_LEGEND: Legend = { k: 'ink0', r: 'red', R: 'wine', w: 'blush' };

import { rgb, type PaletteName } from '../config/palette';
import { HANDSET_ART, HANDSET_LEGEND } from './pixelArt';

/**
 * App-Icon als Pixel-Art (32×32 Art-Pixel), rein in Code – ohne Canvas, damit es auch
 * im Build-Skript (Node) läuft. Ergebnis: RGBA-Puffer beliebiger Zielgröße.
 */
export const ICON_ART_SIZE = 32;

type Px = PaletteName | null;

function iconGrid(maskable: boolean): Px[][] {
  const n = ICON_ART_SIZE;
  const g: Px[][] = Array.from({ length: n }, () => Array<Px>(n).fill(maskable ? 'mustard' : null));
  const r = 4; // Eckenradius in Art-Pixeln
  const inRounded = (x: number, y: number): boolean => {
    const cx = x < r ? r - 0.5 : x > n - 1 - r ? n - 1 - r + 0.5 : x;
    const cy = y < r ? r - 0.5 : y > n - 1 - r ? n - 1 - r + 0.5 : y;
    return Math.hypot(x - cx, y - cy) <= r;
  };
  if (!maskable) {
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        if (!inRounded(x, y)) continue;
        const edge = !inRounded(x - 1, y) || !inRounded(x + 1, y) || !inRounded(x, y - 1) || !inRounded(x, y + 1);
        g[y]![x] = edge ? 'mustardDark' : 'mustard';
      }
  }
  // Hörer mittig, leicht unterhalb der Mitte.
  const ox = 6;
  const oy = 14;
  HANDSET_ART.forEach((row, y) => {
    [...row].forEach((c, x) => {
      const name = HANDSET_LEGEND[c];
      if (name) g[oy + y]![ox + x] = name;
    });
  });
  // Klingel-Striche über dem Hörer.
  const ring: [number, number][] = [
    [15, 6], [16, 6], [15, 7], [16, 7], [15, 8], [16, 8],
    [9, 7], [10, 8], [11, 9],
    [22, 7], [21, 8], [20, 9],
    [6, 10], [7, 11],
    [25, 10], [24, 11],
  ];
  for (const [x, y] of ring) g[y]![x] = 'ink0';
  return g;
}

/**
 * Rendert das Icon als RGBA (Nearest Neighbor, ganzzahlige Skalierung, zentriert).
 * `maskable`: vollflächiger Hintergrund, Motiv in der sicheren Zone (80 %).
 */
export function renderIconRGBA(size: number, maskable: boolean): Uint8Array {
  const out = new Uint8Array(size * size * 4);
  const grid = iconGrid(maskable);
  const usable = maskable ? size * 0.8 : size;
  const scale = Math.max(1, Math.floor(usable / ICON_ART_SIZE));
  const artPx = ICON_ART_SIZE * scale;
  const off = Math.floor((size - artPx) / 2);
  if (maskable) {
    const [r, g, b] = rgb('mustard');
    for (let i = 0; i < size * size; i++) out.set([r, g, b, 255], i * 4);
  }
  for (let y = 0; y < ICON_ART_SIZE; y++)
    for (let x = 0; x < ICON_ART_SIZE; x++) {
      const name = grid[y]![x];
      if (!name) continue;
      const [r, g, b] = rgb(name);
      for (let sy = 0; sy < scale; sy++)
        for (let sx = 0; sx < scale; sx++) {
          const px = off + x * scale + sx;
          const py = off + y * scale + sy;
          out.set([r, g, b, 255], (py * size + px) * 4);
        }
    }
  return out;
}

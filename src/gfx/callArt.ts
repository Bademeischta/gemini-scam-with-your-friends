import { PixelGrid } from './PixelGrid';

/** Pixel-Art rund ums Telefonieren: klingelndes Telefon, Klingel-Blase, Richtungspfeil. */

/** Hörer, der beim Klingeln hüpft (Überlagerung auf dem Tisch-Telefon). */
export function buildRingHandset(): PixelGrid {
  const g = new PixelGrid(8, 4);
  g.rect(0, 1, 8, 2, 'red').hline(1, 0, 6, 'rose').set(0, 3, 'wine').set(7, 3, 'wine');
  return g.outline('ink0');
}

/** Klingel-Wellen links und rechts vom Telefon. */
export function buildRingWaves(): PixelGrid {
  const g = new PixelGrid(14, 7);
  for (const [x, y] of [[1, 1], [0, 2], [0, 3], [0, 4], [1, 5], [3, 2], [3, 3], [3, 4]] as const) g.set(x, y, 'mustard');
  for (const [x, y] of [[12, 1], [13, 2], [13, 3], [13, 4], [12, 5], [10, 2], [10, 3], [10, 4]] as const) g.set(x, y, 'mustard');
  return g;
}

/** Sprechblase mit Ausrufezeichen über einem klingelnden Platz (gut sichtbar aus der Ferne). */
export function buildRingBubble(): PixelGrid {
  const g = new PixelGrid(11, 13);
  g.rect(1, 0, 9, 10, 'mustard').rect(0, 1, 11, 8, 'mustard').hline(2, 1, 6, 'sand');
  g.rect(4, 10, 3, 1, 'mustard').set(5, 11, 'mustard');
  g.rect(5, 2, 1, 4, 'ink0').set(5, 7, 'ink0');
  return g.outline('ink0');
}

/** Pfeil zum klingelnden Telefon (zeigt nach rechts, wird gedreht). */
export function buildRingArrow(): PixelGrid {
  const g = new PixelGrid(14, 13);
  g.rect(0, 5, 8, 3, 'mustard');
  for (let i = 0; i < 6; i++) g.vline(8 + i, 1 + i, 11 - 2 * i, 'mustard');
  g.hline(0, 5, 8, 'sand');
  return g.outline('ink0');
}

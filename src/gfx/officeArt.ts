import type { OfficeSprite } from '../data/office';
import { OFFICE_MAP, SPRITE_SIZE, TILE } from '../data/office';
import { Rng } from '../systems/rng/rng';
import { PixelGrid } from './PixelGrid';

/**
 * Pixel-Art des Büros, komplett per Code: Bodenkacheln, Wände und alle Möbel.
 * Nachtschicht-Stimmung: gedämpfte Wände, leuchtende Monitore, warme Akzente.
 */

// ---------------------------------------------------------------- Boden & Wände

function paintTile(g: PixelGrid, ch: string, ox: number, oy: number, tx: number, ty: number, rng: Rng): void {
  const T = TILE;
  switch (ch) {
    case '.': {
      g.rect(ox, oy, T, T, 'ink2');
      for (let y = 0; y < T; y += 4) for (let x = (y / 4) % 2 === 0 ? 0 : 2; x < T; x += 4) g.set(ox + x, oy + y, 'ink3');
      if (rng.chance(0.18)) g.set(ox + rng.int(1, 14), oy + rng.int(1, 14), 'slate');
      break;
    }
    case ':': {
      for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) g.set(ox + x, oy + y, (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0 ? 'slate' : 'ink3');
      g.hline(ox, oy, T, 'fog');
      break;
    }
    case ',': {
      g.rect(ox, oy, T, T, 'coffee');
      for (let y = 0; y < T; y += 4) {
        g.hline(ox, oy + y + 3, T, 'cocoa');
        const seam = ((ty * 4 + y / 4) * 7 + tx * 5) % T;
        g.set(ox + seam, oy + y, 'cocoa').set(ox + seam, oy + y + 1, 'cocoa').set(ox + seam, oy + y + 2, 'cocoa');
        g.set(ox + ((seam + 5) % T), oy + y + 1, 'sand');
      }
      break;
    }
    case '#': {
      g.rect(ox, oy, T, T, 'ink1');
      g.dither(ox, oy, T, T, 'ink0', (tx + ty) % 2);
      break;
    }
    case 'w': {
      g.rect(ox, oy, T, T, 'ink3');
      g.hline(ox, oy, T, 'slate');
      g.hline(ox, oy + 9, T, 'slate').hline(ox, oy + 10, T, 'ink2');
      g.rect(ox, oy + 13, T, 3, 'ink1');
      if (tx % 4 === 0) g.vline(ox, oy + 1, 8, 'ink2');
      break;
    }
    case 'D': {
      g.rect(ox, oy, T, T, 'cocoa');
      g.rect(ox + 2, oy + 2, T - 4, T - 2, 'coffee');
      g.rect(ox + 4, oy + 4, T - 8, 5, 'navy');
      g.set(ox + (tx % 2 === 0 ? 12 : 3), oy + 11, 'mustard');
      g.vline(ox + (tx % 2 === 0 ? 15 : 0), oy, T, 'ink0');
      break;
    }
    default:
      // Glaswände und Türen liegen auf Boden des passenden Bereichs.
      paintTile(g, tx >= 25 && ty <= 8 ? ',' : '.', ox, oy, tx, ty, rng);
  }
}

/** Backt den kompletten Boden inkl. Wände in ein Raster (eine Textur, ein Draw-Call). */
export function buildFloor(): PixelGrid {
  const rows = OFFICE_MAP.length;
  const cols = OFFICE_MAP[0]!.length;
  const g = new PixelGrid(cols * TILE, rows * TILE);
  const rng = new Rng(4711);
  OFFICE_MAP.forEach((row, ty) => [...row].forEach((ch, tx) => paintTile(g, ch, tx * TILE, ty * TILE, tx, ty, rng)));
  // Bewertungs-Teppich vor dem Chefbüro (hier versammelt sich das Team zur Leistungsbewertung).
  const rx = 26 * TILE + 4;
  const ry = 11 * TILE;
  g.rect(rx, ry, 8 * TILE - 8, 4 * TILE, 'wine').frame(rx, ry, 8 * TILE - 8, 4 * TILE, 'rust');
  g.frame(rx + 3, ry + 3, 8 * TILE - 14, 4 * TILE - 6, 'mustardDark');
  for (let y = ry + 12; y < ry + 4 * TILE - 8; y += 16)
    for (let x = rx + 12; x < rx + 8 * TILE - 16; x += 16) {
      g.set(x, y - 2, 'mustard').set(x - 2, y, 'mustard').set(x + 2, y, 'mustard').set(x, y + 2, 'mustard').set(x, y, 'rust');
    }
  // Fußmatte vor der Eingangstür.
  g.rect(17 * TILE + 2, 20 * TILE + 4, 28, 10, 'rust').frame(17 * TILE + 2, 20 * TILE + 4, 28, 10, 'wine');
  // Schattenkante unter der oberen Wand.
  g.hline(TILE, 2 * TILE, (cols - 2) * TILE, 'ink1');
  return g;
}

// ---------------------------------------------------------------- Möbel & Ausstattung

type Painter = (g: PixelGrid) => void;

const PAINTERS: Record<OfficeSprite, Painter> = {
  desk(g) {
    g.rect(0, 6, 32, 12, 'fog').hline(0, 6, 32, 'paper');
    g.rect(0, 18, 32, 5, 'slate').hline(0, 22, 32, 'ink3');
    g.rect(1, 23, 2, 1, 'ink1').rect(29, 23, 2, 1, 'ink1');
    // Monitor mit leuchtendem Bildschirm.
    g.rect(8, 0, 16, 11, 'ink1');
    g.rect(9, 1, 14, 8, 'teal').hline(9, 1, 14, 'mint').dither(9, 2, 14, 7, 'petrol', 1);
    g.rect(11, 3, 6, 1, 'mint').rect(11, 5, 9, 1, 'mint');
    g.rect(14, 11, 4, 1, 'ink1').rect(12, 12, 8, 1, 'ink1');
    // Tastatur, Telefon, Tasse, Zettel.
    g.rect(10, 14, 12, 3, 'ink3').dither(11, 15, 10, 1, 'slate');
    g.rect(24, 11, 6, 4, 'ink1').rect(24, 10, 6, 2, 'red').set(29, 10, 'rose');
    g.rect(3, 10, 3, 3, 'white').set(6, 11, 'white').set(4, 10, 'coffee');
    g.rect(3, 14, 5, 3, 'paper').hline(4, 15, 3, 'slate');
    g.outline();
  },
  chair(g) {
    g.rect(2, 1, 10, 6, 'ink2').hline(2, 1, 10, 'ink3');
    g.rect(1, 6, 12, 6, 'rust').hline(1, 6, 12, 'amber').vline(12, 7, 5, 'wine');
    g.rect(6, 12, 2, 1, 'ink1');
    g.set(2, 13, 'ink1').set(6, 13, 'ink1').set(11, 13, 'ink1');
    g.outline();
  },
  panelH(g) {
    g.rect(0, 0, 16, 2, 'slate').hline(0, 0, 16, 'fog');
    g.rect(0, 2, 16, 8, 'petrol').dither(0, 2, 16, 8, 'navy', 1);
    g.rect(0, 10, 16, 2, 'ink1');
  },
  panelV(g) {
    g.rect(0, 0, 4, 2, 'fog');
    g.rect(0, 2, 4, 36, 'petrol').vline(3, 2, 36, 'navy').vline(0, 2, 36, 'teal');
    g.rect(0, 38, 4, 2, 'ink1');
  },
  counter(g) {
    g.rect(0, 12, 48, 5, 'sand').hline(0, 12, 48, 'white');
    g.rect(0, 17, 48, 9, 'coffee').hline(0, 25, 48, 'cocoa');
    for (const x of [15, 31]) g.vline(x, 18, 7, 'cocoa');
    for (const x of [7, 23, 39]) g.rect(x, 19, 3, 1, 'sand');
    // Kaffeemaschine mit roter Lampe und Tasse.
    g.rect(3, 0, 15, 13, 'ink1').rect(4, 1, 13, 3, 'ink2').set(15, 2, 'red').set(13, 2, 'mint');
    g.rect(6, 6, 9, 5, 'ink0').rect(8, 8, 4, 3, 'white').set(9, 8, 'coffee');
    // Mikrowelle.
    g.rect(26, 3, 19, 10, 'paper').rect(27, 4, 12, 8, 'ink2').dither(28, 5, 10, 6, 'mustard', 0).rect(40, 5, 3, 1, 'mint').rect(40, 8, 3, 2, 'slate');
    g.outline();
  },
  fridge(g) {
    g.rect(0, 0, 18, 32, 'paper').vline(17, 0, 32, 'fog').hline(0, 11, 18, 'fog');
    g.rect(14, 4, 2, 5, 'slate').rect(14, 14, 2, 8, 'slate');
    g.set(4, 5, 'red').set(7, 3, 'mustard').rect(3, 16, 4, 5, 'blush').set(5, 17, 'ink3');
    g.outline();
  },
  cooler(g) {
    g.rect(2, 0, 8, 10, 'sky').vline(8, 1, 8, 'blue').vline(3, 1, 6, 'white');
    g.rect(0, 10, 12, 16, 'paper').vline(11, 10, 16, 'fog');
    g.set(3, 13, 'red').set(8, 13, 'blue').rect(3, 20, 6, 1, 'slate');
    g.outline();
  },
  plant(g) {
    g.rect(3, 14, 8, 8, 'rust').hline(2, 14, 10, 'amber').vline(10, 15, 7, 'wine');
    g.disc(7, 8, 5, 'leaf');
    g.disc(4, 5, 3, 'leaf').disc(10, 4, 3, 'leaf').disc(7, 2, 2, 'mint');
    g.set(5, 9, 'moss').set(9, 10, 'moss').set(8, 6, 'moss').set(3, 7, 'mint').set(11, 6, 'moss');
    g.vline(7, 11, 3, 'moss');
    g.outline();
  },
  printer(g) {
    g.rect(4, 0, 18, 7, 'white').hline(5, 2, 16, 'paper');
    g.rect(0, 6, 26, 14, 'paper').vline(25, 6, 14, 'fog').hline(0, 19, 26, 'fog');
    g.rect(4, 12, 18, 2, 'ink2');
    g.rect(18, 8, 6, 3, 'ink1').set(19, 9, 'mint').set(22, 9, 'mustard');
    g.rect(1, 20, 3, 2, 'ink1').rect(22, 20, 3, 2, 'ink1');
    g.outline();
  },
  cabinet(g) {
    g.rect(0, 0, 16, 26, 'slate').vline(15, 0, 26, 'ink3').hline(0, 0, 16, 'fog');
    for (const y of [8, 16]) g.hline(1, y, 14, 'ink3');
    for (const y of [4, 12, 20]) g.rect(6, y, 4, 1, 'fog');
    g.outline();
  },
  shredder(g) {
    g.rect(0, 6, 12, 12, 'ink2').vline(11, 6, 12, 'ink1');
    g.rect(0, 2, 12, 5, 'slate').hline(2, 4, 8, 'ink0');
    g.vline(3, 0, 4, 'white').vline(6, 1, 3, 'white').vline(8, 0, 4, 'white');
    g.set(10, 3, 'mint');
    g.outline();
  },
  clock(g) {
    g.disc(6, 6, 5, 'white');
    g.vline(6, 3, 4, 'ink0').hline(6, 6, 3, 'ink0').set(6, 2, 'red');
    g.outline();
  },
  fusebox(g) {
    g.rect(0, 0, 12, 13, 'fog').vline(11, 0, 13, 'slate').hline(1, 6, 10, 'slate');
    g.set(6, 2, 'mustard').set(5, 3, 'mustard').set(6, 3, 'mustard').set(6, 4, 'mustard').set(7, 4, 'mustard');
    g.rect(2, 8, 2, 3, 'ink3').rect(5, 8, 2, 3, 'ink3').rect(8, 8, 2, 3, 'ink3');
    g.outline();
  },
  screen(g) {
    g.rect(0, 0, 60, 2, 'ink1');
    g.rect(2, 2, 56, 10, 'white').hline(2, 11, 56, 'paper').dither(2, 9, 56, 2, 'paper', 0);
    g.rect(1, 12, 58, 2, 'slate');
    g.outline();
  },
  window(g) {
    g.rect(0, 0, 30, 13, 'ink1');
    g.rect(1, 1, 28, 10, 'navy').dither(1, 1, 28, 4, 'ink2', 0);
    // Konkurrenz-Callcenter gegenüber (Silhouette mit Licht).
    g.rect(3, 5, 9, 6, 'ink0').rect(14, 3, 7, 8, 'ink0').rect(22, 6, 6, 5, 'ink0');
    g.set(5, 7, 'mustard').set(8, 7, 'amber').set(16, 5, 'mustard').set(18, 8, 'mustard').set(24, 8, 'amber');
    g.set(25, 2, 'white').set(9, 2, 'fog');
    g.vline(15, 1, 10, 'ink1');
    g.rect(0, 11, 30, 2, 'fog');
  },
  pinboard(g) {
    g.rect(0, 0, 16, 12, 'coffee');
    g.rect(1, 1, 14, 10, 'sand').dither(1, 1, 14, 10, 'mustardDark', 0);
    g.rect(2, 2, 4, 4, 'paper').rect(8, 3, 5, 3, 'blush').rect(4, 7, 5, 3, 'mint').rect(10, 7, 3, 3, 'white');
    g.set(3, 2, 'red').set(10, 3, 'red').set(6, 7, 'blue').set(11, 7, 'red');
  },
  poster(g) {
    g.rect(0, 0, 14, 13, 'mustard').frame(0, 0, 14, 13, 'ink1');
    // Daumen hoch: „Motivation!“
    g.rect(4, 5, 5, 5, 'white').rect(5, 2, 2, 4, 'white').rect(9, 6, 1, 3, 'white');
    g.hline(2, 11, 10, 'ink1');
  },
  hatch(g) {
    g.rect(0, 0, 16, 12, 'slate').frame(0, 0, 16, 12, 'ink1');
    g.rect(2, 2, 12, 7, 'ink3').hline(2, 2, 12, 'fog').rect(6, 6, 4, 1, 'fog');
    g.hline(1, 10, 14, 'mustard').dither(1, 10, 14, 1, 'ink0', 0);
  },
  picture(g) {
    g.rect(0, 0, 14, 11, 'mustardDark').frame(0, 0, 14, 11, 'coffee');
    g.rect(2, 2, 10, 7, 'sky');
    // Porträt von Direktor Brülling (mit roter Krawatte).
    g.rect(5, 3, 4, 3, 'skin2').rect(4, 6, 6, 3, 'paper').vline(7, 6, 3, 'red').set(5, 4, 'ink0').set(8, 4, 'ink0');
  },
  bossDesk(g) {
    g.rect(0, 8, 48, 10, 'cocoa').hline(0, 8, 48, 'coffee').dither(1, 9, 46, 8, 'coffee', 0);
    g.rect(0, 18, 48, 8, 'ink1').rect(3, 19, 18, 6, 'cocoa').rect(27, 19, 18, 6, 'cocoa');
    g.rect(18, 13, 12, 3, 'mustard').hline(19, 14, 10, 'mustardDark');
    g.rect(4, 10, 8, 5, 'white').rect(5, 11, 8, 5, 'paper');
    g.rect(36, 9, 6, 4, 'mustard').rect(36, 8, 6, 2, 'mustardDark');
    g.rect(31, 11, 4, 2, 'red').set(31, 10, 'rose');
    g.outline();
  },
  bossChair(g) {
    g.rect(1, 0, 14, 10, 'wine').hline(2, 1, 12, 'rose').vline(13, 1, 9, 'ink1');
    g.rect(2, 10, 12, 4, 'wine').hline(2, 10, 12, 'rose');
    g.rect(7, 14, 2, 2, 'ink1').hline(3, 16, 10, 'ink1');
    g.outline();
  },
  router(g) {
    g.rect(0, 0, 16, 26, 'ink1').vline(15, 0, 26, 'ink0').hline(0, 0, 16, 'ink3');
    for (const y of [3, 9, 15]) {
      g.rect(2, y, 12, 4, 'ink2');
      g.set(3, y + 1, 'mint').set(5, y + 1, 'mustard').set(7, y + 1, 'mint').set(9, y + 1, 'red');
      g.hline(3, y + 3, 10, 'ink3');
    }
    g.vline(13, 20, 6, 'sky').vline(11, 21, 5, 'red');
    g.outline();
  },
  bin(g) {
    g.rect(0, 2, 8, 7, 'slate').vline(7, 2, 7, 'ink3').vline(2, 3, 5, 'ink3').vline(5, 3, 5, 'ink3');
    g.rect(2, 0, 3, 3, 'white').set(5, 1, 'paper');
    g.outline();
  },
  glassV(g) {
    g.vline(6, 0, 16, 'slate').vline(9, 0, 16, 'slate');
    for (let y = 0; y < 16; y++) if (y % 3 !== 0) g.set(7 + (y % 2), y, 'sky');
  },
  glassH(g) {
    g.rect(0, 0, 16, 2, 'slate').hline(0, 0, 16, 'fog');
    for (let i = 0; i < 16; i++) {
      const y = 2 + ((i * 5) % 14);
      if (i % 3 !== 1) g.set(i, y, 'sky').set(i, Math.min(17, y + 1), 'sky');
    }
    g.rect(0, 18, 16, 4, 'slate').hline(0, 21, 16, 'ink3').hline(0, 18, 16, 'fog');
  },
  bossDoor(g) {
    g.rect(0, 0, 16, 3, 'cocoa');
    g.rect(2, 0, 12, 3, 'mustard').hline(2, 1, 12, 'mustardDark');
  },
};

export function buildSprite(key: OfficeSprite): PixelGrid {
  const size = SPRITE_SIZE[key];
  const g = new PixelGrid(size.w, size.h);
  PAINTERS[key](g);
  return g;
}

/** Türpfosten des Chefbüros: linke bzw. rechte Hälfte unterscheiden. */
export function buildBossDoorHalf(left: boolean): PixelGrid {
  const g = buildSprite('bossDoor');
  if (left) g.rect(0, 0, 3, 22, 'cocoa').vline(2, 3, 19, 'coffee');
  else g.rect(13, 0, 3, 22, 'cocoa').vline(13, 3, 19, 'coffee');
  return g;
}

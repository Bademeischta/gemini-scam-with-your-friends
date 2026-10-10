import type { PaletteName } from '../config/palette';
import type { Wallpaper } from '../data/os/appearance';
import { Rng } from '../systems/rng/rng';
import { PixelGrid } from './PixelGrid';

/** Pixel-Art von MogelOS: App-Symbole (16×16) und Hintergrundbilder. */

export type OsIcon = 'files' | 'trash' | 'trashFull' | 'calc' | 'weather' | 'settings' | 'textfile' | 'folder' | 'start' | 'standUp';

const LEGEND: Readonly<Record<string, PaletteName>> = {
  k: 'ink0', d: 'ink1', g: 'ink2', h: 'ink3', s: 'slate', f: 'fog', p: 'paper', w: 'white',
  y: 'mustard', Y: 'mustardDark', o: 'amber', r: 'red', R: 'wine', b: 'sky', B: 'blue', t: 'teal', T: 'petrol', m: 'mint', l: 'leaf', c: 'coffee', n: 'sand',
};

const ICONS: Record<OsIcon, readonly string[]> = {
  folder: [
    '................',
    '.kkkkk..........',
    'kyyyyyk.........',
    'kyyyyyykkkkkkkk.',
    'kYYYYYYYYYYYYYYk',
    'kyyyyyyyyyyyyyyk',
    'kynnnnnnnnnnnnyk',
    'kyyyyyyyyyyyyyyk',
    'kyyyyyyyyyyyyyyk',
    'kyyyyyyyyyyyyyyk',
    'kyyyyyyyyyyyyyyk',
    'kyyyyyyyyyyyyyyk',
    'kYYYYYYYYYYYYYYk',
    '.kkkkkkkkkkkkkk.',
    '................',
    '................',
  ],
  files: [
    '................',
    '.kkkkk..........',
    'kyyyyyk.........',
    'kyyyyyykkkkkkkk.',
    'kYYYYkkkkkYYYYYk',
    'kyyyykppppkyyyyk',
    'kyyyykpssppkyyyk',
    'kyyyykppppppkyyk',
    'kyyyykpsssspkyyk',
    'kyyyykppppppkyyk',
    'kyyyykpssspkyyyk',
    'kyyyykppppppkyyk',
    'kYYYYkkkkkkkYYYk',
    '.kkkkkkkkkkkkkk.',
    '................',
    '................',
  ],
  trash: [
    '................',
    '......kkkk......',
    '..kkkkkffkkkkk..',
    '..kffffffffffk..',
    '..kkkkkkkkkkkk..',
    '...kfsfsfsfsk...',
    '...kfsfsfsfsk...',
    '...kfsfsfsfsk...',
    '...kfsfsfsfsk...',
    '...kfsfsfsfsk...',
    '...kfsfsfsfsk...',
    '...kfsfsfsfsk...',
    '...kfsfsfsfsk...',
    '....kkkkkkkk....',
    '................',
    '................',
  ],
  trashFull: [
    '.....kkk........',
    '....kpppkkk.....',
    '..kkkkpkkpkkkk..',
    '..kffffffffffk..',
    '..kkkkkkkkkkkk..',
    '...kfsfsfsfsk...',
    '...kfsfsfsfsk...',
    '...kfsfsfsfsk...',
    '...kfsfsfsfsk...',
    '...kfsfsfsfsk...',
    '...kfsfsfsfsk...',
    '...kfsfsfsfsk...',
    '...kfsfsfsfsk...',
    '....kkkkkkkk....',
    '................',
    '................',
  ],
  calc: [
    '..kkkkkkkkkkkk..',
    '..kffffffffffk..',
    '..kfkkkkkkkkfk..',
    '..kfkmmmmmmkfk..',
    '..kfkkkkkkkkfk..',
    '..kffffffffffk..',
    '..kfkkfkkfkrfk..',
    '..kfkkfkkfkrfk..',
    '..kffffffffffk..',
    '..kfkkfkkfkyfk..',
    '..kfkkfkkfkyfk..',
    '..kffffffffffk..',
    '..kfkkfkkfkyfk..',
    '..kfkkfkkfkyfk..',
    '..kffffffffffk..',
    '..kkkkkkkkkkkk..',
  ],
  weather: [
    '.......y........',
    '..y....y....y...',
    '...y.kkkkk.y....',
    '....kyyyyyk.....',
    '...kyyyyyyyk....',
    'yy.kyyyykkkkk...',
    '...kyyykpppppk..',
    '...kyykppppppkk.',
    '....kkpppppppppk',
    '...kpppppppppppk',
    '..kppppppppppppk',
    '..kffffffffffffk',
    '...kkkkkkkkkkkk.',
    '....b...b...b...',
    '...b...b...b....',
    '................',
  ],
  settings: [
    '................',
    '......kkkk......',
    '...kk.kffk.kk...',
    '..kffkkffkkffk..',
    '..kfffffffffffk.',
    '...kfffkkkffk...',
    '.kkkffk...kffkk.',
    '.kffffk...kfffk.',
    '.kffffk...kfffk.',
    '.kkkffk...kffkk.',
    '...kfffkkkffk...',
    '..kfffffffffffk.',
    '..kffkkffkkffk..',
    '...kk.kffk.kk...',
    '......kkkk......',
    '................',
  ],
  textfile: [
    '...kkkkkkkk.....',
    '...kppppppkk....',
    '...kppppppkpk...',
    '...kppppppkkkk..',
    '...kpsssssppk...',
    '...kppppppppk...',
    '...kpssssssspk..',
    '...kppppppppk...',
    '...kpsssssppk...',
    '...kppppppppk...',
    '...kpssssssspk..',
    '...kppppppppk...',
    '...kpsssppppk...',
    '...kppppppppk...',
    '...kkkkkkkkkk...',
    '................',
  ],
  start: [
    '................',
    '................',
    '....kkkkkkkk....',
    '..kkrrrrrrrrkk..',
    '.krrwwrrrrrrrrk.',
    'krrkkkkkkkkkkrrk',
    'krrk........krrk',
    'kRrrk......kRrrk',
    '.kRRk......kRRk.',
    '..kkk......kkk..',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  standUp: [
    '.......kk.......',
    '......kffk......',
    '......kffk......',
    '.......kk.......',
    '.....kkffkk.....',
    '....kffffffk....',
    '...kfkffffkfk...',
    '...kk.kffk.kk...',
    '......kffk......',
    '.....kfkkfk.....',
    '.....kfkkfk.....',
    '....kfk..kfk....',
    '....kk....kk....',
    '..kkkkkkkkkkkk..',
    '..kyyyyyyyyyyk..',
    '..kkkkkkkkkkkk..',
  ],
};

export function buildOsIcon(name: OsIcon): PixelGrid {
  const art = ICONS[name];
  const g = new PixelGrid(art[0]!.length, art.length);
  return g.stamp(0, 0, art, LEGEND);
}

export const OS_ICONS = Object.keys(ICONS) as OsIcon[];

// ------------------------------------------------------------------ Hintergrundbilder

const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((row) => row.map((v) => (v + 0.5) / 16));


/** Erzeugt ein Hintergrundbild in Art-Pixeln (wird ganzzahlig hochskaliert). */
export function buildWallpaper(kind: Wallpaper, w: number, h: number): PixelGrid {
  const g = new PixelGrid(w, h);
  const rng = new Rng(99);
  switch (kind) {
    case 'mogel': {
      // Petrol-Verlauf mit Dithering und großem, blassem Hörer-Logo.
      const bands: PaletteName[] = ['navy', 'petrol', 'teal'];
      for (let y = 0; y < h; y++) {
        const t = (y / h) * (bands.length - 1);
        const i = Math.floor(t);
        const frac = t - i;
        for (let x = 0; x < w; x++) g.set(x, y, frac > BAYER4[y % 4]![x % 4]! ? bands[Math.min(bands.length - 1, i + 1)]! : bands[i]!);
      }
      const s = Math.max(2, Math.floor(Math.min(w, h) / 40));
      const ox = Math.floor(w / 2 - 10 * s);
      const oy = Math.floor(h / 2 - 8 * s);
      const logo = ['....############....', '..##............##..', '.#..##########....#.', '#..#..........#....#', '#..#..........#....#', '##.#..........#...##', '.###..........#####.'];
      logo.forEach((row, y) => [...row].forEach((c, x) => c === '#' && g.rect(ox + x * s, oy + y * s, s, s, 'mint')));
      break;
    }
    case 'karo': {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g.set(x, y, (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0 ? 'ink2' : 'navy');
      for (let y = 0; y < h; y += 8) g.hline(0, y, w, 'ink1');
      break;
    }
    case 'nacht': {
      g.rect(0, 0, w, h, 'ink1');
      for (let i = 0; i < (w * h) / 60; i++) g.set(rng.int(0, w - 1), rng.int(0, Math.floor(h * 0.7)), rng.chance(0.3) ? 'white' : 'fog');
      g.disc(Math.floor(w * 0.8), Math.floor(h * 0.2), 4, 'paper');
      let x = 0;
      while (x < w) {
        const bw = rng.int(6, 16);
        const bh = rng.int(Math.floor(h * 0.15), Math.floor(h * 0.45));
        g.rect(x, h - bh, bw, bh, 'ink0');
        for (let wy = h - bh + 2; wy < h - 2; wy += 3) for (let wx = x + 1; wx < x + bw - 1; wx += 3) if (rng.chance(0.3)) g.set(wx, wy, 'mustard');
        x += bw + rng.int(0, 2);
      }
      break;
    }
    case 'chef': {
      // „Motivations-Hintergrund“: gekacheltes Porträt von Direktor Brülling.
      g.rect(0, 0, w, h, 'wine');
      for (let ty = 0; ty < h; ty += 16)
        for (let tx = (ty / 16) % 2 === 0 ? 0 : 8; tx < w; tx += 16) {
          g.rect(tx + 4, ty + 3, 8, 7, 'skin2').hline(tx + 4, ty + 3, 8, 'fog');
          g.set(tx + 6, ty + 6, 'ink0').set(tx + 9, ty + 6, 'ink0').hline(tx + 6, ty + 8, 4, 'red');
          g.rect(tx + 3, ty + 10, 10, 4, 'paper').vline(tx + 7, ty + 10, 4, 'red').vline(tx + 8, ty + 10, 4, 'red');
        }
      break;
    }
  }
  return g;
}

// ------------------------------------------------------------------ Wetter-Symbole

export type WeatherIcon = 'sun' | 'cloud' | 'rain' | 'storm' | 'fog' | 'rocket';

/** Wetter-Symbole (16×16) für die Wetter-App. */
export function buildWeatherIcon(kind: WeatherIcon): PixelGrid {
  const g = new PixelGrid(16, 16);
  const cloud = (dy: number, c: PaletteName, shade: PaletteName): void => {
    g.disc(6, 8 + dy, 3, c).disc(10, 7 + dy, 4, c).rect(3, 9 + dy, 11, 3, c).hline(3, 11 + dy, 11, shade);
  };
  switch (kind) {
    case 'sun':
      g.disc(8, 8, 4, 'mustard').set(6, 6, 'sand').set(7, 6, 'sand');
      for (const [x, y] of [[8, 1], [8, 14], [1, 8], [14, 8], [3, 3], [13, 3], [3, 13], [13, 13]] as const) g.set(x, y, 'amber');
      break;
    case 'cloud':
      cloud(0, 'paper', 'fog');
      break;
    case 'rain':
      cloud(-2, 'fog', 'slate');
      for (const x of [4, 7, 10, 13]) g.set(x - 1, 12, 'sky').set(x - 2, 14, 'sky');
      break;
    case 'storm':
      cloud(-2, 'slate', 'ink3');
      g.set(9, 10, 'mustard').set(8, 11, 'mustard').set(9, 11, 'mustard').set(8, 12, 'mustard').set(7, 13, 'mustard').set(7, 14, 'mustard');
      break;
    case 'fog':
      for (const y of [4, 7, 10, 13]) g.hline(y % 2 === 0 ? 2 : 4, y, 10, 'fog');
      break;
    case 'rocket':
      g.rect(7, 2, 2, 8, 'paper').set(7, 1, 'red').set(8, 1, 'red').set(7, 4, 'sky').set(8, 4, 'sky');
      g.rect(5, 8, 2, 3, 'red').rect(9, 8, 2, 3, 'red');
      g.rect(7, 10, 2, 2, 'amber').set(7, 12, 'mustard').set(8, 13, 'mustard');
      break;
  }
  return g.outline('ink0');
}

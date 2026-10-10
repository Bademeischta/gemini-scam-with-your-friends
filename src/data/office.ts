/**
 * Grundriss des Hinterhof-Callcenters „Masche & Co.“ (datengetrieben).
 * Kacheln 16×16 Art-Pixel. Objekte in Art-Pixeln (oben links des Sprites).
 *
 * Kachel-Legende:
 *  '#' Wandkrone  'w' Wandfläche  '.' Teppich  ':' Küchenfliesen  ',' Holzboden (Chefbüro)
 *  'g' Glaswand senkrecht  'h' Glaswand waagerecht  'd' Tür zum Chefbüro  'D' Eingangstür
 */
export const TILE = 16;

export const OFFICE_MAP: readonly string[] = [
  '####################################',
  '#wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww#',
  '#:::::::.................g,,,,,,,,,#',
  '#:::::::.................g,,,,,,,,,#',
  '#:::::::.................g,,,,,,,,,#',
  '#:::::::.................g,,,,,,,,,#',
  '#:::::::.................g,,,,,,,,,#',
  '#........................g,,,,,,,,,#',
  '#........................g,,,,,,,,,#',
  '#........................hhhhddhhhh#',
  '#..................................#',
  '#..................................#',
  '#..................................#',
  '#..................................#',
  '#..................................#',
  '#..................................#',
  '#..................................#',
  '#..................................#',
  '#..................................#',
  '#..................................#',
  '#..................................#',
  '#################DD#################',
];

/** Kacheln, die nicht begehbar sind. Glaswände kollidieren über eigene Boxen (siehe solidBoxesForTile). */
export const SOLID_TILES = new Set(['#', 'w', 'D']);

export type OfficeSprite =
  | 'counter'
  | 'fridge'
  | 'cooler'
  | 'plant'
  | 'printer'
  | 'cabinet'
  | 'shredder'
  | 'clock'
  | 'fusebox'
  | 'screen'
  | 'window'
  | 'pinboard'
  | 'poster'
  | 'hatch'
  | 'picture'
  | 'desk'
  | 'chair'
  | 'panelH'
  | 'panelV'
  | 'bossDesk'
  | 'bossChair'
  | 'router'
  | 'bin'
  | 'glassV'
  | 'glassH'
  | 'bossDoor';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface OfficeObject {
  id: string;
  sprite: OfficeSprite;
  x: number;
  y: number;
  /** Kollisionsbox relativ zum Sprite (fehlt = nicht fest). */
  solid?: Box;
  /** Hängt an der Wand: wird hinter allem gezeichnet. */
  onWall?: boolean;
  /** Y-Sortier-Anker relativ zur Oberkante (Standard: Sprite-Unterkante). */
  sortY?: number;
}

/** Sprite-Größen in Art-Pixeln (müssen zu src/gfx/officeArt.ts passen). */
export const SPRITE_SIZE: Readonly<Record<OfficeSprite, { w: number; h: number }>> = {
  counter: { w: 48, h: 26 },
  fridge: { w: 18, h: 32 },
  cooler: { w: 12, h: 26 },
  plant: { w: 14, h: 22 },
  printer: { w: 26, h: 22 },
  cabinet: { w: 16, h: 26 },
  shredder: { w: 12, h: 18 },
  clock: { w: 12, h: 12 },
  fusebox: { w: 12, h: 13 },
  screen: { w: 60, h: 14 },
  window: { w: 30, h: 13 },
  pinboard: { w: 16, h: 12 },
  poster: { w: 14, h: 13 },
  hatch: { w: 16, h: 12 },
  picture: { w: 14, h: 11 },
  desk: { w: 32, h: 24 },
  chair: { w: 14, h: 15 },
  panelH: { w: 16, h: 12 },
  panelV: { w: 4, h: 40 },
  bossDesk: { w: 48, h: 26 },
  bossChair: { w: 16, h: 18 },
  router: { w: 16, h: 26 },
  bin: { w: 8, h: 9 },
  glassV: { w: 16, h: 16 },
  glassH: { w: 16, h: 22 },
  bossDoor: { w: 16, h: 22 },
};

export interface DeskDef {
  /** Platznummer 0–7. */
  index: number;
  /** Oberkante links des Tisch-Sprites. */
  x: number;
  y: number;
}

/** Reihe A (oben) und Reihe B (unten), je 4 Plätze. */
const DESK_COLUMNS = [6, 9, 12, 15].map((c) => c * TILE);
const ROW_A = 10 * TILE + 2;
const ROW_B = 15 * TILE + 2;
export const DESKS: readonly DeskDef[] = [
  ...DESK_COLUMNS.map((x, i) => ({ index: i, x, y: ROW_A })),
  ...DESK_COLUMNS.map((x, i) => ({ index: 4 + i, x, y: ROW_B })),
];

/** Abgeleitete Positionen eines Platzes. */
export function deskGeometry(d: DeskDef): { chair: { x: number; y: number }; seat: { x: number; y: number }; standUp: { x: number; y: number } } {
  return {
    chair: { x: d.x + 9, y: d.y + 23 },
    // Füße der sitzenden Figur (Mittelpunkt unten).
    seat: { x: d.x + 16, y: d.y + 40 },
    // Aufstehen: einen Schritt hinter den Stuhl.
    standUp: { x: d.x + 16, y: d.y + 50 },
  };
}

function deskObjects(): OfficeObject[] {
  const out: OfficeObject[] = [];
  for (const d of DESKS) {
    const g = deskGeometry(d);
    out.push({ id: `desk${d.index}`, sprite: 'desk', x: d.x, y: d.y, solid: { x: 0, y: 6, w: 32, h: 17 } });
    out.push({ id: `chair${d.index}`, sprite: 'chair', x: g.chair.x, y: g.chair.y, sortY: 15, solid: { x: 1, y: 6, w: 12, h: 8 } });
  }
  // Rückwände hinter jeder Reihe und Trennwände zwischen den Plätzen.
  for (const rowY of [ROW_A, ROW_B]) {
    for (let x = DESK_COLUMNS[0]! - 8; x < DESK_COLUMNS[3]! + 40; x += 16) {
      out.push({ id: `panelH-${rowY}-${x}`, sprite: 'panelH', x, y: rowY - 9, solid: { x: 0, y: 6, w: 16, h: 6 } });
    }
    for (const x of [DESK_COLUMNS[0]! - 8, ...DESK_COLUMNS.map((c) => c + 40)]) {
      out.push({ id: `panelV-${rowY}-${x}`, sprite: 'panelV', x: x - 2, y: rowY - 3, solid: { x: 0, y: 4, w: 4, h: 36 } });
    }
  }
  return out;
}

function glassObjects(): OfficeObject[] {
  const out: OfficeObject[] = [];
  OFFICE_MAP.forEach((row, ty) => {
    [...row].forEach((c, tx) => {
      const x = tx * TILE;
      const y = ty * TILE;
      if (c === 'g') out.push({ id: `glassV-${tx}-${ty}`, sprite: 'glassV', x, y, solid: { x: 6, y: 0, w: 4, h: 16 } });
      if (c === 'h') out.push({ id: `glassH-${tx}-${ty}`, sprite: 'glassH', x, y: y - 6, solid: { x: 0, y: 14, w: 16, h: 8 } });
      if (c === 'd') out.push({ id: `bossDoor-${tx}-${ty}`, sprite: 'bossDoor', x, y: y - 6, solid: tx % 2 === 1 ? { x: 0, y: 14, w: 3, h: 8 } : { x: 13, y: 14, w: 3, h: 8 } });
    });
  });
  return out;
}

export const OFFICE_OBJECTS: readonly OfficeObject[] = [
  // Wand-Ausstattung (obere Wandfläche, Zeile 1).
  { id: 'clock', sprite: 'clock', x: 8 * TILE + 2, y: TILE + 2, onWall: true },
  { id: 'fusebox', sprite: 'fusebox', x: 9 * TILE + 2, y: TILE + 2, onWall: true },
  { id: 'screen', sprite: 'screen', x: 10 * TILE + 2, y: TILE + 1, onWall: true },
  { id: 'pinboard', sprite: 'pinboard', x: 14 * TILE, y: TILE + 2, onWall: true },
  { id: 'window1', sprite: 'window', x: 15 * TILE + 1, y: TILE + 2, onWall: true },
  { id: 'poster', sprite: 'poster', x: 17 * TILE + 1, y: TILE + 2, onWall: true },
  { id: 'window2', sprite: 'window', x: 18 * TILE + 1, y: TILE + 2, onWall: true },
  { id: 'hatch', sprite: 'hatch', x: 20 * TILE, y: TILE + 3, onWall: true },
  { id: 'window3', sprite: 'window', x: 21 * TILE + 1, y: TILE + 2, onWall: true },
  { id: 'picture', sprite: 'picture', x: 27 * TILE + 1, y: TILE + 3, onWall: true },
  { id: 'window4', sprite: 'window', x: 31 * TILE + 1, y: TILE + 2, onWall: true },
  // Küche.
  { id: 'counter', sprite: 'counter', x: TILE, y: 24, solid: { x: 0, y: 12, w: 48, h: 14 } },
  { id: 'fridge', sprite: 'fridge', x: 4 * TILE - 1, y: 16, solid: { x: 0, y: 20, w: 18, h: 12 } },
  { id: 'cooler', sprite: 'cooler', x: 6 * TILE + 2, y: 20, solid: { x: 1, y: 18, w: 10, h: 8 } },
  // Linke Seite.
  { id: 'printer', sprite: 'printer', x: TILE + 4, y: 9 * TILE, solid: { x: 0, y: 10, w: 26, h: 12 } },
  { id: 'cabinet', sprite: 'cabinet', x: TILE + 4, y: 14 * TILE, solid: { x: 0, y: 14, w: 16, h: 12 } },
  { id: 'shredder', sprite: 'shredder', x: TILE + 24, y: 14 * TILE + 8, solid: { x: 0, y: 10, w: 12, h: 8 } },
  { id: 'ferdinand', sprite: 'plant', x: TILE + 4, y: 19 * TILE - 4, solid: { x: 2, y: 16, w: 10, h: 6 } },
  // Mülleimer an den Gängen.
  { id: 'bin1', sprite: 'bin', x: 19 * TILE + 4, y: 12 * TILE + 4, solid: { x: 0, y: 4, w: 8, h: 5 } },
  { id: 'bin2', sprite: 'bin', x: 19 * TILE + 4, y: 17 * TILE + 4, solid: { x: 0, y: 4, w: 8, h: 5 } },
  // Chefbüro.
  { id: 'bossFiling', sprite: 'cabinet', x: 26 * TILE + 2, y: 2 * TILE - 2, solid: { x: 0, y: 14, w: 16, h: 12 } },
  { id: 'bossChair', sprite: 'bossChair', x: 29 * TILE + 8, y: 3 * TILE - 2, solid: { x: 1, y: 10, w: 14, h: 8 } },
  { id: 'bossDesk', sprite: 'bossDesk', x: 28 * TILE + 8, y: 4 * TILE, solid: { x: 0, y: 10, w: 48, h: 16 } },
  { id: 'bossPlant', sprite: 'plant', x: 33 * TILE + 1, y: 2 * TILE - 2, solid: { x: 2, y: 16, w: 10, h: 6 } },
  // Technik.
  { id: 'router', sprite: 'router', x: 34 * TILE - 2, y: 18 * TILE, solid: { x: 0, y: 14, w: 16, h: 12 } },
  ...glassObjects(),
  ...deskObjects(),
];

/** Startpunkt der Spielerfigur (Füße), direkt hinter der Eingangstür. */
export const SPAWN = { x: 18 * TILE, y: 20 * TILE + 6 };

export const OFFICE_SIZE = { w: OFFICE_MAP[0]!.length * TILE, h: OFFICE_MAP.length * TILE };

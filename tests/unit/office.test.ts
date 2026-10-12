import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/config/tuning';
import { DESKS, deskGeometry, OFFICE_MAP, OFFICE_OBJECTS, OFFICE_SIZE, SPAWN, SPRITE_SIZE, TILE, type OfficeSprite } from '../../src/data/office';
import { buildFrame, buildSheet, CHAR_H, CHAR_W, FACINGS, frameIndex, PLAYER_LOOK, POSES } from '../../src/gfx/characters';
import { buildFloor, buildSprite } from '../../src/gfx/officeArt';
import { PixelGrid } from '../../src/gfx/PixelGrid';
import { CollisionWorld, overlaps } from '../../src/systems/office/collision';
import { findInteractable, probePoint, type Interactable } from '../../src/systems/office/interaction';
import { createMover, facingFrom, stepMover, type MoverParams } from '../../src/systems/office/mover';
import { buildOfficeWorld } from '../../src/systems/office/officeWorld';

const params: MoverParams = {
  speed: TUNING.office.walkSpeedTiles * TILE,
  accelTime: TUNING.office.accelTime,
  decelTime: TUNING.office.decelTime,
  hitbox: TUNING.office.hitbox,
};
const DT = 1 / 60;

function openRoom(): CollisionWorld {
  // 10×10 Kacheln, Rand ist Wand, ein Block in der Mitte.
  return new CollisionWorld((tx, ty) => tx <= 0 || ty <= 0 || tx >= 9 || ty >= 9, [{ x: 72, y: 72, w: 16, h: 16 }], 16, { x: 0, y: 0, w: 160, h: 160 });
}

describe('PixelGrid', () => {
  it('zeichnet, umrandet und spiegelt', () => {
    const g = new PixelGrid(5, 5).rect(2, 2, 1, 1, 'red');
    g.outline('ink0');
    expect(g.get(2, 2)).toBe('red');
    expect([g.get(1, 2), g.get(3, 2), g.get(2, 1), g.get(2, 3)]).toEqual(['ink0', 'ink0', 'ink0', 'ink0']);
    expect(g.get(1, 1)).toBeNull();
    const m = new PixelGrid(3, 1).set(0, 0, 'mint').mirrored();
    expect(m.get(2, 0)).toBe('mint');
    expect(new PixelGrid(2, 2).set(5, 5, 'red').countFilled()).toBe(0);
  });
});

describe('Kollision', () => {
  it('erkennt Wände, Kisten und Weltgrenzen', () => {
    const w = openRoom();
    expect(w.blocked({ x: 20, y: 20, w: 10, h: 6 })).toBe(false);
    expect(w.blocked({ x: 10, y: 20, w: 10, h: 6 })).toBe(true); // linke Wand
    expect(w.blocked({ x: 75, y: 75, w: 4, h: 4 })).toBe(true); // Block
    expect(w.blocked({ x: -5, y: 50, w: 4, h: 4 })).toBe(true);
    expect(overlaps({ x: 0, y: 0, w: 2, h: 2 }, { x: 2, y: 0, w: 2, h: 2 })).toBe(false);
  });

  it('stoppt an Hindernissen und gleitet an Kanten entlang', () => {
    const w = openRoom();
    // Diagonal gegen die rechte Wand: x wird gestoppt, y läuft weiter.
    const r = w.move({ x: 136, y: 60 }, { w: 10, h: 6 }, 20, 10);
    expect(r.hitX).toBe(true);
    expect(r.hitY).toBe(false);
    expect(r.x).toBeLessThanOrEqual(144 - 5);
    expect(r.y).toBe(70);
  });

  it('tunnelt auch bei großen Schritten nicht durch dünne Hindernisse', () => {
    const w = new CollisionWorld(() => false, [{ x: 50, y: 0, w: 2, h: 100 }], 16, { x: 0, y: 0, w: 200, h: 100 });
    const r = w.move({ x: 40, y: 50 }, { w: 4, h: 4 }, 40, 0);
    expect(r.hitX).toBe(true);
    expect(r.x).toBeLessThan(50);
  });
});

describe('Bewegung', () => {
  it('erreicht die Höchstgeschwindigkeit nach der Beschleunigungszeit', () => {
    const w = openRoom();
    const m = createMover(40, 40);
    const frames = Math.ceil(TUNING.office.accelTime / DT);
    for (let i = 0; i < frames; i++) stepMover(m, { x: 1, y: 0 }, DT, params, w);
    expect(m.vx).toBeCloseTo(params.speed, 5);
    expect(m.facing).toBe('right');
  });

  it('bremst nach der Abbremszeit vollständig ab', () => {
    const w = openRoom();
    const m = createMover(40, 40);
    for (let i = 0; i < 20; i++) stepMover(m, { x: 0, y: 1 }, DT, params, w);
    const frames = Math.ceil(TUNING.office.decelTime / DT);
    for (let i = 0; i < frames; i++) stepMover(m, { x: 0, y: 0 }, DT, params, w);
    expect(m.vy).toBe(0);
    expect(m.facing).toBe('down');
  });

  it('diagonal ist nicht schneller als gerade', () => {
    const w = new CollisionWorld(() => false, [], 16, { x: -1e4, y: -1e4, w: 2e4, h: 2e4 });
    const a = createMover(0, 0);
    const b = createMover(0, 0);
    for (let i = 0; i < 120; i++) {
      stepMover(a, { x: 1, y: 0 }, DT, params, w);
      stepMover(b, { x: 1, y: 1 }, DT, params, w);
    }
    expect(Math.hypot(b.x, b.y)).toBeLessThanOrEqual(Math.hypot(a.x, a.y) + 1e-6);
  });

  it('ist framerate-unabhängig (30 vs. 120 Hz Logik-Schritte)', () => {
    const w = new CollisionWorld(() => false, [], 16, { x: -1e4, y: -1e4, w: 2e4, h: 2e4 });
    const a = createMover(0, 0);
    const b = createMover(0, 0);
    for (let i = 0; i < 30; i++) stepMover(a, { x: 1, y: 0 }, 1 / 30, params, w);
    for (let i = 0; i < 120; i++) stepMover(b, { x: 1, y: 0 }, 1 / 120, params, w);
    expect(Math.abs(a.x - b.x)).toBeLessThan(params.speed * 0.05);
  });

  it('Blickrichtung folgt der dominanten Achse', () => {
    expect(facingFrom(0.1, -0.9, 'down')).toBe('up');
    expect(facingFrom(-0.8, 0.3, 'down')).toBe('left');
    expect(facingFrom(0.05, 0.05, 'right')).toBe('right');
  });
});

describe('Interaktion', () => {
  const list: Interactable[] = [
    { id: 'a', kind: 'desk', x: 100, y: 100, ref: 0, enabled: true },
    { id: 'b', kind: 'desk', x: 130, y: 100, ref: 1, enabled: true },
    { id: 'c', kind: 'desk', x: 100, y: 80, ref: 2, enabled: false },
  ];

  it('wählt das nächste aktive Ziel in Blickrichtung', () => {
    expect(findInteractable(list, { x: 100, y: 108 }, 'up', 18, 6)?.id).toBe('a');
    expect(findInteractable(list, { x: 122, y: 100 }, 'right', 18, 6)?.id).toBe('b');
    expect(findInteractable(list, { x: 100, y: 84 }, 'up', 18, 6)?.id).toBe('a');
    expect(findInteractable(list, { x: 300, y: 300 }, 'up', 18, 6)).toBeNull();
    expect(probePoint(0, 0, 'left', 6)).toEqual({ x: -6, y: 0 });
  });
});

describe('Büro-Daten', () => {
  const { world, interactables } = buildOfficeWorld();

  it('Grundriss ist rechteckig und von Wänden umschlossen', () => {
    const w = OFFICE_MAP[0]!.length;
    for (const row of OFFICE_MAP) expect(row.length).toBe(w);
    expect(OFFICE_MAP[0]).toMatch(/^#+$/);
    for (const row of OFFICE_MAP) expect(row[0] === '#' && row[w - 1] === '#').toBe(true);
    expect(OFFICE_SIZE).toEqual({ w: w * TILE, h: OFFICE_MAP.length * TILE });
  });

  it('hat 8 Arbeitsplätze, und jeder ist vom Startpunkt aus erreichbar', () => {
    expect(DESKS).toHaveLength(8);
    expect(interactables.filter((i) => i.kind === 'desk')).toHaveLength(8);
    // Breitensuche auf einem 4-px-Raster mit der Spieler-Hitbox.
    const hb = TUNING.office.hitbox;
    const free = (x: number, y: number): boolean => !world.blocked({ x: x - hb.w / 2, y: y - hb.h, w: hb.w, h: hb.h });
    expect(free(SPAWN.x, SPAWN.y)).toBe(true);
    const step = 4;
    const key = (x: number, y: number): string => `${x},${y}`;
    const start = { x: Math.round(SPAWN.x / step) * step, y: Math.round(SPAWN.y / step) * step };
    const seen = new Set([key(start.x, start.y)]);
    const queue = [start];
    while (queue.length) {
      const p = queue.shift()!;
      for (const [dx, dy] of [[step, 0], [-step, 0], [0, step], [0, -step]] as const) {
        const n = { x: p.x + dx, y: p.y + dy };
        if (seen.has(key(n.x, n.y)) || !free(n.x, n.y)) continue;
        seen.add(key(n.x, n.y));
        queue.push(n);
      }
    }
    for (const d of DESKS) {
      const g = deskGeometry(d);
      const near = [...seen].some((k) => {
        const [x, y] = k.split(',').map(Number) as [number, number];
        return Math.hypot(x - g.standUp.x, y - g.standUp.y) <= TUNING.office.interactRadius;
      });
      expect(near, `Platz ${d.index} nicht erreichbar`).toBe(true);
    }
    // Auch das Chefbüro ist durch die Tür erreichbar.
    expect([...seen].some((k) => Number(k.split(',')[1]) < 9 * TILE && Number(k.split(',')[0]) > 26 * TILE)).toBe(true);
  });

  it('Objekte liegen innerhalb des Büros und haben bekannte Sprites', () => {
    const ids = new Set<string>();
    for (const o of OFFICE_OBJECTS) {
      expect(ids.has(o.id), `doppelte ID ${o.id}`).toBe(false);
      ids.add(o.id);
      const s = SPRITE_SIZE[o.sprite];
      expect(o.x).toBeGreaterThanOrEqual(0);
      expect(o.y).toBeGreaterThanOrEqual(0);
      expect(o.x + s.w).toBeLessThanOrEqual(OFFICE_SIZE.w);
      expect(o.y + s.h).toBeLessThanOrEqual(OFFICE_SIZE.h);
    }
  });
});

describe('Grafiken', () => {
  it('jedes Büro-Sprite hat die deklarierte Größe und Inhalt', () => {
    for (const key of Object.keys(SPRITE_SIZE) as OfficeSprite[]) {
      const g = buildSprite(key);
      expect([g.w, g.h]).toEqual([SPRITE_SIZE[key].w, SPRITE_SIZE[key].h]);
      expect(g.countFilled(), key).toBeGreaterThan(0);
    }
  });

  it('Boden deckt das ganze Büro ab', () => {
    const f = buildFloor();
    expect([f.w, f.h]).toEqual([OFFICE_SIZE.w, OFFICE_SIZE.h]);
    expect(f.countFilled()).toBe(f.w * f.h);
  });

  it('Figuren: alle Frames vorhanden, links = gespiegeltes rechts', () => {
    const sheet = buildSheet(PLAYER_LOOK);
    expect([sheet.w, sheet.h]).toEqual([CHAR_W * POSES.length, CHAR_H * FACINGS.length]);
    expect(frameIndex('up', 'sit')).toBe(3 * POSES.length + 4);
    const right = buildFrame(PLAYER_LOOK, 'right', 'walk1');
    const left = buildFrame(PLAYER_LOOK, 'left', 'walk1');
    for (let y = 0; y < CHAR_H; y++) for (let x = 0; x < CHAR_W; x++) expect(left.get(x, y)).toBe(right.get(CHAR_W - 1 - x, y));
    for (const f of FACINGS) for (const p of POSES) expect(buildFrame(PLAYER_LOOK, f, p).countFilled()).toBeGreaterThan(60);
  });
});

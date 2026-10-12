import { DESKS, deskGeometry, OFFICE_MAP, OFFICE_OBJECTS, OFFICE_SIZE, SOLID_TILES, TILE, TIMECLOCK } from '../../data/office';
import { CollisionWorld, type Rect } from './collision';
import type { Interactable } from './interaction';

/** Baut aus den Büro-Daten die Kollisionswelt und die Interaktionsziele. */
export function buildOfficeWorld(): { world: CollisionWorld; interactables: Interactable[] } {
  const boxes: Rect[] = OFFICE_OBJECTS.filter((o) => o.solid).map((o) => ({
    x: o.x + o.solid!.x,
    y: o.y + o.solid!.y,
    w: o.solid!.w,
    h: o.solid!.h,
  }));
  const isSolidTile = (tx: number, ty: number): boolean => {
    const row = OFFICE_MAP[ty];
    const ch = row?.[tx];
    return ch === undefined || SOLID_TILES.has(ch);
  };
  const world = new CollisionWorld(isSolidTile, boxes, TILE, { x: 0, y: 0, w: OFFICE_SIZE.w, h: OFFICE_SIZE.h });
  const interactables: Interactable[] = DESKS.map((d) => {
    const g = deskGeometry(d);
    return { id: `desk${d.index}`, kind: 'desk', x: g.standUp.x, y: g.standUp.y, ref: d.index, enabled: true };
  });
  interactables.push({ id: 'timeclock', kind: 'timeclock', x: TIMECLOCK.x, y: TIMECLOCK.y, ref: -1, enabled: true });
  return { world, interactables };
}

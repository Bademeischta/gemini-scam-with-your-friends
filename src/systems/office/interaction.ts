import type { Facing } from '../../gfx/characters';

/**
 * Interaktionssuche: Welches Objekt meint die Figur gerade?
 * Prüfpunkt liegt etwas vor den Füßen in Blickrichtung; gewählt wird das nächste Ziel im Radius.
 */
/** Arbeitsplatz oder Stempeluhr an der Wand (Ausstempeln, OS-07). */
export type InteractableKind = 'desk' | 'timeclock';

export interface Interactable {
  id: string;
  kind: InteractableKind;
  /** Zielpunkt (z. B. Stehplatz hinter dem Stuhl). */
  x: number;
  y: number;
  /** Zusatzdaten, z. B. Platznummer. */
  ref: number;
  enabled: boolean;
}

const DIR: Record<Facing, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function probePoint(x: number, y: number, facing: Facing, ahead: number): { x: number; y: number } {
  const d = DIR[facing];
  return { x: x + d.x * ahead, y: y + d.y * ahead };
}

export function findInteractable(
  list: readonly Interactable[],
  feet: { x: number; y: number },
  facing: Facing,
  radius: number,
  ahead: number,
): Interactable | null {
  const p = probePoint(feet.x, feet.y, facing, ahead);
  let best: Interactable | null = null;
  let bestD = radius;
  for (const it of list) {
    if (!it.enabled) continue;
    const d = Math.min(Math.hypot(it.x - p.x, it.y - p.y), Math.hypot(it.x - feet.x, it.y - feet.y));
    if (d <= bestD) {
      bestD = d;
      best = it;
    }
  }
  return best;
}

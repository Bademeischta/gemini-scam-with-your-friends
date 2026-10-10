/**
 * Richtungs-Navigation für Gamepad und Tastatur: Welches Element liegt von hier aus
 * „rechts“, „links“, „oben“ oder „unten“? Bewertet wird die Entfernung in Laufrichtung
 * plus (doppelt gewichtet) der seitliche Versatz – so fühlt sich die Navigation wie im OS an.
 */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type NavDir = 'up' | 'down' | 'left' | 'right';

export function center(r: Rect): { x: number; y: number } {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

export function pickInDirection(from: Rect, candidates: readonly Rect[], dir: NavDir): number {
  const c0 = center(from);
  let best = -1;
  let bestScore = Infinity;
  candidates.forEach((r, i) => {
    const c = center(r);
    const dx = c.x - c0.x;
    const dy = c.y - c0.y;
    let primary: number;
    let secondary: number;
    switch (dir) {
      case 'right':
        primary = dx;
        secondary = Math.abs(dy);
        break;
      case 'left':
        primary = -dx;
        secondary = Math.abs(dy);
        break;
      case 'down':
        primary = dy;
        secondary = Math.abs(dx);
        break;
      case 'up':
        primary = -dy;
        secondary = Math.abs(dx);
        break;
    }
    if (primary <= 1) return;
    const score = primary + secondary * 2;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

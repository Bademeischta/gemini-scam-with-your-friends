import { PixelGrid } from '../../gfx/PixelGrid';

/** Pixel-Art der Touch-Steuerelemente (Joystick, Buttons, Symbole). */

export function joystickRing(): PixelGrid {
  const g = new PixelGrid(32, 32);
  g.disc(16, 16, 15, 'paper').disc(16, 16, 13, 'ink2');
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if ((x - 16) ** 2 + (y - 16) ** 2 <= 10 * 10) g.set(x, y, null);
  // Richtungsmarken.
  g.set(16, 4, 'paper').set(16, 28, 'paper').set(4, 16, 'paper').set(28, 16, 'paper');
  return g;
}

export function joystickKnob(): PixelGrid {
  const g = new PixelGrid(16, 16);
  g.disc(8, 8, 7, 'paper').disc(8, 8, 5, 'fog').set(6, 5, 'white').set(5, 6, 'white');
  return g.outline('ink0');
}

export function actionButton(pressed: boolean): PixelGrid {
  const g = new PixelGrid(32, 32);
  g.disc(16, 16, 15, pressed ? 'mustardDark' : 'mustard').disc(16, 16, 13, pressed ? 'ink2' : 'ink1');
  if (!pressed) g.hline(9, 5, 14, 'sand');
  return g;
}

export function smallButton(): PixelGrid {
  const g = new PixelGrid(16, 16);
  g.rect(0, 0, 16, 16, 'paper').rect(1, 1, 14, 14, 'ink1');
  return g;
}

export type IconName = 'sit' | 'stand' | 'hand' | 'pause';

const ICONS: Record<IconName, readonly string[]> = {
  sit: [
    '....###......',
    '....#.#......',
    '....#.#......',
    '....#.#......',
    '....#.#######',
    '....#.......#',
    '....#########',
    '....#.....#..',
    '....#.....#..',
    '...###...###.',
    '.............',
  ],
  stand: [
    '......#......',
    '.....###.....',
    '....#####....',
    '......#......',
    '.....###.....',
    '.....###.....',
    '....#####....',
    '......#......',
    '.....#.#.....',
    '....#...#....',
    '....#...#....',
  ],
  hand: [
    '....#.#......',
    '...#.#.#.....',
    '...#.#.#.#...',
    '...#.#.#.#...',
    '...#######...',
    '.#.#######...',
    '.##########..',
    '..#########..',
    '...#######...',
    '....#####....',
    '....#####....',
  ],
  pause: [
    '...........',
    '...##.##...',
    '...##.##...',
    '...##.##...',
    '...##.##...',
    '...##.##...',
    '...##.##...',
    '...........',
  ],
};

export function icon(name: IconName): PixelGrid {
  const art = ICONS[name];
  const g = new PixelGrid(art[0]!.length, art.length);
  g.stamp(0, 0, art, { '#': 'white' });
  return g;
}

import type { PaletteName } from '../config/palette';
import { PixelGrid } from './PixelGrid';

/**
 * Figuren-Baukasten: setzt Spielfiguren, Bots, Chef und Polizei aus Teilen zusammen
 * (Haut, Frisur, Kleidung, Headset …) und erzeugt alle Animations-Frames per Code.
 * Frame 16×24 Art-Pixel, automatischer 1-px-Umriss.
 */

export const CHAR_W = 16;
export const CHAR_H = 24;

export type Facing = 'down' | 'left' | 'right' | 'up';
export const FACINGS: readonly Facing[] = ['down', 'left', 'right', 'up'];
/** Spalten im Spritesheet: 4 Lauf-Frames + Sitzen. */
export const POSES = ['walk0', 'walk1', 'walk2', 'walk3', 'sit'] as const;
export type Pose = (typeof POSES)[number];

export type HairStyle = 'short' | 'long' | 'bun' | 'spiky' | 'bald' | 'cap' | 'bob';

export interface Appearance {
  skin: 'skin1' | 'skin2' | 'skin3';
  hair: PaletteName;
  hairStyle: HairStyle;
  shirt: PaletteName;
  pants: PaletteName;
  shoes: PaletteName;
  headset: boolean;
  tie?: PaletteName;
  glasses?: boolean;
}

/** Dunklere Schattierung je Palettenfarbe (für Volumen). */
export const SHADE: Readonly<Record<PaletteName, PaletteName>> = {
  ink0: 'ink0', ink1: 'ink0', ink2: 'ink1', ink3: 'ink2', slate: 'ink3', fog: 'slate', paper: 'fog', white: 'paper',
  mustard: 'mustardDark', mustardDark: 'coffee', amber: 'rust', rust: 'wine', red: 'wine', wine: 'ink1', rose: 'wine', blush: 'rose',
  petrol: 'navy', teal: 'petrol', mint: 'teal', leaf: 'moss', moss: 'ink1', sky: 'blue', blue: 'navy', navy: 'ink1',
  violet: 'navy', lilac: 'violet', coffee: 'cocoa', cocoa: 'ink1', sand: 'coffee', skin1: 'skin2', skin2: 'skin3', skin3: 'cocoa',
};

export function frameIndex(facing: Facing, pose: Pose): number {
  return FACINGS.indexOf(facing) * POSES.length + POSES.indexOf(pose);
}

export function buildFrame(a: Appearance, facing: Facing, pose: Pose): PixelGrid {
  if (facing === 'left') return buildFrame(a, 'right', pose).mirrored();
  const g = new PixelGrid(CHAR_W, CHAR_H);
  const sit = pose === 'sit';
  const step = pose === 'walk1' ? 1 : pose === 'walk3' ? -1 : 0; // 1 = linkes Bein vorn
  const bob = step !== 0 ? -1 : 0;
  const oy = sit ? 2 : bob; // Oberkörper-Versatz
  const skin = a.skin;
  const skinD = SHADE[skin];
  const shirtD = SHADE[a.shirt];
  const pantsD = SHADE[a.pants];

  // ----- Beine (nicht im Sitzen: verdeckt durch Stuhl/Tisch) -----
  if (!sit) {
    if (facing === 'right') {
      const front = step === 0 ? 0 : step;
      g.rect(6 + Math.max(0, -front), 17, 2, 5, pantsD).rect(6 + Math.max(0, -front), 22, 3, 1, a.shoes);
      g.rect(8 + Math.max(0, front), 17, 2, 5, a.pants).rect(8 + Math.max(0, front), 22, 3, 1, a.shoes);
    } else {
      const lLift = step === 1 ? 1 : 0;
      const rLift = step === -1 ? 1 : 0;
      g.rect(5, 17, 2, 5 - lLift, a.pants).rect(5, 22 - lLift, 2, 1, a.shoes);
      g.rect(9, 17, 2, 5 - rLift, facing === 'up' ? a.pants : pantsD).rect(9, 22 - rLift, 2, 1, a.shoes);
    }
  }

  // ----- Oberkörper -----
  g.rect(4, 10 + oy, 8, 7, a.shirt);
  g.vline(11, 10 + oy, 7, shirtD);
  g.hline(4, 16 + oy, 8, sit ? shirtD : a.pants);
  if (facing === 'down' && a.tie) g.rect(7, 11 + oy, 2, 4, a.tie).set(7, 10 + oy, SHADE[a.tie]).set(8, 10 + oy, SHADE[a.tie]);
  if (facing === 'down') g.set(7, 10 + oy, skinD).set(8, 10 + oy, skinD);

  // ----- Arme -----
  const swing = step;
  if (facing === 'right') {
    const ax = 7 + swing;
    g.rect(ax, 11 + oy, 2, 4, shirtD).rect(ax, 15 + oy, 2, 1, skin);
  } else if (sit) {
    // Hände nach vorn auf der Tastatur.
    g.rect(3, 11 + oy, 1, 3, a.shirt).rect(12, 11 + oy, 1, 3, shirtD);
    g.set(3, 10 + oy, skin).set(12, 10 + oy, skin);
  } else {
    g.rect(3, 10 + oy + Math.max(0, swing), 1, 4, a.shirt).rect(3, 14 + oy + Math.max(0, swing), 1, 2, skin);
    g.rect(12, 10 + oy + Math.max(0, -swing), 1, 4, shirtD).rect(12, 14 + oy + Math.max(0, -swing), 1, 2, skin);
  }

  // ----- Kopf -----
  const hx = facing === 'right' ? 5 : 4;
  const hw = facing === 'right' ? 7 : 8;
  g.rect(hx, 2 + oy, hw, 8, skin);
  g.vline(hx + hw - 1, 3 + oy, 6, skinD);
  if (facing === 'down') {
    g.set(6, 6 + oy, 'ink0').set(9, 6 + oy, 'ink0');
    g.set(5, 7 + oy, 'blush').set(10, 7 + oy, 'blush');
    if (a.glasses) g.hline(5, 6 + oy, 6, 'ink0').set(6, 6 + oy, 'paper').set(9, 6 + oy, 'paper');
  } else if (facing === 'right') {
    g.set(9, 6 + oy, 'ink0').set(12, 6 + oy, skin);
    if (a.glasses) g.hline(8, 6 + oy, 3, 'ink0').set(9, 6 + oy, 'paper');
  }
  drawHair(g, a, facing, oy);

  // ----- Headset -----
  if (a.headset) {
    if (facing === 'down') {
      g.hline(4, 2 + oy, 8, 'ink1');
      g.rect(3, 5 + oy, 1, 3, 'ink1').rect(12, 5 + oy, 1, 3, 'ink1');
      g.set(4, 8 + oy, 'ink1').set(5, 9 + oy, 'ink1').set(6, 9 + oy, 'slate');
    } else if (facing === 'right') {
      g.vline(7, 2 + oy, 4, 'ink1').rect(6, 5 + oy, 2, 3, 'ink1');
      g.set(8, 8 + oy, 'ink1').set(9, 8 + oy, 'ink1').set(10, 8 + oy, 'slate');
    } else {
      g.hline(4, 3 + oy, 8, 'ink1').rect(3, 5 + oy, 1, 3, 'ink1').rect(12, 5 + oy, 1, 3, 'ink1');
    }
  }
  return g.outline('ink0');
}

function drawHair(g: PixelGrid, a: Appearance, facing: Facing, oy: number): void {
  const c = a.hair;
  const d = SHADE[c];
  const style = a.hairStyle;
  if (style === 'bald') {
    g.set(facing === 'right' ? 7 : 6, 3 + oy, 'white');
    return;
  }
  if (facing === 'up') {
    // Hinterkopf: fast alles Haar.
    const len = style === 'long' ? 10 : style === 'bob' ? 8 : 6;
    g.rect(4, 2 + oy, 8, len, c).vline(11, 3 + oy, len - 1, d);
    if (style === 'long') g.rect(3, 6 + oy, 1, 6, c).rect(12, 6 + oy, 1, 6, d);
    if (style === 'bun') g.rect(6, 0 + oy, 4, 2, c);
    if (style === 'spiky') g.set(5, 1 + oy, c).set(7, 1 + oy, c).set(9, 1 + oy, c);
    if (style === 'cap') g.rect(4, 2 + oy, 8, 3, c).hline(4, 4 + oy, 8, d);
    return;
  }
  if (facing === 'down') {
    if (style === 'cap') {
      g.rect(4, 2 + oy, 8, 3, c).hline(3, 5 + oy, 10, d);
      return;
    }
    g.rect(4, 2 + oy, 8, 3, c).hline(4, 4 + oy, 3, d);
    g.vline(4, 5 + oy, style === 'short' || style === 'spiky' || style === 'bun' ? 1 : 3, c);
    g.vline(11, 5 + oy, style === 'short' || style === 'spiky' || style === 'bun' ? 1 : 3, d);
    if (style === 'long') g.rect(3, 4 + oy, 1, 8, c).rect(12, 4 + oy, 1, 8, d);
    if (style === 'bob') g.rect(3, 4 + oy, 1, 5, c).rect(12, 4 + oy, 1, 5, d);
    if (style === 'bun') g.rect(6, 0 + oy, 4, 2, c);
    if (style === 'spiky') g.set(5, 1 + oy, c).set(7, 1 + oy, c).set(9, 1 + oy, c).set(11, 1 + oy, c);
    return;
  }
  // rechts (links wird gespiegelt)
  if (style === 'cap') {
    g.rect(5, 2 + oy, 7, 3, c).hline(9, 5 + oy, 4, d);
    return;
  }
  g.rect(5, 2 + oy, 7, 3, c).rect(5, 5 + oy, 3, style === 'short' || style === 'spiky' || style === 'bun' ? 2 : 4, c);
  if (style === 'long') g.rect(4, 4 + oy, 3, 8, c);
  if (style === 'bob') g.rect(4, 4 + oy, 3, 5, c);
  if (style === 'bun') g.rect(4, 1 + oy, 3, 3, c);
  if (style === 'spiky') g.set(6, 1 + oy, c).set(8, 1 + oy, c).set(10, 1 + oy, c);
  g.hline(9, 4 + oy, 3, d);
}

/** Alle Frames einer Figur (Zeilen = Blickrichtungen, Spalten = Posen). */
export function buildSheet(a: Appearance): PixelGrid {
  const sheet = new PixelGrid(CHAR_W * POSES.length, CHAR_H * FACINGS.length);
  FACINGS.forEach((f, row) =>
    POSES.forEach((p, col) => {
      sheet.blit(buildFrame(a, f, p), col * CHAR_W, row * CHAR_H);
    }),
  );
  return sheet;
}

/** Standard-Aussehen der Spielerfigur (änderbar im Figur-Editor, M8). */
export const PLAYER_LOOK: Appearance = {
  skin: 'skin1',
  hair: 'coffee',
  hairStyle: 'short',
  shirt: 'teal',
  pants: 'navy',
  shoes: 'ink1',
  headset: true,
};

/** Direktor Horst Brülling. */
export const BOSS_LOOK: Appearance = {
  skin: 'skin2',
  hair: 'fog',
  hairStyle: 'bald',
  shirt: 'paper',
  pants: 'ink2',
  shoes: 'cocoa',
  headset: false,
  tie: 'red',
  glasses: true,
};

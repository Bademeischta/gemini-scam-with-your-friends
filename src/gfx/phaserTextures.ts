import Phaser from 'phaser';
import { buildSheet, CHAR_H, CHAR_W, FACINGS, POSES, type Appearance } from './characters';
import type { PixelGrid } from './PixelGrid';

/** Überträgt ein PixelGrid als Canvas-Textur nach Phaser (einmalig, danach gecacht). */
export function gridTexture(scene: Phaser.Scene, key: string, grid: PixelGrid | (() => PixelGrid)): string {
  if (scene.textures.exists(key)) return key;
  const g = typeof grid === 'function' ? grid() : grid;
  const tex = scene.textures.createCanvas(key, g.w, g.h);
  if (!tex) throw new Error(`Textur ${key} konnte nicht erzeugt werden`);
  g.drawTo(tex.getContext(), 0, 0, 1);
  tex.refresh();
  return key;
}

/**
 * Erzeugt das Spritesheet einer Figur. Frames sind nummeriert:
 * Index = Richtung × POSES.length + Pose (siehe characters.frameIndex).
 */
export function characterTexture(scene: Phaser.Scene, key: string, look: Appearance): string {
  if (scene.textures.exists(key)) return key;
  const sheet = buildSheet(look);
  const tex = scene.textures.createCanvas(key, sheet.w, sheet.h);
  if (!tex) throw new Error(`Textur ${key} konnte nicht erzeugt werden`);
  sheet.drawTo(tex.getContext(), 0, 0, 1);
  tex.refresh();
  FACINGS.forEach((_, row) =>
    POSES.forEach((__, col) => {
      tex.add(row * POSES.length + col, 0, col * CHAR_W, row * CHAR_H, CHAR_W, CHAR_H);
    }),
  );
  return key;
}

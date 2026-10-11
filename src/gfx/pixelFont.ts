import Phaser from 'phaser';
import {
  FONT_CELL_HEIGHT,
  FONT_LETTER_SPACING,
  FONT_LINE_HEIGHT,
  FONT_SPACE_WIDTH,
  GLYPHS,
  parseGlyph,
  type ParsedGlyph,
} from './fontGlyphs';

export const PIXEL_FONT = 'schwindel';

export interface AtlasEntry {
  glyph: ParsedGlyph;
  x: number;
  y: number;
}

/** Ordnet alle Glyphen in einem Atlas an (1 px Abstand, Zeilenumbruch bei `maxWidth`). */
export function layoutAtlas(maxWidth = 256): { entries: AtlasEntry[]; width: number; height: number } {
  const glyphs: ParsedGlyph[] = [
    { char: ' ', top: 0, width: FONT_SPACE_WIDTH, height: 0, pixels: [] },
    // Geschütztes Leerzeichen („73 %“ bricht nicht um).
    { char: '\u00a0', top: 0, width: FONT_SPACE_WIDTH, height: 0, pixels: [] },
    ...GLYPHS.map(parseGlyph),
  ];
  const entries: AtlasEntry[] = [];
  let x = 1;
  let y = 1;
  let width = 0;
  for (const g of glyphs) {
    if (x + g.width + 1 > maxWidth) {
      x = 1;
      y += FONT_CELL_HEIGHT + 1;
    }
    entries.push({ glyph: g, x, y });
    x += g.width + 1;
    width = Math.max(width, x);
  }
  return { entries, width, height: y + FONT_CELL_HEIGHT + 1 };
}

/**
 * Erzeugt die Pixel-Schrift als Canvas-Textur und registriert sie als Phaser-Bitmap-Font.
 * Glyphen sind weiß; Farbe kommt per Tint.
 */
export function registerPixelFont(scene: Phaser.Scene): void {
  if (scene.cache.bitmapFont.exists(PIXEL_FONT)) return;
  const atlas = layoutAtlas();
  const tex = scene.textures.createCanvas(PIXEL_FONT, atlas.width, atlas.height);
  if (!tex) throw new Error('Font-Textur konnte nicht erzeugt werden');
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, atlas.width, atlas.height);
  ctx.fillStyle = '#ffffff';
  for (const { glyph, x, y } of atlas.entries) {
    glyph.pixels.forEach((row, gy) =>
      row.forEach((on, gx) => {
        if (on) ctx.fillRect(x + gx, y + glyph.top + gy, 1, 1);
      }),
    );
  }
  tex.refresh();

  const chars: Record<number, Phaser.Types.GameObjects.BitmapText.BitmapFontCharacterData> = {};
  const frame = tex.get();
  for (const { glyph, x, y } of atlas.entries) {
    const code = glyph.char.charCodeAt(0);
    const w = glyph.width;
    const h = FONT_CELL_HEIGHT;
    const u0 = (frame.cutX + x) / atlas.width;
    const v0 = (frame.cutY + y) / atlas.height;
    const u1 = (frame.cutX + x + w) / atlas.width;
    const v1 = (frame.cutY + y + h) / atlas.height;
    // xAdvance wird von Phaser zur Laufzeit gelesen, fehlt aber in den Typdefinitionen.
    const entry = {
      x,
      y,
      width: w,
      height: h,
      centerX: Math.floor(w / 2),
      centerY: Math.floor(h / 2),
      xOffset: 0,
      yOffset: 0,
      xAdvance: w + FONT_LETTER_SPACING,
      data: {},
      kerning: {},
      u0,
      v0,
      u1,
      v1,
    };
    chars[code] = entry;
    const charFrame = tex.add(glyph.char, 0, x, y, w, h);
    charFrame?.setUVs(w, h, u0, v0, u1, v1);
  }

  scene.cache.bitmapFont.add(PIXEL_FONT, {
    data: { font: PIXEL_FONT, size: FONT_CELL_HEIGHT, lineHeight: FONT_LINE_HEIGHT, retroFont: false, chars },
    texture: PIXEL_FONT,
    frame: null,
  });
}

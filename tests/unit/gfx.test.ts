import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { hex, PALETTE, rgb } from '../../src/config/palette';
import { FONT_CELL_HEIGHT, GLYPHS, parseGlyph, supportedChars } from '../../src/gfx/fontGlyphs';
import { ICON_ART_SIZE, renderIconRGBA } from '../../src/gfx/iconArt';
import { HANDSET_ART, HANDSET_LEGEND, validateArt } from '../../src/gfx/pixelArt';
import { designSkyline } from '../../src/gfx/skyline';
import { hashSeed, Rng } from '../../src/systems/rng/rng';
import { crc32, encodePNG } from '../../scripts/png';

describe('Palette „Schwindel-32“', () => {
  it('hat genau 32 eindeutige, gültige Farben', () => {
    const values = Object.values(PALETTE);
    expect(values).toHaveLength(32);
    expect(new Set(values).size).toBe(32);
    for (const v of values) expect(v).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('wandelt Farben um', () => {
    expect(hex('white')).toBe(0xf7f3ea);
    expect(rgb('ink0')).toEqual([0x0f, 0x0d, 0x16]);
  });
});

describe('Pixel-Schrift', () => {
  it('alle Glyphen sind gültig und passen in die Zelle', () => {
    for (const g of GLYPHS) {
      const p = parseGlyph(g);
      expect(p.top + p.height).toBeLessThanOrEqual(FONT_CELL_HEIGHT);
      expect(p.width).toBeGreaterThan(0);
      expect(p.pixels.flat().some(Boolean), `leere Glyphe ${p.char}`).toBe(true);
    }
  });

  it('keine doppelten Zeichen; Umlaute, ß und Taler sind dabei', () => {
    const chars = GLYPHS.map((g) => g[0]);
    expect(new Set(chars).size).toBe(chars.length);
    for (const c of 'ÄÖÜäöüß₮€&„“–…0123456789') expect(supportedChars().has(c), c).toBe(true);
    for (let c = 65; c <= 90; c++) expect(supportedChars().has(String.fromCharCode(c))).toBe(true);
    for (let c = 97; c <= 122; c++) expect(supportedChars().has(String.fromCharCode(c))).toBe(true);
  });

  it('erkennt fehlerhafte Glyphen', () => {
    expect(() => parseGlyph(['x', 0, '## #'])).toThrow();
    expect(() => parseGlyph(['x', 0, '#a'])).toThrow();
    expect(() => parseGlyph(['x', 9, '# #'])).toThrow();
  });
});

describe('Pixel-Art', () => {
  it('der Hörer ist ein sauberes Raster mit bekannter Legende', () => {
    expect(() => validateArt(HANDSET_ART, HANDSET_LEGEND)).not.toThrow();
    expect(() => validateArt(['ab', 'a'], { a: 'red' })).toThrow();
  });
});

describe('App-Icons', () => {
  it('rendert ganzzahlig skaliert; maskable ist vollflächig', () => {
    const any = renderIconRGBA(192, false);
    const mask = renderIconRGBA(512, true);
    expect(any.length).toBe(192 * 192 * 4);
    // Ecke des normalen Icons ist transparent (abgerundet), maskable deckend.
    expect(any[3]).toBe(0);
    expect(mask[3]).toBe(255);
    expect(ICON_ART_SIZE).toBe(32);
  });

  it('PNG-Encoder erzeugt gültige Dateien (Signatur, CRC, Daten)', () => {
    const w = 4;
    const h = 3;
    const rgba = new Uint8Array(w * h * 4).map((_, i) => (i * 37) & 0xff);
    const png = encodePNG(w, h, rgba);
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const view = new DataView(png.buffer);
    // IHDR
    expect(view.getUint32(8)).toBe(13);
    expect(String.fromCharCode(...png.subarray(12, 16))).toBe('IHDR');
    expect(view.getUint32(16)).toBe(w);
    expect(view.getUint32(20)).toBe(h);
    expect(view.getUint32(29)).toBe(crc32(png.subarray(12, 29)));
    // IDAT entpacken und Pixel vergleichen
    const idatLen = view.getUint32(33);
    expect(String.fromCharCode(...png.subarray(37, 41))).toBe('IDAT');
    const raw = inflateSync(png.subarray(41, 41 + idatLen));
    for (let y = 0; y < h; y++) {
      expect(raw[y * (w * 4 + 1)]).toBe(0);
      expect([...raw.subarray(y * (w * 4 + 1) + 1, (y + 1) * (w * 4 + 1))]).toEqual([...rgba.subarray(y * w * 4, (y + 1) * w * 4)]);
    }
    expect(String.fromCharCode(...png.subarray(png.length - 8, png.length - 4))).toBe('IEND');
    expect(() => encodePNG(2, 2, new Uint8Array(3))).toThrow();
  });

  it('CRC32 entspricht dem Referenzwert', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
});

describe('Zufall', () => {
  it('ist deterministisch je Seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
    for (const v of seqA) expect(v).toBeGreaterThanOrEqual(0), expect(v).toBeLessThan(1);
    expect(new Rng(43).next()).not.toBe(seqA[0]);
  });

  it('int/pick bleiben im Bereich und sind gleichmäßig genug', () => {
    const r = new Rng(1);
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < 8000; i++) counts[r.int(0, 3)]!++;
    for (const c of counts) expect(c).toBeGreaterThan(1700);
    expect(() => r.pick([])).toThrow();
    expect(['a', 'b']).toContain(r.pick(['a', 'b']));
  });

  it('Schicht-Codes werden zu stabilen Seeds', () => {
    expect(hashSeed('MASCHE-42')).toBe(hashSeed('MASCHE-42'));
    expect(hashSeed('MASCHE-42')).not.toBe(hashSeed('MASCHE-43'));
  });
});

describe('Skyline', () => {
  it('ist deterministisch und bleibt im Bild', () => {
    const a = designSkyline(320, 180);
    const b = designSkyline(320, 180);
    expect(a).toEqual(b);
    for (const w of a.windows) {
      expect(w.x).toBeGreaterThanOrEqual(-8);
      expect(w.x + w.w).toBeLessThanOrEqual(320 + 8);
      expect(w.y + w.h).toBeLessThanOrEqual(180);
    }
    expect(a.stars.length).toBeGreaterThan(10);
  });

  it('Fenster der hinteren Reihe liegen nie hinter vorderen Häusern oder dem Callcenter', () => {
    const m = designSkyline(400, 220, 99);
    const front = [
      ...m.buildings.filter((b) => b.layer === 1).map((b) => ({ x: b.x, w: b.w, top: m.height - b.h })),
      { x: m.office.x - 1, w: m.office.w + 2, top: m.office.y - 2 },
    ];
    for (const w of m.windows.filter((w) => w.layer === 0)) {
      const hidden = front.some((b) => w.x + w.w > b.x && w.x < b.x + b.w && w.y + w.h > b.top);
      expect(hidden).toBe(false);
    }
  });
});

/**
 * „Schwindel-32“ – die einzige Farbpalette des Spiels.
 * Warmes Neon-Büro bei Nacht: Senf, Petrol, Altrosa, Kaffeebraun.
 * Alle Grafiken (Pixel-Art, UI, Partikel) verwenden ausschließlich diese Farben.
 */
export const PALETTE = {
  ink0: '#0f0d16',
  ink1: '#1d1a2b',
  ink2: '#2c2840',
  ink3: '#45405e',
  slate: '#6b6687',
  fog: '#9d99b5',
  paper: '#d8d3e4',
  white: '#f7f3ea',
  mustard: '#f2b134',
  mustardDark: '#c27d1c',
  amber: '#ff8a3d',
  rust: '#c4472e',
  red: '#e8434f',
  wine: '#8a2442',
  rose: '#e8749a',
  blush: '#f5b5c4',
  petrol: '#1f6f78',
  teal: '#2fa5a0',
  mint: '#7fe0b0',
  leaf: '#4f9a4a',
  moss: '#2e5a35',
  sky: '#5bc0ff',
  blue: '#3a6fd8',
  navy: '#23336b',
  violet: '#7a4fd1',
  lilac: '#b59af0',
  coffee: '#6b4430',
  cocoa: '#3f2a22',
  sand: '#d9b384',
  skin1: '#f1c7a0',
  skin2: '#c98d63',
  skin3: '#8a5a3c',
} as const;

export type PaletteName = keyof typeof PALETTE;

/** Farbe als Zahl (0xRRGGBB) für Phaser-Tints und Graphics. */
export function hex(name: PaletteName): number {
  return parseInt(PALETTE[name].slice(1), 16);
}

/** Farbe als [r, g, b] (0–255), z. B. für den PNG-Encoder. */
export function rgb(name: PaletteName): [number, number, number] {
  const n = hex(name);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

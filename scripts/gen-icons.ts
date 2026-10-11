/**
 * Erzeugt alle App-Icons (PWA, Favicon, Apple-Touch) aus der Pixel-Art in src/gfx/iconArt.ts.
 * Läuft automatisch vor `dev`, `build` und `build:e2e`. Ausgabe: public/icons/ (nicht eingecheckt).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderIconRGBA } from '../src/gfx/iconArt';
import { encodePNG } from './png';

const outDir = fileURLToPath(new URL('../public/icons/', import.meta.url));
mkdirSync(outDir, { recursive: true });

const targets: { file: string; size: number; maskable: boolean }[] = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'maskable-512.png', size: 512, maskable: true },
  { file: 'apple-touch-icon.png', size: 180, maskable: true },
  { file: 'favicon-32.png', size: 32, maskable: false },
  { file: 'favicon-64.png', size: 64, maskable: false },
];

for (const t of targets) {
  const png = encodePNG(t.size, t.size, renderIconRGBA(t.size, t.maskable));
  writeFileSync(outDir + t.file, png);
}
console.log(`Icons erzeugt: ${targets.map((t) => t.file).join(', ')}`);

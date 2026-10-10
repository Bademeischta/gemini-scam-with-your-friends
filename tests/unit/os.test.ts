import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_BINDINGS } from '../../src/config/input-defaults';
import { OS_THEME_IDS, WALLPAPERS } from '../../src/data/os/appearance';
import { START_FILES, START_TRASH } from '../../src/data/os/files';
import { FEELS_COUNT, FORECASTS } from '../../src/data/os/weather';
import de from '../../src/data/i18n/de.json';
import { buildOsIcon, buildWallpaper, buildWeatherIcon, OS_ICONS } from '../../src/gfx/osArt';
import { collectKeys, type Dict } from '../../src/i18n/i18n';
import { InputManager } from '../../src/systems/input/InputManager';
import { Calculator, calcKeyFor, format, type CalcKey } from '../../src/systems/os/calculator';
import { FOLDERS, VirtualFs } from '../../src/systems/os/vfs';
import { forecast, weatherOn } from '../../src/systems/os/weather';
import { SettingsStore } from '../../src/systems/save/settings';
import { pickInDirection, type Rect } from '../../src/ui/os/focusNav';

const press = (c: Calculator, keys: string): string => {
  for (const k of keys.split(' ')) c.press(k as CalcKey);
  return c.display;
};

describe('Rechner', () => {
  it('rechnet als Kette von links nach rechts (wie ein Taschenrechner)', () => {
    expect(press(new Calculator(), '1 2 + 3 0 =')).toBe('42');
    expect(press(new Calculator(), '2 + 3 × 4 =')).toBe('20');
    expect(press(new Calculator(), '7 ÷ 2 =')).toBe('3,5');
  });

  it('Dezimalkomma, Vorzeichen, Rücktaste und Löschen', () => {
    expect(press(new Calculator(), ', 5 + 1 =')).toBe('1,5');
    expect(press(new Calculator(), '1 2 3 ⌫')).toBe('12');
    expect(press(new Calculator(), '9 ±')).toBe('-9');
    expect(press(new Calculator(), '9 + 9 C')).toBe('0');
  });

  it('Division durch null gibt eine freche Antwort, danach geht es normal weiter', () => {
    const c = new Calculator('Nö.');
    expect(press(c, '5 ÷ 0 =')).toBe('Nö.');
    expect(press(c, '+')).toBe('Nö.');
    expect(press(c, '3')).toBe('3');
  });

  it('begrenzt Stellen und formatiert große Zahlen', () => {
    expect(press(new Calculator(), '1 2 3 4 5 6 7 8 9 0 1 2 3 4')).toBe('123456789012');
    expect(format(0.1 + 0.2)).toBe('0,3');
    expect(format(1e13)).toContain('e');
  });

  it('Tastatur wird auf Rechnertasten abgebildet', () => {
    expect(calcKeyFor('7')).toBe('7');
    expect(calcKeyFor('.')).toBe(',');
    expect(calcKeyFor('*')).toBe('×');
    expect(calcKeyFor('/')).toBe('÷');
    expect(calcKeyFor('Enter')).toBe('=');
    expect(calcKeyFor('Backspace')).toBe('⌫');
    expect(calcKeyFor('w')).toBeNull();
  });
});

describe('Virtuelles Dateisystem', () => {
  it('löscht in den Papierkorb, stellt wieder her und leert ihn', () => {
    const fs = new VirtualFs(START_FILES, START_TRASH);
    let changes = 0;
    fs.onChange(() => changes++);
    const docs = fs.list('docs').length;
    expect(fs.delete('passwoerter')).toBe(true);
    expect(fs.list('docs')).toHaveLength(docs - 1);
    expect(fs.isTrashed('passwoerter')).toBe(true);
    expect(fs.restore('passwoerter')).toBe(true);
    expect(fs.list('docs')).toHaveLength(docs);
    expect(fs.emptyTrash()).toBe(START_TRASH.length);
    expect(fs.trash()).toHaveLength(0);
    expect(fs.delete('gibtsnicht')).toBe(false);
    expect(changes).toBe(3);
  });

  it('Startinhalt verändert die Vorlage nicht', () => {
    const fs = new VirtualFs(START_FILES, START_TRASH);
    fs.delete('leitfaden');
    expect(new VirtualFs(START_FILES, START_TRASH).list('docs').some((f) => f.id === 'leitfaden')).toBe(true);
  });
});

describe('Fokus-Navigation', () => {
  const r = (x: number, y: number): Rect => ({ x, y, w: 10, h: 10 });
  it('wählt das nächste Element in Richtung, seitlicher Versatz zählt doppelt', () => {
    const from = r(100, 100);
    const cands = [r(130, 100), r(120, 140), r(100, 60), r(60, 100), r(200, 105)];
    expect(pickInDirection(from, cands, 'right')).toBe(0);
    expect(pickInDirection(from, cands, 'down')).toBe(1);
    expect(pickInDirection(from, cands, 'up')).toBe(2);
    expect(pickInDirection(from, cands, 'left')).toBe(3);
    expect(pickInDirection(from, [r(100, 100)], 'right')).toBe(-1);
  });
});

describe('Wetter', () => {
  it('ist fest pro Tag und die Vorhersage von gestern stimmt heute', () => {
    expect(weatherOn(3)).toEqual(weatherOn(3));
    expect(forecast(2)[1]).toEqual(weatherOn(3));
    for (let d = 1; d < 40; d++) {
      const w = weatherOn(d);
      expect(w.id).not.toBe(weatherOn(d + 1).id);
      expect(w.temp).toBeGreaterThanOrEqual(-5);
      expect(w.temp).toBeLessThanOrEqual(38);
      expect(w.chance % 5).toBe(0);
      expect(w.feels).toBeLessThan(FEELS_COUNT);
    }
  });
});

describe('MogelOS-Einstellungen', () => {
  it('Hintergrund und Farbschema werden gespeichert und geprüft', () => {
    expect(SettingsStore.sanitize({ osWallpaper: 'nacht', osTheme: 'petrol' })).toMatchObject({ osWallpaper: 'nacht', osTheme: 'petrol' });
    expect(SettingsStore.sanitize({ osWallpaper: 'ufo', osTheme: 42 })).toMatchObject({ osWallpaper: 'mogel', osTheme: 'klassik' });
  });
});

describe('Texteingabe', () => {
  it('liefert getippte Zeichen pro Frame, aber nicht mit Strg/Alt', () => {
    const im = new InputManager(DEFAULT_BINDINGS, { getGamepads: () => [] }, { stickDeadzone: 0.3 });
    im.handleKeyDown('Digit4', false, false, '4');
    im.handleKeyDown('Enter', false, false, 'Enter');
    im.handleKeyDown('ShiftLeft', false, false, 'Shift');
    im.handleKeyDown('KeyR', false, false, 'r', true);
    im.beginFrame();
    expect(im.typed()).toEqual(['4', 'Enter']);
    expect(im.justPressed('uiConfirm')).toBe(true);
    im.endFrame();
    im.beginFrame();
    expect(im.typed()).toEqual([]);
  });

  it('Strg+Tab löst kein Aufstehen aus (Browser-Kürzel)', () => {
    const im = new InputManager(DEFAULT_BINDINGS, { getGamepads: () => [] }, { stickDeadzone: 0.3 });
    expect(im.handleKeyDown('Tab', false, false, 'Tab', true)).toBe(false);
    im.beginFrame();
    expect(im.justPressed('leave')).toBe(false);
  });
});

describe('MogelOS-Inhalte', () => {
  const keys = new Set(collectKeys(de as Dict));

  it('alle dynamischen Schlüssel existieren (Apps, Dateien, Ordner, Wetter, Erscheinungsbild)', () => {
    const needed: string[] = [];
    for (const f of [...START_FILES, ...START_TRASH]) needed.push(f.nameKey, f.contentKey);
    for (const f of FOLDERS) needed.push(`os.files.folders.${f}`);
    for (const f of FORECASTS) needed.push(`os.weather.forecast.${f.id}`);
    for (let i = 0; i < FEELS_COUNT; i++) needed.push(`os.weather.feels.${i}`);
    for (const w of WALLPAPERS) needed.push(`os.settings.wallpapers.${w}`);
    for (const th of OS_THEME_IDS) needed.push(`os.settings.themes.${th}`);
    // titleKey/shortKey der App-Definitionen stehen als Literale im Quelltext.
    const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
    for (const file of walk('src/ui/os/apps')) {
      for (const m of readFileSync(file, 'utf8').matchAll(/(?:titleKey|shortKey): '([a-zA-Z0-9_.]+)'/g)) needed.push(m[1]!);
    }
    expect(needed.length).toBeGreaterThan(40);
    for (const k of needed) expect(keys.has(k), `fehlender Schlüssel: ${k}`).toBe(true);
  });

  it('Symbole, Wetterbilder und Hintergründe lassen sich erzeugen', () => {
    for (const name of OS_ICONS) {
      const g = buildOsIcon(name);
      expect([g.w, g.h]).toEqual([16, 16]);
      expect(g.px.some((p) => p !== null)).toBe(true);
    }
    for (const w of ['sun', 'cloud', 'rain', 'storm', 'fog', 'rocket'] as const) expect(buildWeatherIcon(w).px.some((p) => p !== null)).toBe(true);
    for (const wp of WALLPAPERS) {
      const g = buildWallpaper(wp, 64, 40);
      // Hintergründe sind deckend (keine Löcher).
      expect(g.px.every((p) => p !== null)).toBe(true);
    }
  });
});

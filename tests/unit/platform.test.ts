import { describe, expect, it } from 'vitest';
import { shouldShowRotateHint } from '../../src/systems/platform/orientation';
import { DEFAULT_SETTINGS, SettingsStore } from '../../src/systems/save/settings';
import { SafeStorage, type KeyValueStore } from '../../src/systems/save/storage';
import { clampDpr, computeViewport, parsePx, pixelScale, safeRect, ZERO_INSETS } from '../../src/systems/viewport/viewportMath';

describe('Viewport', () => {
  it('rechnet in physische Pixel um (Retina)', () => {
    const vp = computeViewport(412, 839, 2.625, 3, ZERO_INSETS);
    expect(vp.width).toBe(1082);
    expect(vp.height).toBe(2202);
    expect(vp.orientation).toBe('portrait');
  });

  it('deckelt die Pixeldichte und fängt Unsinn ab', () => {
    expect(clampDpr(4, 3)).toBe(3);
    expect(clampDpr(0.5, 3)).toBe(1);
    expect(clampDpr(Number.NaN, 3)).toBe(1);
    expect(computeViewport(0, 0, 1, 3, ZERO_INSETS).width).toBe(1);
  });

  it('Safe Area wird skaliert und als Rechteck nutzbar', () => {
    const vp = computeViewport(844, 390, 3, 3, { top: 0, right: 47, bottom: 21, left: 47 });
    expect(vp.safe).toEqual({ top: 0, right: 141, bottom: 63, left: 141 });
    const r = safeRect(vp, 30);
    expect(r).toEqual({ x: 171, y: 30, width: 844 * 3 - 141 - 30 - 171, height: 390 * 3 - 63 - 30 - 30 });
  });

  it('Pixel-Skalierung ist immer ganzzahlig und ≥ 1', () => {
    for (const dpr of [1, 1.25, 1.5, 2, 2.625, 3]) {
      const vp = computeViewport(800, 600, dpr, 3, ZERO_INSETS);
      const s = pixelScale(vp, 2);
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(1);
    }
    expect(pixelScale(computeViewport(800, 600, 1, 3, ZERO_INSETS), 0.1)).toBe(1);
  });

  it('liest CSS-Pixelwerte robust', () => {
    expect(parsePx('47px')).toBe(47);
    expect(parsePx('')).toBe(0);
    expect(parsePx(null)).toBe(0);
    expect(parsePx('-3px')).toBe(0);
  });
});

describe('Ausrichtungs-Hinweis', () => {
  it('nur Handy im Hochformat und nur bis zum Wegklicken', () => {
    expect(shouldShowRotateHint('phone', 'portrait', false)).toBe(true);
    expect(shouldShowRotateHint('phone', 'portrait', true)).toBe(false);
    expect(shouldShowRotateHint('phone', 'landscape', false)).toBe(false);
    expect(shouldShowRotateHint('tablet', 'portrait', false)).toBe(false);
    expect(shouldShowRotateHint('desktop', 'portrait', false)).toBe(false);
  });
});

class MapStore implements KeyValueStore {
  readonly map = new Map<string, string>();
  getItem(k: string): string | null {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v);
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
}

class BrokenStore implements KeyValueStore {
  getItem(): string | null {
    throw new Error('SecurityError');
  }
  setItem(): void {
    throw new Error('QuotaExceededError');
  }
  removeItem(): void {
    throw new Error('SecurityError');
  }
}

describe('Speicher', () => {
  it('speichert JSON mit Präfix', () => {
    const backend = new MapStore();
    const st = new SafeStorage(backend);
    st.write('x', { a: 1 });
    expect(backend.map.get('masche.x')).toBe('{"a":1}');
    expect(st.read('x', null)).toEqual({ a: 1 });
    st.remove('x');
    expect(st.read('x', 'leer')).toBe('leer');
  });

  it('übersteht gesperrten oder vollen Speicher (Privatmodus)', () => {
    const st = new SafeStorage(new BrokenStore());
    expect(() => st.write('x', 5)).not.toThrow();
    expect(st.read('x', 0)).toBe(5);
    expect(() => st.remove('x')).not.toThrow();
    const none = new SafeStorage(null);
    none.write('y', 'z');
    expect(none.read('y', '')).toBe('z');
  });

  it('beschädigtes JSON liefert den Standardwert', () => {
    const backend = new MapStore();
    backend.setItem('masche.bad', '{kaputt');
    expect(new SafeStorage(backend).read('bad', 42)).toBe(42);
  });

  it('Einstellungen: Standardwerte, Bereinigung, Speichern', () => {
    const backend = new MapStore();
    backend.setItem('masche.settings.v1', JSON.stringify({ masterVolume: 7, vibration: 'ja', locale: 'en', fremd: true }));
    const store = new SettingsStore(new SafeStorage(backend));
    expect(store.get()).toEqual({ ...DEFAULT_SETTINGS, locale: 'en' });
    let seen = false;
    store.onChange(() => (seen = true));
    store.update({ portraitAccepted: true, uiVolume: 0.3 });
    expect(seen).toBe(true);
    expect(JSON.parse(backend.getItem('masche.settings.v1')!)).toMatchObject({ portraitAccepted: true, uiVolume: 0.3 });
  });
});

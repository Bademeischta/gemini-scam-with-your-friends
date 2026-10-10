import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import de from '../../src/data/i18n/de.json';
import en from '../../src/data/i18n/en.json';
import { supportedChars } from '../../src/gfx/fontGlyphs';
import { collectKeys, collectStrings, I18n, type Dict } from '../../src/i18n/i18n';

const make = (locale = 'de', onMissing?: (k: string) => void): I18n =>
  new I18n({
    locales: {
      de: { a: { b: 'Hallo {name}' }, money: '{amount} ₮', items: { one: '{count} Masche', other: '{count} Maschen' }, onlyDe: 'nur deutsch' },
      en: { a: { b: 'Hello {name}' }, items: { one: '{count} scheme', other: '{count} schemes' } },
    },
    fallback: 'de',
    locale,
    ...(onMissing ? { onMissing } : {}),
  });

describe('I18n', () => {
  it('übersetzt mit Platzhaltern', () => {
    expect(make().t('a.b', { name: 'Hildegard' })).toBe('Hallo Hildegard');
    expect(make('en').t('a.b', { name: 'Hildegard' })).toBe('Hello Hildegard');
  });

  it('formatiert Zahlen-Platzhalter nach Sprache', () => {
    expect(make().t('money', { amount: 1250 })).toBe('1.250 ₮');
  });

  it('wählt Pluralformen', () => {
    const i = make();
    expect(i.t('items', { count: 1 })).toBe('1 Masche');
    expect(i.t('items', { count: 3 })).toBe('3 Maschen');
    expect(make('en').t('items', { count: 1 })).toBe('1 scheme');
  });

  it('fällt auf Deutsch und dann auf den Schlüssel zurück', () => {
    const missing = vi.fn();
    const i = make('en', missing);
    expect(i.t('onlyDe')).toBe('nur deutsch');
    expect(i.t('gibt.es.nicht')).toBe('gibt.es.nicht');
    expect(missing).toHaveBeenCalledTimes(2);
  });

  it('wechselt die Sprache und benachrichtigt', () => {
    const i = make();
    const fn = vi.fn();
    i.onChange(fn);
    i.setLocale('en');
    i.setLocale('xx');
    expect(i.locale).toBe('en');
    expect(fn).toHaveBeenCalledWith('en');
  });

  it('formatiert Geld als Taler', () => {
    const i = new I18n({ locales: { de: de as Dict }, fallback: 'de' });
    expect(i.formatMoney(2600)).toBe('2.600 ₮');
  });
});

// ---------- Datei-übergreifende Prüfungen ----------

function walk(dir: string, exts: string[]): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p, exts);
    return exts.some((e) => p.endsWith(e)) ? [p] : [];
  });
}

const deKeys = new Set(collectKeys(de as Dict));

describe('Sprachdateien', () => {
  it('Englisch enthält nur Schlüssel, die es auch auf Deutsch gibt', () => {
    for (const k of collectKeys(en as Dict)) expect(deKeys.has(k), k).toBe(true);
  });

  it('jeder im Code verwendete Schlüssel existiert', () => {
    const files = walk('src', ['.ts']);
    const used: string[] = [];
    const dynamic: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) used.push(m[1]!);
      for (const m of src.matchAll(/\bt\(\s*`([a-zA-Z0-9_.${}]+)`/g)) dynamic.push(m[1]!);
      for (const m of src.matchAll(/\bt\(\s*[^'`)]*\?\s*'([a-zA-Z0-9_.]+)'\s*:\s*'([a-zA-Z0-9_.]+)'/g)) used.push(m[1]!, m[2]!);
    }
    const html = readFileSync('index.html', 'utf8');
    for (const m of html.matchAll(/data-i18n(?:-aria)?="([^"]+)"/g)) used.push(m[1]!);
    expect(used.length).toBeGreaterThan(10);
    for (const k of used) expect(deKeys.has(k), `fehlender Schlüssel: ${k}`).toBe(true);
    // Dynamische Schlüssel mit ${mode} (z. B. title.pressStart.${mode}) müssen für alle Hinweis-Modi existieren.
    // Andere dynamische Schlüssel (z. B. keys.${code}) werden im Code per i18n.has() abgesichert.
    for (const pattern of dynamic.filter((p) => p.includes('${mode}'))) {
      for (const mode of ['touch', 'desktop', 'gamepad']) {
        const key = pattern.replace(/\$\{[^}]+\}/g, mode);
        expect(deKeys.has(key), `fehlender dynamischer Schlüssel: ${key}`).toBe(true);
      }
    }
  });

  it('die Pixel-Schrift kann jeden deutschen Text darstellen', () => {
    const chars = supportedChars();
    const missing = new Set<string>();
    for (const s of collectStrings(de as Dict)) {
      const plain = s.replace(/\{\w+\}/g, '');
      for (const c of plain) if (!chars.has(c) && c !== '\n') missing.add(c);
    }
    expect([...missing]).toEqual([]);
  });
});

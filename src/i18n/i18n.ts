/**
 * Kleines i18n-System. Alle sichtbaren Texte laufen über Schlüssel.
 * - Sprachdateien: verschachtelte JSON-Objekte (src/data/i18n/<locale>.json)
 * - Platzhalter: {name}
 * - Plural: Objekt mit Kategorien aus Intl.PluralRules ("one", "other", …) + Parameter `count`
 * - Fehlende Schlüssel fallen auf die Referenzsprache zurück, danach auf den Schlüssel selbst.
 */

export type Dict = { [key: string]: string | Dict };
export type Params = Record<string, string | number>;

export interface I18nOptions {
  locales: Record<string, Dict>;
  fallback: string;
  locale?: string;
  onMissing?: (key: string, locale: string) => void;
}

export class I18n {
  private readonly locales: Record<string, Dict>;
  private readonly fallback: string;
  private current: string;
  private readonly onMissing: ((key: string, locale: string) => void) | undefined;
  private readonly listeners = new Set<(locale: string) => void>();
  private plural: Intl.PluralRules;
  private numberFmt: Intl.NumberFormat;

  constructor(opts: I18nOptions) {
    if (!opts.locales[opts.fallback]) throw new Error(`Fallback-Sprache fehlt: ${opts.fallback}`);
    this.locales = opts.locales;
    this.fallback = opts.fallback;
    this.onMissing = opts.onMissing;
    this.current = opts.locale && opts.locales[opts.locale] ? opts.locale : opts.fallback;
    this.plural = new Intl.PluralRules(this.current);
    this.numberFmt = new Intl.NumberFormat(this.current);
  }

  get locale(): string {
    return this.current;
  }

  get available(): string[] {
    return Object.keys(this.locales);
  }

  setLocale(locale: string): void {
    if (!this.locales[locale] || locale === this.current) return;
    this.current = locale;
    this.plural = new Intl.PluralRules(locale);
    this.numberFmt = new Intl.NumberFormat(locale);
    for (const fn of this.listeners) fn(locale);
  }

  onChange(fn: (locale: string) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  has(key: string): boolean {
    return lookup(this.locales[this.current], key) !== undefined || lookup(this.locales[this.fallback], key) !== undefined;
  }

  t(key: string, params?: Params): string {
    let entry = lookup(this.locales[this.current], key);
    if (entry === undefined) {
      entry = lookup(this.locales[this.fallback], key);
      if (entry === undefined || this.current !== this.fallback) this.onMissing?.(key, this.current);
    }
    if (entry === undefined) return key;
    let text: string;
    if (typeof entry === 'string') {
      text = entry;
    } else {
      const count = Number(params?.['count'] ?? 0);
      const cat = this.plural.select(count);
      const form = entry[cat] ?? entry['other'];
      if (typeof form !== 'string') return key;
      text = form;
    }
    return params ? interpolate(text, params, this.numberFmt) : text;
  }

  /**
   * Varianten unter einem Schlüssel (Objekt mit "0", "1", …) als Liste, ohne Platzhalter zu ersetzen.
   * Ein einzelner Text ergibt eine Liste mit einem Eintrag, ein fehlender Schlüssel eine leere Liste.
   * Fällt nicht auf die Standardsprache zurück, wenn die aktuelle Sprache Varianten hat.
   */
  list(key: string): string[] {
    const fromDict = (d: Dict | undefined): string[] => {
      const node = lookup(d, key);
      if (node === undefined) return [];
      if (typeof node === 'string') return [node];
      return Object.keys(node)
        .filter((k) => /^\d+$/.test(k))
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => node[k])
        .filter((v): v is string => typeof v === 'string');
    };
    const own = fromDict(this.locales[this.current]);
    return own.length > 0 ? own : fromDict(this.locales[this.fallback]);
  }

  /** Platzhalter in einem bereits geladenen Text ersetzen. */
  format(text: string, params: Params): string {
    return interpolate(text, params, this.numberFmt);
  }

  /** Zahl im Format der aktuellen Sprache, z. B. 1.250 */
  formatNumber(n: number): string {
    return this.numberFmt.format(Math.round(n));
  }

  /** Spielwährung Taler, z. B. „1.250 ₮“ */
  formatMoney(n: number): string {
    return this.t('format.money', { amount: this.formatNumber(n) });
  }
}

function lookup(dict: Dict | undefined, key: string): string | Dict | undefined {
  if (!dict) return undefined;
  let node: string | Dict | undefined = dict;
  for (const part of key.split('.')) {
    if (node === undefined || typeof node === 'string') return undefined;
    node = node[part];
  }
  return node;
}

function interpolate(text: string, params: Params, fmt: Intl.NumberFormat): string {
  return text.replace(/\{(\w+)\}/g, (match, name: string) => {
    const v = params[name];
    if (v === undefined) return match;
    return typeof v === 'number' ? fmt.format(v) : v;
  });
}

/** Alle Blatt-Schlüssel eines Wörterbuchs (Plural-Objekte zählen als ein Schlüssel). */
export function collectKeys(dict: Dict, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(dict)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string' || isPluralNode(v)) keys.push(full);
    else keys.push(...collectKeys(v, full));
  }
  return keys;
}

const PLURAL_CATEGORIES = new Set(['zero', 'one', 'two', 'few', 'many', 'other']);

function isPluralNode(d: Dict): boolean {
  const ks = Object.keys(d);
  return ks.length > 0 && ks.includes('other') && ks.every((k) => PLURAL_CATEGORIES.has(k) && typeof d[k] === 'string');
}

/** Alle Texte eines Wörterbuchs (für Tests, z. B. Zeichenabdeckung der Pixel-Schrift). */
export function collectStrings(dict: Dict): string[] {
  const out: string[] = [];
  for (const v of Object.values(dict)) {
    if (typeof v === 'string') out.push(v);
    else out.push(...collectStrings(v));
  }
  return out;
}

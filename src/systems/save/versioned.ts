/**
 * Versionierte Spielstände: Jeder Save steckt in einem Umschlag mit Format-Kennung und Versionsnummer.
 * Beim Laden werden ältere Versionen Schritt für Schritt migriert (`migrations[n]` hebt Version n auf
 * n + 1) und das Ergebnis gegen das aktuelle Schema geprüft. Beschädigte oder zu neue Saves ergeben
 * ein klares Ergebnis statt einer Ausnahme – das Spiel entscheidet dann, was es dem Spieler sagt.
 */

export interface Envelope {
  format: string;
  version: number;
  savedAt: number;
  data: unknown;
}

/** Hebt die Daten von Version n auf n + 1 (darf werfen, das gilt dann als beschädigt). */
export type Migration = (data: unknown) => unknown;

export interface SaveSchema<T> {
  /** Kennung, damit ein falscher Schlüssel nicht als Spielstand gelesen wird. */
  format: string;
  /** Aktuelle Version. */
  version: number;
  migrations: Readonly<Record<number, Migration>>;
  /** Liefert die bereinigten Daten oder null, wenn sie nicht zum Schema passen. */
  validate(data: unknown): T | null;
}

export type LoadResult<T> =
  | { status: 'ok'; value: T; migratedFrom?: number }
  | { status: 'empty' }
  | { status: 'corrupt'; reason: string }
  | { status: 'incompatible'; version: number };

export function encode<T>(schema: SaveSchema<T>, value: T, now: number): string {
  const env: Envelope = { format: schema.format, version: schema.version, savedAt: now, data: value };
  return JSON.stringify(env);
}

export function decode<T>(schema: SaveSchema<T>, raw: string | null): LoadResult<T> {
  if (raw === null || raw === '') return { status: 'empty' };
  let env: unknown;
  try {
    env = JSON.parse(raw);
  } catch {
    return { status: 'corrupt', reason: 'json' };
  }
  if (!isRecord(env) || env['format'] !== schema.format) return { status: 'corrupt', reason: 'format' };
  const version = env['version'];
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 0) return { status: 'corrupt', reason: 'version' };
  // Ein Save aus einer neueren Spielversion: nicht anfassen, nicht überschreiben ohne Rückfrage.
  if (version > schema.version) return { status: 'incompatible', version };
  let data = env['data'];
  try {
    for (let v = version; v < schema.version; v++) {
      const step = schema.migrations[v];
      if (!step) return { status: 'incompatible', version };
      data = step(data);
    }
  } catch {
    return { status: 'corrupt', reason: 'migration' };
  }
  const value = schema.validate(data);
  if (value === null) return { status: 'corrupt', reason: 'schema' };
  return version < schema.version ? { status: 'ok', value, migratedFrom: version } : { status: 'ok', value };
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Ganze, endliche Zahl in [min, max], sonst null. */
export function int(v: unknown, min: number, max: number): number | null {
  return typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v) && v >= min && v <= max ? v : null;
}

/** Endliche Zahl in [min, max], sonst null. */
export function num(v: unknown, min: number, max: number): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null;
}

export function str(v: unknown, maxLen: number): string | null {
  return typeof v === 'string' && v.length <= maxLen ? v : null;
}

/** Liste von Strings (ungültige Einträge fallen weg). */
export function strList(v: unknown, maxLen: number, maxItems: number): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string' && x.length <= maxLen).slice(0, maxItems);
}

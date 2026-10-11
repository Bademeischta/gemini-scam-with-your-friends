/**
 * Sicherer Zugriff auf localStorage. Privatmodus, gesperrte Speicher oder volle Kontingente
 * dürfen das Spiel nie abstürzen lassen – dann wird nur im Speicher gehalten.
 */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const PREFIX = 'masche.';

export class SafeStorage {
  private readonly memory = new Map<string, string>();

  constructor(private readonly backend: KeyValueStore | null) {}

  static fromWindow(win: Window | undefined): SafeStorage {
    try {
      return new SafeStorage(win?.localStorage ?? null);
    } catch {
      return new SafeStorage(null);
    }
  }

  read<T>(key: string, fallback: T): T {
    const raw = this.readRaw(key);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  write(key: string, value: unknown): void {
    let raw: string;
    try {
      raw = JSON.stringify(value);
    } catch {
      return;
    }
    this.writeRaw(key, raw);
  }

  /** Text unverändert speichern (Spielstände bringen ihr eigenes Format mit). */
  writeRaw(key: string, raw: string): void {
    this.memory.set(key, raw);
    try {
      this.backend?.setItem(PREFIX + key, raw);
    } catch {
      /* Speicher voll oder gesperrt: Wert bleibt im Speicher erhalten. */
    }
  }

  remove(key: string): void {
    this.memory.delete(key);
    try {
      this.backend?.removeItem(PREFIX + key);
    } catch {
      /* ignorieren */
    }
  }

  readRaw(key: string): string | null {
    try {
      const v = this.backend?.getItem(PREFIX + key);
      if (v !== null && v !== undefined) return v;
    } catch {
      /* Fallback auf Speicher */
    }
    return this.memory.get(key) ?? null;
  }
}

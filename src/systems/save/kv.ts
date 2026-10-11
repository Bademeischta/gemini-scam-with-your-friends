import type { SafeStorage } from './storage';

/** Asynchroner Schlüssel-Wert-Speicher für Spielstände (IndexedDB, localStorage oder Speicher). */
export interface AsyncKv {
  readonly kind: 'indexeddb' | 'localstorage' | 'memory';
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export class MemoryKv implements AsyncKv {
  readonly kind = 'memory' as const;
  readonly map = new Map<string, string>();

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.map.get(key) ?? null);
  }

  set(key: string, value: string): Promise<void> {
    this.map.set(key, value);
    return Promise.resolve();
  }

  remove(key: string): Promise<void> {
    this.map.delete(key);
    return Promise.resolve();
  }
}

/** localStorage über SafeStorage (fängt Privatmodus und volle Kontingente ab). */
export class StorageKv implements AsyncKv {
  readonly kind = 'localstorage' as const;

  constructor(private readonly storage: SafeStorage) {}

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.storage.readRaw(`save.${key}`));
  }

  set(key: string, value: string): Promise<void> {
    this.storage.writeRaw(`save.${key}`, value);
    return Promise.resolve();
  }

  remove(key: string): Promise<void> {
    this.storage.remove(`save.${key}`);
    return Promise.resolve();
  }
}

const DB_NAME = 'masche';
const STORE = 'saves';

/** IndexedDB (TEC-12): ein Objektspeicher mit Text-Werten. */
export class IdbKv implements AsyncKv {
  readonly kind = 'indexeddb' as const;

  private constructor(private readonly db: IDBDatabase) {}

  static open(factory: IDBFactory, timeoutMs = 2000): Promise<IdbKv> {
    return new Promise((resolve, reject) => {
      let done = false;
      const timer = setTimeout(() => {
        done = true;
        reject(new Error('IndexedDB antwortet nicht'));
      }, timeoutMs);
      let req: IDBOpenDBRequest;
      try {
        req = factory.open(DB_NAME, 1);
      } catch (e) {
        clearTimeout(timer);
        reject(e instanceof Error ? e : new Error(String(e)));
        return;
      }
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => {
        clearTimeout(timer);
        if (done) req.result.close();
        else resolve(new IdbKv(req.result));
      };
      req.onerror = () => {
        clearTimeout(timer);
        if (!done) reject(req.error ?? new Error('IndexedDB-Fehler'));
      };
      req.onblocked = () => {
        clearTimeout(timer);
        if (!done) reject(new Error('IndexedDB blockiert'));
      };
    });
  }

  get(key: string): Promise<string | null> {
    return this.run('readonly', (s) => s.get(key)).then((v) => (typeof v === 'string' ? v : null));
  }

  set(key: string, value: string): Promise<void> {
    return this.run('readwrite', (s) => s.put(value, key)).then(() => undefined);
  }

  remove(key: string): Promise<void> {
    return this.run('readwrite', (s) => s.delete(key)).then(() => undefined);
  }

  private run(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<unknown> {
    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('IndexedDB-Fehler'));
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  }
}

/**
 * Bester verfügbarer Speicher: IndexedDB, sonst localStorage (Privatmodus, alte Browser),
 * notfalls nur im Speicher. Scheitert nie.
 */
export async function openBestKv(win: Window | undefined, fallback: SafeStorage): Promise<AsyncKv> {
  try {
    const factory = win?.indexedDB;
    if (factory) return await IdbKv.open(factory);
  } catch {
    /* weiter mit localStorage */
  }
  return new StorageKv(fallback);
}

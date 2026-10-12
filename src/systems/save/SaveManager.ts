import { TUNING } from '../../config/tuning';
import type { AsyncKv } from './kv';
import { EMPTY_STATS, LEADERBOARD_SCHEMA, RUN_SCHEMA, STATS_SCHEMA, type LeaderEntry, type LifetimeStats, type RunSave } from './schemas';
import { decode, encode, type LoadResult, type SaveSchema } from './versioned';

const KEYS = { run: 'run', stats: 'stats', leaderboard: 'leaderboard' } as const;

/** Was dem Spieler beim Start gesagt werden muss (Save beschädigt bzw. aus einer neueren Version). */
export type SaveNotice = 'corrupt' | 'incompatible';

/**
 * Spielstände: laufender Run, Lebenszeit-Statistik und Bestenliste. Wird beim Start einmal geladen
 * (`init`) und danach synchron gelesen; Schreiben läuft im Hintergrund. Ein beschädigter oder nicht
 * lesbarer Save bringt das Spiel nie zum Absturz: Er wird unter `<key>.broken` gesichert, der Slot
 * geleert und ein Hinweis für den Titelbildschirm hinterlegt.
 */
export class SaveManager {
  private runSave: RunSave | null = null;
  private statsValue: LifetimeStats = { ...EMPTY_STATS, schemeWins: {} };
  private board: LeaderEntry[] = [];
  private pendingNotice: SaveNotice | null = null;
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly kv: AsyncKv,
    private readonly now: () => number = () => Date.now(),
  ) {}

  get backend(): AsyncKv['kind'] {
    return this.kv.kind;
  }

  async init(): Promise<void> {
    const run = await this.load(KEYS.run, RUN_SCHEMA);
    if (run.status === 'ok') this.runSave = run.value;
    const stats = await this.load(KEYS.stats, STATS_SCHEMA);
    if (stats.status === 'ok') this.statsValue = stats.value;
    const board = await this.load(KEYS.leaderboard, LEADERBOARD_SCHEMA);
    if (board.status === 'ok') this.board = board.value.entries;
  }

  // ------------------------------------------------------------------ Run

  get run(): RunSave | null {
    return this.runSave;
  }

  saveRun(save: RunSave): void {
    this.runSave = save;
    this.write(KEYS.run, encode(RUN_SCHEMA, save, this.now()));
  }

  clearRun(): void {
    this.runSave = null;
    this.enqueue(() => this.kv.remove(KEYS.run));
  }

  /** Hinweis für den Spieler (einmalig abholen). */
  takeNotice(): SaveNotice | null {
    const n = this.pendingNotice;
    this.pendingNotice = null;
    return n;
  }

  // ------------------------------------------------------------------ Statistik & Bestenliste

  get stats(): Readonly<LifetimeStats> {
    return this.statsValue;
  }

  updateStats(fn: (s: LifetimeStats) => void): void {
    const next: LifetimeStats = { ...this.statsValue, schemeWins: { ...this.statsValue.schemeWins } };
    fn(next);
    this.statsValue = next;
    this.write(KEYS.stats, encode(STATS_SCHEMA, next, this.now()));
  }

  get leaderboard(): readonly LeaderEntry[] {
    return this.board;
  }

  /** Run eintragen; liefert den Platz (1-basiert) oder null, wenn er es nicht in die Liste schafft. */
  addToLeaderboard(entry: LeaderEntry): number | null {
    const list = [...this.board, entry].sort((a, b) => b.days - a.days || b.loot - a.loot || a.date - b.date).slice(0, TUNING.save.leaderboardSize);
    this.board = list;
    this.write(KEYS.leaderboard, encode(LEADERBOARD_SCHEMA, { entries: list }, this.now()));
    const rank = list.indexOf(entry);
    return rank >= 0 ? rank + 1 : null;
  }

  /** Wartet, bis alle Schreibvorgänge durch sind (Tests, Seitenwechsel). */
  flush(): Promise<void> {
    return this.queue;
  }

  // ------------------------------------------------------------------ intern

  private async load<T>(key: string, schema: SaveSchema<T>): Promise<LoadResult<T>> {
    let raw: string | null = null;
    try {
      raw = await this.kv.get(key);
    } catch {
      return { status: 'empty' };
    }
    const result = decode(schema, raw);
    if (result.status === 'corrupt' || result.status === 'incompatible') {
      // Nichts wegwerfen: Den Rohzustand sichern (Support, späterer Import), Slot leeren.
      if (key === KEYS.run) this.pendingNotice = result.status;
      if (raw !== null) this.write(`${key}.broken`, raw);
      if (result.status === 'corrupt') this.enqueue(() => this.kv.remove(key));
    }
    if (result.status === 'ok' && result.migratedFrom !== undefined) this.write(key, encode(schema, result.value, this.now()));
    return result;
  }

  private write(key: string, raw: string): void {
    this.enqueue(() => this.kv.set(key, raw));
  }

  private enqueue(job: () => Promise<void>): void {
    this.queue = this.queue.then(job).catch(() => undefined);
  }
}

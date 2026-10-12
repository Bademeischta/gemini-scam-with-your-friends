import { int, isRecord, num, str, strList, type SaveSchema } from './versioned';

// ------------------------------------------------------------------ Run (zwischen den Tagen, MOD-07)

/** Ergebnis eines Arbeitstags. */
export interface DayRecord {
  day: number;
  quota: number;
  /** Team-Summe am Tagesende. */
  team: number;
  passed: boolean;
  calls: number;
  successes: number;
  /** Größter Einzel-Abschluss (₮). */
  bestLoot: number;
  /** Gespielte Sekunden an diesem Tag. */
  seconds: number;
}

/** Zähler über den ganzen Run (Kündigungsbericht, Statistik). */
export interface RunTotals {
  calls: number;
  successes: number;
  loot: number;
  staplersHit: number;
  bossCatches: number;
  bossYells: number;
  baitsCaught: number;
  schemeWins: Record<string, number>;
}

export interface DossierSnap {
  calls: number;
  likes: string[];
  dislikes: string[];
  fans: string[];
  skeptics: string[];
  best: number;
  wins: number;
}

export interface RunSave {
  seed: number;
  /** Tag, der als Nächstes gespielt wird. */
  day: number;
  /** Persönliches Guthaben (PRG-01). */
  personal: number;
  /** Beginn des Runs (Unix-ms). */
  startedAt: number;
  playSeconds: number;
  days: DayRecord[];
  totals: RunTotals;
  /** Zusätzlich freigeschaltete Apps/Maschen (Ramschazon, Debug). */
  unlocks: string[];
  notes: { text: string; from: string | null }[];
  dossier: Record<string, DossierSnap>;
}

export const EMPTY_TOTALS: RunTotals = { calls: 0, successes: 0, loot: 0, staplersHit: 0, bossCatches: 0, bossYells: 0, baitsCaught: 0, schemeWins: {} };

const BIG = 1e12;

function counts(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isRecord(v)) return out;
  for (const [k, n] of Object.entries(v)) {
    const c = int(n, 0, BIG);
    if (k.length <= 40 && c !== null) out[k] = c;
  }
  return out;
}

function totals(v: unknown): RunTotals | null {
  if (!isRecord(v)) return null;
  const t: RunTotals = { ...EMPTY_TOTALS, schemeWins: counts(v['schemeWins']) };
  for (const k of ['calls', 'successes', 'loot', 'staplersHit', 'bossCatches', 'bossYells', 'baitsCaught'] as const) {
    const n = int(v[k], 0, BIG);
    if (n === null) return null;
    t[k] = n;
  }
  return t;
}

function dayRecord(v: unknown): DayRecord | null {
  if (!isRecord(v)) return null;
  const day = int(v['day'], 1, 10_000);
  const quota = int(v['quota'], 0, BIG);
  const team = int(v['team'], 0, BIG);
  const calls = int(v['calls'], 0, BIG);
  const successes = int(v['successes'], 0, BIG);
  const bestLoot = int(v['bestLoot'], 0, BIG);
  const seconds = num(v['seconds'], 0, BIG);
  if (day === null || quota === null || team === null || calls === null || successes === null || bestLoot === null || seconds === null || typeof v['passed'] !== 'boolean') return null;
  return { day, quota, team, passed: v['passed'], calls, successes, bestLoot, seconds };
}

function dossier(v: unknown): Record<string, DossierSnap> {
  const out: Record<string, DossierSnap> = {};
  if (!isRecord(v)) return out;
  for (const [id, e] of Object.entries(v)) {
    if (!isRecord(e) || id.length > 40) continue;
    out[id] = {
      calls: int(e['calls'], 0, BIG) ?? 0,
      likes: strList(e['likes'], 40, 40),
      dislikes: strList(e['dislikes'], 40, 40),
      fans: strList(e['fans'], 40, 40),
      skeptics: strList(e['skeptics'], 40, 40),
      best: int(e['best'], 0, 100) ?? 0,
      wins: int(e['wins'], 0, BIG) ?? 0,
    };
  }
  return out;
}

export function validateRun(v: unknown): RunSave | null {
  if (!isRecord(v)) return null;
  const seed = int(v['seed'], 0, 2 ** 32);
  const day = int(v['day'], 1, 10_000);
  const personal = int(v['personal'], 0, BIG);
  const startedAt = num(v['startedAt'], 0, BIG * 10);
  const playSeconds = num(v['playSeconds'], 0, BIG);
  const t = totals(v['totals']);
  if (seed === null || day === null || personal === null || startedAt === null || playSeconds === null || t === null || !Array.isArray(v['days'])) return null;
  const days: DayRecord[] = [];
  for (const d of v['days']) {
    const r = dayRecord(d);
    if (!r) return null;
    days.push(r);
  }
  const notes = Array.isArray(v['notes'])
    ? v['notes']
        .filter(isRecord)
        .map((n) => ({ text: str(n['text'], 300), from: n['from'] === null ? null : str(n['from'], 40) }))
        .filter((n): n is { text: string; from: string | null } => n.text !== null && (n.from === null || typeof n.from === 'string'))
        .slice(0, 60)
    : [];
  return { seed, day, personal, startedAt, playSeconds, days, totals: t, unlocks: strList(v['unlocks'], 40, 200), notes, dossier: dossier(v['dossier']) };
}

export const RUN_SCHEMA: SaveSchema<RunSave> = {
  format: 'masche-run',
  version: 1,
  // Version n → n + 1. Neue Felder bekommen hier ihre Standardwerte, damit alte Saves weiterlaufen.
  migrations: {},
  validate: validateRun,
};

// ------------------------------------------------------------------ Lebenszeit-Statistik (PRG-06)

export interface LifetimeStats {
  runs: number;
  firings: number;
  daysWorked: number;
  calls: number;
  successes: number;
  loot: number;
  staplersHit: number;
  bossCatches: number;
  bossYells: number;
  baitsCaught: number;
  bestDayLoot: number;
  longestRun: number;
  playSeconds: number;
  /** Folgen später (M7), stehen aber schon in der Statistik. */
  monitorsBurned: number;
  raids: number;
  schemeWins: Record<string, number>;
}

export const EMPTY_STATS: LifetimeStats = {
  runs: 0,
  firings: 0,
  daysWorked: 0,
  calls: 0,
  successes: 0,
  loot: 0,
  staplersHit: 0,
  bossCatches: 0,
  bossYells: 0,
  baitsCaught: 0,
  bestDayLoot: 0,
  longestRun: 0,
  playSeconds: 0,
  monitorsBurned: 0,
  raids: 0,
  schemeWins: {},
};

const STAT_KEYS = Object.keys(EMPTY_STATS).filter((k) => k !== 'schemeWins') as Exclude<keyof LifetimeStats, 'schemeWins'>[];

export function validateStats(v: unknown): LifetimeStats | null {
  if (!isRecord(v)) return null;
  const out: LifetimeStats = { ...EMPTY_STATS, schemeWins: counts(v['schemeWins']) };
  for (const k of STAT_KEYS) {
    // Fehlende Zähler (aus älteren Versionen) starten bei 0, kaputte machen den Save ungültig.
    if (v[k] === undefined) continue;
    const n = num(v[k], 0, BIG);
    if (n === null) return null;
    out[k] = n;
  }
  return out;
}

export const STATS_SCHEMA: SaveSchema<LifetimeStats> = { format: 'masche-stats', version: 1, migrations: {}, validate: validateStats };

// ------------------------------------------------------------------ Bestenliste (PRG-05)

export interface LeaderEntry {
  days: number;
  loot: number;
  /** Schicht-Code des Runs zum Weitergeben. */
  code: string;
  /** Ende des Runs (Unix-ms). */
  date: number;
  seconds: number;
}

export interface Leaderboard {
  entries: LeaderEntry[];
}

export function validateLeaderboard(v: unknown): Leaderboard | null {
  if (!isRecord(v) || !Array.isArray(v['entries'])) return null;
  const entries: LeaderEntry[] = [];
  for (const e of v['entries']) {
    if (!isRecord(e)) return null;
    const days = int(e['days'], 0, 10_000);
    const loot = int(e['loot'], 0, BIG);
    const code = str(e['code'], 20);
    const date = num(e['date'], 0, BIG * 10);
    const seconds = num(e['seconds'], 0, BIG);
    if (days === null || loot === null || code === null || date === null || seconds === null) return null;
    entries.push({ days, loot, code, date, seconds });
  }
  return { entries };
}

export const LEADERBOARD_SCHEMA: SaveSchema<Leaderboard> = { format: 'masche-leaderboard', version: 1, migrations: {}, validate: validateLeaderboard };

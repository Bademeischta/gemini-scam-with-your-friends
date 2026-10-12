import { describe, expect, it } from 'vitest';
import { MemoryKv, StorageKv } from '../../src/systems/save/kv';
import { SaveManager } from '../../src/systems/save/SaveManager';
import { EMPTY_TOTALS, RUN_SCHEMA, type RunSave } from '../../src/systems/save/schemas';
import { SafeStorage } from '../../src/systems/save/storage';
import { decode, encode, type SaveSchema } from '../../src/systems/save/versioned';

function sampleRun(): RunSave {
  return {
    seed: 42,
    day: 3,
    personal: 780,
    startedAt: 1_700_000_000_000,
    playSeconds: 1234.5,
    days: [
      { day: 1, quota: 600, team: 720, passed: true, calls: 6, successes: 3, bestLoot: 310, seconds: 600 },
      { day: 2, quota: 950, team: 1000, passed: true, calls: 8, successes: 4, bestLoot: 420, seconds: 600 },
    ],
    totals: { ...EMPTY_TOTALS, calls: 14, successes: 7, loot: 1720, schemeWins: { rentennummer: 5 } },
    unlocks: [],
    notes: [{ text: 'Bürgernummer: SV 49 18 45', from: 'hildegard' }],
    dossier: { hildegard: { calls: 2, likes: ['katzen'], dislikes: [], fans: ['rentennummer'], skeptics: [], best: 80, wins: 1 } },
  };
}

/** Zwei Versionen eines erfundenen Formats, um die Migrationskette zu prüfen. */
interface V2 {
  name: string;
  coins: number;
  hats: string[];
}
const V2_SCHEMA: SaveSchema<V2> = {
  format: 'test',
  version: 2,
  migrations: {
    // v0: { n } → v1: { name, coins }
    0: (d) => ({ name: (d as { n: string }).n, coins: 0 }),
    // v1 → v2: Hüte kamen dazu.
    1: (d) => ({ ...(d as object), hats: [] }),
  },
  validate: (d) => {
    const v = d as Partial<V2>;
    return typeof v.name === 'string' && typeof v.coins === 'number' && Array.isArray(v.hats) ? (v as V2) : null;
  },
};

describe('Versionierte Spielstände', () => {
  it('schreibt und liest einen Run verlustfrei', () => {
    const raw = encode(RUN_SCHEMA, sampleRun(), 5);
    const r = decode(RUN_SCHEMA, raw);
    expect(r).toEqual({ status: 'ok', value: sampleRun() });
    expect(JSON.parse(raw)).toMatchObject({ format: 'masche-run', version: RUN_SCHEMA.version, savedAt: 5 });
  });

  it('migriert alte Versionen Schritt für Schritt', () => {
    const v0 = JSON.stringify({ format: 'test', version: 0, savedAt: 1, data: { n: 'Gerd' } });
    expect(decode(V2_SCHEMA, v0)).toEqual({ status: 'ok', value: { name: 'Gerd', coins: 0, hats: [] }, migratedFrom: 0 });
    const v1 = JSON.stringify({ format: 'test', version: 1, savedAt: 1, data: { name: 'Rosi', coins: 7 } });
    expect(decode(V2_SCHEMA, v1)).toMatchObject({ status: 'ok', value: { coins: 7, hats: [] } });
  });

  it('erkennt beschädigte, fremde und zu neue Saves ohne Ausnahme', () => {
    expect(decode(RUN_SCHEMA, null)).toEqual({ status: 'empty' });
    expect(decode(RUN_SCHEMA, '{kaputt')).toEqual({ status: 'corrupt', reason: 'json' });
    expect(decode(RUN_SCHEMA, JSON.stringify({ format: 'anders', version: 1, data: {} }))).toMatchObject({ status: 'corrupt', reason: 'format' });
    expect(decode(RUN_SCHEMA, JSON.stringify({ format: 'masche-run', version: 99, data: {} }))).toEqual({ status: 'incompatible', version: 99 });
    const bad = { ...sampleRun(), personal: -5 };
    expect(decode(RUN_SCHEMA, JSON.stringify({ format: 'masche-run', version: 1, data: bad }))).toMatchObject({ status: 'corrupt', reason: 'schema' });
    const broken = { format: 'test', version: 0, savedAt: 1, data: null };
    expect(decode(V2_SCHEMA, JSON.stringify(broken))).toMatchObject({ status: 'corrupt', reason: 'migration' });
  });
});

describe('SaveManager', () => {
  it('speichert, lädt und löscht den Run', async () => {
    const kv = new MemoryKv();
    const a = new SaveManager(kv);
    await a.init();
    expect(a.run).toBeNull();
    a.saveRun(sampleRun());
    await a.flush();
    const b = new SaveManager(kv);
    await b.init();
    expect(b.run).toEqual(sampleRun());
    expect(b.takeNotice()).toBeNull();
    b.clearRun();
    await b.flush();
    expect(kv.map.has('run')).toBe(false);
  });

  it('beschädigter Save: Hinweis, Sicherungskopie, sauberer Neustart', async () => {
    const kv = new MemoryKv();
    kv.map.set('run', '{"format":"masche-run","version":1,"data":{"day":"drei"}}');
    const m = new SaveManager(kv);
    await m.init();
    expect(m.run).toBeNull();
    expect(m.takeNotice()).toBe('corrupt');
    expect(m.takeNotice()).toBeNull();
    await m.flush();
    expect(kv.map.has('run')).toBe(false);
    expect(kv.map.get('run.broken')).toContain('drei');
  });

  it('Save aus einer neueren Version bleibt unangetastet', async () => {
    const kv = new MemoryKv();
    const newer = JSON.stringify({ format: 'masche-run', version: 99, savedAt: 1, data: {} });
    kv.map.set('run', newer);
    const m = new SaveManager(kv);
    await m.init();
    expect(m.run).toBeNull();
    expect(m.takeNotice()).toBe('incompatible');
    await m.flush();
    expect(kv.map.get('run')).toBe(newer);
  });

  it('Statistik und Bestenliste (Top 10, nach Tagen, dann Beute)', async () => {
    const kv = new MemoryKv();
    const m = new SaveManager(kv, () => 1000);
    await m.init();
    m.updateStats((s) => {
      s.runs++;
      s.calls += 5;
      s.schemeWins['mond'] = 2;
    });
    expect(m.addToLeaderboard({ days: 2, loot: 900, code: 'A', date: 1, seconds: 10 })).toBe(1);
    expect(m.addToLeaderboard({ days: 4, loot: 100, code: 'B', date: 2, seconds: 10 })).toBe(1);
    expect(m.addToLeaderboard({ days: 2, loot: 1500, code: 'C', date: 3, seconds: 10 })).toBe(2);
    for (let i = 0; i < 10; i++) m.addToLeaderboard({ days: 5, loot: i, code: `X${i}`, date: 10 + i, seconds: 1 });
    expect(m.leaderboard).toHaveLength(10);
    expect(m.addToLeaderboard({ days: 1, loot: 1, code: 'Z', date: 99, seconds: 1 })).toBeNull();
    await m.flush();
    const n = new SaveManager(kv);
    await n.init();
    expect(n.stats).toMatchObject({ runs: 1, calls: 5, schemeWins: { mond: 2 } });
    expect(n.leaderboard[0]).toMatchObject({ days: 5, loot: 9 });
  });

  it('funktioniert auch über localStorage und ohne Speicher (Privatmodus)', async () => {
    const store = new Map<string, string>();
    const ls = new SafeStorage({ getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v), removeItem: (k) => void store.delete(k) });
    const m = new SaveManager(new StorageKv(ls));
    await m.init();
    m.saveRun(sampleRun());
    await m.flush();
    expect([...store.keys()].some((k) => k.endsWith('save.run'))).toBe(true);
    const throwing = new SafeStorage({
      getItem: () => {
        throw new Error('gesperrt');
      },
      setItem: () => {
        throw new Error('voll');
      },
      removeItem: () => undefined,
    });
    const p = new SaveManager(new StorageKv(throwing));
    await p.init();
    p.saveRun(sampleRun());
    await p.flush();
    expect(p.run?.day).toBe(3);
  });
});

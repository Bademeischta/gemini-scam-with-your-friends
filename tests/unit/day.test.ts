import { afterEach, describe, expect, it } from 'vitest';
import { TUNING } from '../../src/config/tuning';
import { clockIn, clockOut, dayOver, finishDay, nextDay, recordStaplers, resumeRun, setRunPersistence, shiftCode, snapshot, startNewRun, tickBoss, type RunPersistence } from '../../src/core/run';
import { BOSS_ROUTE, BOSS_SEAT } from '../../src/data/office';
import { SCHEMES } from '../../src/data/schemes';
import { i18n } from '../../src/i18n';
import { BossBrain } from '../../src/systems/day/boss';
import { MomentLog } from '../../src/systems/day/moments';
import { quotaFor } from '../../src/systems/day/quota';
import { StaplerGame, STAGE } from '../../src/systems/day/staplers';
import { LAST_UNLOCK_DAY, Unlocks, unlocksOn } from '../../src/systems/day/unlocks';
import { Rng } from '../../src/systems/rng/rng';
import { EMPTY_STATS, type LeaderEntry, type LifetimeStats, type RunSave } from '../../src/systems/save/schemas';

/** Persistenz-Attrappe, die mitschreibt, was gespeichert wurde. */
function fakePersistence(): RunPersistence & { saves: RunSave[]; cleared: number; stats: LifetimeStats; board: LeaderEntry[] } {
  const p = {
    saves: [] as RunSave[],
    cleared: 0,
    stats: { ...EMPTY_STATS, schemeWins: {} } as LifetimeStats,
    board: [] as LeaderEntry[],
    saveRun(s: RunSave) {
      p.saves.push(structuredClone(s));
    },
    clearRun() {
      p.cleared++;
    },
    updateStats(fn: (s: LifetimeStats) => void) {
      fn(p.stats);
    },
    addToLeaderboard(e: LeaderEntry) {
      p.board.push(e);
      return p.board.length;
    },
  };
  return p;
}

afterEach(() => setRunPersistence(null));

describe('Freischalt-Plan (DAY-10)', () => {
  it('Tag 1 Rentennummer, Tag 2 Plauderbude/Gutschein, Tag 3 FernGucker und Kundenkartei', () => {
    const d1 = new Unlocks(1);
    expect(d1.app('identomat')).toBe(true);
    expect(d1.scheme('rentennummer')).toBe(true);
    expect(d1.app('plauder')).toBe(false);
    expect(d1.app('ferngucker')).toBe(false);
    expect(d1.scheme('turbo')).toBe(false);
    expect(unlocksOn(2)).toEqual({ apps: ['plauder', 'voucher'], schemes: ['turbo', 'gutschein'] });
    expect(unlocksOn(3).apps).toEqual(['ferngucker', 'kartei']);
    expect(unlocksOn(3).schemes).toEqual(['ferngucker']);
    // Danach je Tag zwei Maschen, bis alle frei sind.
    for (let d = 4; d <= LAST_UNLOCK_DAY; d++) expect(unlocksOn(d).schemes).toHaveLength(2);
    const all = new Unlocks(LAST_UNLOCK_DAY);
    expect(SCHEMES.every((s) => all.scheme(s.id))).toBe(true);
    expect(new Unlocks(1, new Set(['app:ferngucker'])).app('ferngucker')).toBe(true);
    expect(new Unlocks(1, new Set(), true).scheme('dinner')).toBe(true);
  });
});

describe('Direktor Brülling (DAY-12/13)', () => {
  const idle = { seated: true, player: { x: 0, y: 0 }, progress: 1, elapsed: 0 };

  it('geht regelmäßig auf Kontrollgang und kehrt an den Platz zurück', () => {
    const b = new BossBrain(new Rng(1), 1, BOSS_ROUTE, BOSS_SEAT);
    const seen: string[] = [];
    for (let t = 0; t < 400 && !seen.includes('patrolEnd'); t += 0.1) seen.push(...b.tick(0.1, idle).map((e) => e.type));
    expect(seen).toContain('patrolStart');
    expect(seen).toContain('patrolEnd');
    expect(b.state).toBe('office');
    expect(b.pos).toEqual(BOSS_SEAT);
  });

  it('erwischt Faulenzer in der Nähe und verhängt Strafgeld', () => {
    const b = new BossBrain(new Rng(2), 3, BOSS_ROUTE, BOSS_SEAT);
    let caught = null as null | { type: string; fine?: number };
    for (let t = 0; t < 400 && !caught; t += 0.1) {
      // Der Spieler steht genau dort, wo der Chef gerade ist – und faulenzt.
      const ev = b.tick(0.1, { seated: false, player: { ...b.pos }, progress: 1, elapsed: 0 });
      caught = (ev.find((e) => e.type === 'catch') as { type: string; fine: number } | undefined) ?? null;
    }
    expect(caught).not.toBeNull();
    expect(caught!.fine).toBe(TUNING.boss.fineBase + TUNING.boss.finePerDay * 2);
  });

  it('wird wütend bei Fehlschlägen und Rückstand, brüllt und beruhigt sich durch Erfolge', () => {
    const b = new BossBrain(new Rng(3), 1, BOSS_ROUTE, BOSS_SEAT);
    for (let i = 0; i < 12; i++) b.onCallEnded(false);
    expect(b.angry).toBe(true);
    const ev = b.tick(0.1, idle);
    expect(ev.map((e) => e.type)).toContain('yell');
    expect(b.state).toBe('yell');
    const before = b.rage;
    b.onCallEnded(true);
    expect(b.rage).toBeLessThan(before);
    // Rückstand: Team weit hinter dem Zeitplan.
    const c = new BossBrain(new Rng(4), 1, BOSS_ROUTE, BOSS_SEAT);
    const r0 = c.rage;
    for (let t = 0; t < 10; t += 0.5) c.tick(0.5, { ...idle, progress: 0, elapsed: 0.8 });
    expect(c.rage).toBeGreaterThan(r0);
  });
});

describe('Tacker-Minispiel (DAY-11)', () => {
  it('stillstehen wird bestraft, ausweichen klappt', () => {
    const still = new StaplerGame(new Rng(5));
    for (let t = 0; t < TUNING.review.staplerSeconds + 3; t += 1 / 60) still.tick(1 / 60, 0);
    expect(still.hits).toBeGreaterThan(0);
    expect(still.done).toBe(true);
    // Hin und her laufen: deutlich weniger Treffer.
    const dodge = new StaplerGame(new Rng(5));
    let dir = 1;
    for (let t = 0; t < TUNING.review.staplerSeconds + 3; t += 1 / 60) {
      if (dodge.playerX > STAGE.w - 30) dir = -1;
      if (dodge.playerX < 30) dir = 1;
      dodge.tick(1 / 60, dir);
    }
    expect(dodge.hits).toBeLessThan(still.hits);
    const helmet = new StaplerGame(new Rng(5), true);
    for (let t = 0; t < TUNING.review.staplerSeconds + 3; t += 1 / 60) helmet.tick(1 / 60, 0);
    expect(helmet.hits).toBe(0);
  });
});

describe('Momente des Tages (DAY-08)', () => {
  it('drei beste, je Art höchstens einer, Lücken werden aufgefüllt', () => {
    const m = new MomentLog();
    m.add('record', 90, { amount: '900 ₮' });
    m.add('record', 80);
    m.add('quote', 60, { text: 'Huch!' });
    m.add('yell', 30);
    m.add('fast', 70);
    expect(m.top(3).map((x) => x.kind)).toEqual(['record', 'fast', 'quote']);
    expect(new MomentLog().top(3, ['Kaffee gekocht']).map((x) => x.kind)).toEqual(['idle']);
  });

  it('Texte für alle Momente, Chef-Sprüche (mindestens 30 Rauswurf-Sprüche, FUN-01)', () => {
    for (const k of ['record', 'quote', 'fast', 'hangup', 'bait', 'typo', 'yell', 'catch', 'idle']) expect(i18n.has(`review.moments.${k}`), k).toBe(true);
    expect(i18n.list('boss.fired').length).toBeGreaterThanOrEqual(30);
    expect(i18n.list('boss.passed').length).toBeGreaterThanOrEqual(10);
    expect(i18n.list('boss.yell').length).toBeGreaterThanOrEqual(8);
    expect(i18n.list('boss.catch').length).toBeGreaterThanOrEqual(6);
  });
});

describe('Run über mehrere Tage (MOD-04/05/07)', () => {
  it('Quota steigt, Geld bleibt, bestanden → nächster Tag wird gespeichert', () => {
    const p = fakePersistence();
    setRunPersistence(p);
    const r = startNewRun(1234);
    expect(p.stats.runs).toBe(1);
    expect(p.saves.at(-1)).toMatchObject({ seed: 1234, day: 1 });
    expect(clockIn(r)).toBe(true);
    expect(clockIn(r)).toBe(false);
    expect(r.mail.mails.some((m) => m.from === 'boss')).toBe(true);
    // Ausstempeln erst mit erreichter Quota.
    expect(clockOut(r)).toBe(false);
    r.shift.earn(700);
    expect(clockOut(r)).toBe(true);
    expect(dayOver(r)).toBe(true);
    const res = finishDay(r);
    expect(res).toMatchObject({ day: 1, passed: true, missing: 0, report: null });
    expect(res.moments).toHaveLength(3);
    expect(res.tomorrow.schemes).toEqual(['turbo', 'gutschein']);
    expect(finishDay(r)).toBe(res);
    expect(p.saves.at(-1)).toMatchObject({ day: 2, personal: 700 });
    expect(p.stats.daysWorked).toBe(1);
    const r2 = nextDay(r);
    expect(r2.shift.day).toBe(2);
    expect(r2.shift.personal).toBe(700);
    expect(r2.shift.quota).toBe(quotaFor(2, 1));
    expect(r2.unlocks.app('plauder')).toBe(true);
  });

  it('Quota verfehlt → gefeuert: Bericht, Bestenliste, Spielstand weg', () => {
    const p = fakePersistence();
    setRunPersistence(p);
    const r = startNewRun(99);
    r.shift.earn(200);
    r.shift.timeLeft = 0;
    expect(dayOver(r)).toBe(true);
    const res = finishDay(r);
    expect(res.passed).toBe(false);
    expect(res.missing).toBe(r.shift.quota - 200);
    expect(res.report).toMatchObject({ days: 1, totalLoot: 200, code: shiftCode(99), rank: 1 });
    expect(p.cleared).toBe(1);
    expect(p.stats.firings).toBe(1);
    recordStaplers(r, 2);
    expect(res.report!.staplers).toBe(2);
    expect(p.stats.staplersHit).toBe(2);
  });

  it('Fortsetzen: gespeicherter Tag beginnt mit Geld, Notizen und Kundenkartei', () => {
    setRunPersistence(fakePersistence());
    const r = startNewRun(7);
    r.shift.earn(650);
    r.notes.add('Rückruf Rosi', null);
    r.phone.dossier.met('rosi');
    r.clockedOut = true;
    finishDay(r);
    const save = snapshot(r);
    const back = resumeRun(save);
    expect(back.shift.day).toBe(2);
    expect(back.shift.personal).toBe(650);
    expect(back.notes.notes.map((n) => n.text)).toContain('Rückruf Rosi');
    expect(back.phone.dossier.get('rosi')?.calls).toBe(1);
  });

  it('Chef-Strafgeld geht vom eigenen Guthaben', () => {
    setRunPersistence(fakePersistence());
    const r = startNewRun(5, 2);
    r.shift.personal = 30;
    let fined = false;
    for (let t = 0; t < 400 && !fined; t += 0.1) {
      fined = tickBoss(r, 0.1, { seated: false, player: { ...r.boss.pos } }).some((e) => e.type === 'catch');
    }
    expect(fined).toBe(true);
    expect(r.shift.personal).toBe(0);
    expect(r.core.totals.bossCatches).toBe(1);
  });
});

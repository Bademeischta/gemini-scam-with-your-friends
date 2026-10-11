import { CALLERS } from '../data/callers';
import { BOSS_ROUTE, BOSS_SEAT, DESKS } from '../data/office';
import { START_FILES, START_TRASH } from '../data/os/files';
import { PLAUDER_FRIENDS } from '../data/os/plauder';
import { DEFAULT_SCHEME_FOR, schemeById } from '../data/schemes';
import { TEST_PARAMS } from '../debug/testParams';
import { i18n, t } from '../i18n';
import { CallManager } from '../systems/calls/CallManager';
import { LootLedger } from '../systems/calls/ledger';
import { payoutFor } from '../systems/calls/payout';
import { PhoneHub, type Capture } from '../systems/calls/PhoneHub';
import { BossBrain, type BossEvent, type BossInput } from '../systems/day/boss';
import { MomentLog, type Moment } from '../systems/day/moments';
import { ShiftState } from '../systems/day/ShiftState';
import { Unlocks, unlocksOn } from '../systems/day/unlocks';
import { Mailbox } from '../systems/os/mailbox';
import { Notebook } from '../systems/os/notebook';
import { Plauder } from '../systems/os/plauder';
import { VirtualFs } from '../systems/os/vfs';
import { weatherOn } from '../systems/os/weather';
import { Rng } from '../systems/rng/rng';
import { EMPTY_TOTALS, type DayRecord, type LeaderEntry, type LifetimeStats, type RunSave } from '../systems/save/schemas';

/** Zähler des laufenden Tages. */
export interface DayStats {
  calls: number;
  successes: number;
  bestLoot: number;
  /** Erfolge je Masche (Lieblingsmasche in der Statistik). */
  schemeWins: Record<string, number>;
}

/**
 * Der laufende Run (MOD-04): eine Folge von Arbeitstagen bis zum Rauswurf. `core` ist der Teil, der
 * zwischen den Tagen gespeichert wird (MOD-07); alles andere gilt nur für den aktuellen Tag.
 */
export interface Run {
  core: RunSave;
  seed: number;
  shift: ShiftState;
  unlocks: Unlocks;
  vfs: VirtualFs;
  /** Eingehende Anrufe aller Plätze. */
  calls: CallManager;
  /** Telefon-Sitzungen (Untertitel, Karten) über den Anrufen. */
  phone: PhoneHub;
  /** Notizblock: eigene Notizen und automatisch erfasste Beute (APP-08). */
  notes: Notebook;
  /** Beute, die auf Eingabe in die richtige App wartet, und Auszahlungen (SCH-19/20). */
  ledger: LootLedger;
  /** Messenger mit Freundes-Spam und Anrufer-Chats (APP-05). */
  plauder: Plauder;
  /** Postfach: Chef-Mails, Freischaltungen, Spam (APP-07). */
  mail: Mailbox;
  /** Direktor Brülling im Büro (DAY-12/13). */
  boss: BossBrain;
  /** Die stärksten Momente des Tages (DAY-08). */
  moments: MomentLog;
  today: DayStats;
  /** Am Platz eingestempelt (erstes Hinsetzen des Tages, DAY-14). */
  clockedIn: boolean;
  /** Ausgestempelt (OS-07, DAY-04): Der Tag endet mit der Bewertung. */
  clockedOut: boolean;
  /** Wie oft heute schon am PC gesessen wurde (erste Sitzung: Chef-Mail). */
  desktopVisits: number;
  /** Ergebnis der Bewertung (sobald der Tag vorbei ist). */
  review: ReviewResult | null;
}

/** Ergebnis der Leistungsbewertung (DAY-05–09). */
export interface ReviewResult {
  day: number;
  quota: number;
  team: number;
  passed: boolean;
  /** Fehlbetrag bei verfehlter Quota. */
  missing: number;
  moments: Moment[];
  /** Was morgen freigeschaltet wird (nur bei bestandener Bewertung). */
  tomorrow: { apps: string[]; schemes: string[] };
  /** Index des Brülling-Spruchs (bestanden: `boss.passed`, gefeuert: `boss.fired`). */
  quote: number;
  report: RunReport | null;
}

/** Kündigungsbericht Schwindelheim (PRG-04). */
export interface RunReport {
  days: number;
  totalLoot: number;
  /** Rangliste nach verdientem Geld (solo: nur man selbst; Bots ab M8). */
  ranking: { id: string; loot: number }[];
  seconds: number;
  average: number;
  code: string;
  /** Platz in der Bestenliste (null = nicht drin). */
  rank: number | null;
  staplers: number;
}

/** Wohin Spielstände, Statistik und Bestenliste geschrieben werden (main.ts: SaveManager). */
export interface RunPersistence {
  saveRun(save: RunSave): void;
  clearRun(): void;
  updateStats(fn: (s: LifetimeStats) => void): void;
  addToLeaderboard(entry: LeaderEntry): number | null;
}

let persistence: RunPersistence | null = null;
let run: Run | null = null;
/** Debug-Menü: alles freigeschaltet. */
let unlockAllDebug = false;

export function setRunPersistence(p: RunPersistence | null): void {
  persistence = p;
}

/** Schicht-Code eines Runs zum Weitergeben (PRG-05). */
export function shiftCode(seed: number): string {
  return `MC-${(seed >>> 0).toString(36).toUpperCase().padStart(6, '0')}`;
}

function newCore(seed: number, day = 1): RunSave {
  return { seed, day, personal: 0, startedAt: Date.now(), playSeconds: 0, days: [], totals: { ...EMPTY_TOTALS, schemeWins: {} }, unlocks: [], notes: [], dossier: {} };
}

/** Neuer Run (Tag 1, oder im Test-Build `?day=N`). */
export function startNewRun(seed: number = TEST_PARAMS?.seed ?? Math.floor(Math.random() * 2 ** 31), day: number = TEST_PARAMS?.day ?? 1): Run {
  const core = newCore(seed, day);
  persistence?.updateStats((s) => {
    s.runs++;
  });
  return beginDay(core);
}

/** Gespeicherten Run fortsetzen: Der gespeicherte Tag beginnt von vorn. */
export function resumeRun(save: RunSave): Run {
  return beginDay(structuredClone(save));
}

export function currentRun(): Run {
  return run ?? startNewRun();
}

export function hasRun(): boolean {
  return run !== null;
}

export function currentShift(): ShiftState {
  return currentRun().shift;
}

/** Tag aufbauen: neue Anrufe, Apps und Chef; Geld, Notizen und Kundenkartei kommen aus dem Run. */
export function beginDay(core: RunSave): Run {
  run?.phone.destroy();
  const seed = core.seed;
  const day = core.day;
  // Jeder Tag hat seinen eigenen, aber reproduzierbaren Zufall.
  const rng = new Rng((seed ^ Math.imul(day, 0x9e3779b1)) >>> 0);
  const shift = new ShiftState({ day, personal: core.personal, ...(TEST_PARAMS?.dayLength ? { dayLength: TEST_PARAMS.dayLength } : {}) });
  const calls = new CallManager(rng, CALLERS, DESKS.length, day);
  if (TEST_PARAMS) {
    calls.open = TEST_PARAMS.calls;
    calls.scripted = [...TEST_PARAMS.ring];
    if (TEST_PARAMS.ringDesk !== null) calls.ringNow(TEST_PARAMS.ringDesk);
  }
  const notes = new Notebook();
  for (const n of [...core.notes].reverse()) notes.add(n.text, n.from);
  const ledger = new LootLedger();
  const payRng = new Rng(seed ^ 0x5eed ^ day);
  const unlocks = new Unlocks(day, new Set(core.unlocks), unlockAllDebug);
  const capture = (c: Capture): void => {
    const { loot } = c;
    const time = shift.dayLength - shift.timeLeft;
    // Notizblock: so, wie es vorgelesen wurde (mit Versprechern) – mitdenken muss man trotzdem (CAL-15).
    if (loot.kind === 'nummer' || loot.kind === 'code' || loot.kind === 'gutschein' || loot.kind === 'geld') {
      notes.add(t('os.notes.captured', { demand: t(`calls.demands.${loot.kind}`), value: loot.heard }), c.callerId, time);
    }
    const scheme = schemeById(loot.schemeId ?? DEFAULT_SCHEME_FOR[loot.kind] ?? '');
    if (!scheme) return;
    ledger.add({
      callId: c.callId,
      desk: c.desk,
      callerId: c.callerId,
      schemeId: scheme.id,
      kind: loot.kind,
      value: loot.value,
      amount: payoutFor(scheme, loot, c.caller, shift.day, payRng),
      input: scheme.input,
      ...(loot.bait ? { bait: true } : {}),
    });
  };
  const phone = new PhoneHub(calls, CALLERS, i18n, capture);
  phone.dossier.restore(core.dossier);
  const plauder = new Plauder(new Rng(seed ^ 0x91a0 ^ day), PLAUDER_FRIENDS, () => i18n.list('apps.plauder.spam'));
  const boss = new BossBrain(new Rng(seed ^ 0xb055 ^ day), day, BOSS_ROUTE, BOSS_SEAT);
  if (TEST_PARAMS?.bossIn != null) boss.patrolIn(TEST_PARAMS.bossIn);
  const moments = new MomentLog();
  const today: DayStats = { calls: 0, successes: 0, bestLoot: 0, schemeWins: {} };
  const mail = new Mailbox();
  const r: Run = { core, seed, shift, unlocks, vfs: new VirtualFs(START_FILES, START_TRASH), calls, phone, notes, ledger, plauder, mail, boss, moments, today, clockedIn: false, clockedOut: false, desktopVisits: 0, review: null };
  wireDay(r);
  dayStartMail(r);
  run = r;
  persistence?.saveRun(snapshot(r));
  return r;
}

/** Ereignisse des Tages: Statistik, Chef-Wut, Momente, Auszahlung. */
function wireDay(r: Run): void {
  const { shift, ledger, phone, calls, boss, moments, today, core } = r;
  // Auszahlung aufs eigene Guthaben und die Team-Summe (SCH-19).
  ledger.onPaid((item) => {
    shift.earn(item.amount);
    core.totals.loot += item.amount;
    if (item.amount > today.bestLoot) today.bestLoot = item.amount;
    moments.add('record', 50 + item.amount / 10, { amount: i18n.formatMoney(item.amount), name: t(`callers.${item.callerId}.short`), scheme: t(`schemes.${item.schemeId}.name`) });
  });
  ledger.onFailed((item, reason) => {
    const name = t(`callers.${item.callerId}.short`);
    if (reason === 'bait') {
      core.totals.baitsCaught++;
      moments.add('bait', 38, { name });
    } else moments.add('typo', 33, { name, scheme: t(`schemes.${item.schemeId}.name`) });
  });
  calls.on((e) => {
    if (e.type === 'missed') boss.onMissed();
  });
  phone.on((e) => {
    if (e.type !== 'ended') return;
    const rec = e.record;
    const c = rec.conversation;
    const name = t(`callers.${rec.callerId}.short`);
    const last = [...e.session.transcript].reverse().find((l) => l.who === 'caller')?.text ?? '';
    today.calls++;
    core.totals.calls++;
    const success = rec.outcome === 'success';
    boss.onCallEnded(success);
    if (success) {
      today.successes++;
      core.totals.successes++;
      const schemeId = c?.loots.find((l) => !l.bait)?.schemeId ?? c?.scheme?.id ?? DEFAULT_SCHEME_FOR[c?.loot?.kind ?? 'nummer'] ?? 'rentennummer';
      core.totals.schemeWins[schemeId] = (core.totals.schemeWins[schemeId] ?? 0) + 1;
      today.schemeWins[schemeId] = (today.schemeWins[schemeId] ?? 0) + 1;
      if (last) moments.add('quote', 40 + (c?.trust ?? 0) / 5, { name, text: last });
      if (rec.duration < 75) moments.add('fast', 45 + (75 - rec.duration) / 2, { name, seconds: Math.round(rec.duration) });
    } else if (rec.outcome === 'hangup' && last) {
      moments.add('hangup', 35 + (c?.reason === 'angry' ? 8 : 0), { name, text: last });
    }
  });
}

/** Tagesbeginn (DAY-14): Chef-Mail mit Tagesziel, Wetter und Spruch; Freischaltungen; etwas Spam. */
function dayStartMail(r: Run): void {
  const day = r.shift.day;
  const w = weatherOn(day);
  const sayings = i18n.list('mail.boss.sayings');
  const saying = sayings.length > 0 ? sayings[(r.seed + day * 7) % sayings.length]! : '';
  const spam = i18n.list('mail.spam.subjects');
  const bodies = i18n.list('mail.spam.bodies');
  if (spam.length > 0 && bodies.length > 0) {
    r.mail.add('spam', 'mail.spam.subject', 'mail.spam.body', { subject: spam[(r.seed + day * 3) % spam.length]!, body: bodies[(r.seed + day) % bodies.length]! });
  }
  const fresh = unlocksOn(day);
  if (day > 1 && (fresh.apps.length > 0 || fresh.schemes.length > 0)) {
    r.mail.add('system', 'mail.unlock.subject', 'mail.unlock.body', { list: unlockNames(fresh).join(', ') });
  }
  r.mail.add('boss', 'mail.boss.subject', 'mail.boss.body', {
    day,
    quota: i18n.formatMoney(r.shift.quota),
    weather: t(`os.weather.forecast.${w.id}`, { chance: w.chance }),
    saying,
  });
}

/** Anzeigenamen frisch freigeschalteter Apps und Maschen. */
export function unlockNames(u: { apps: string[]; schemes: string[] }): string[] {
  return [...u.apps.map((a) => t(`os.apps.${a}.title`)), ...u.schemes.map((s) => t(`schemes.${s}.name`))];
}

/** Erstes Hinsetzen des Tages: Einstempeln (DAY-14). */
export function clockIn(r: Run): boolean {
  if (r.clockedIn) return false;
  r.clockedIn = true;
  return true;
}

/** Ausstempeln (OS-07): nur mit erreichter Quota. */
export function clockOut(r: Run): boolean {
  if (r.clockedOut || !r.shift.quotaReached) return false;
  r.clockedOut = true;
  r.calls.open = false;
  return true;
}

/** Tag vorbei: Countdown abgelaufen oder ausgestempelt. */
export function dayOver(r: Run): boolean {
  return r.clockedOut || r.shift.timeUp;
}

/** Chef im festen Takt: Wut, Kontrollgänge, Erwischen (Strafgeld vom eigenen Guthaben). */
export function tickBoss(r: Run, dt: number, input: Omit<BossInput, 'progress' | 'elapsed'>): BossEvent[] {
  const s = r.shift;
  const events = r.boss.tick(dt, { ...input, progress: s.progress, elapsed: 1 - s.timeLeft / s.dayLength });
  for (const e of events) {
    if (e.type === 'catch') {
      const fine = Math.min(e.fine, s.personal);
      s.spend(fine);
      r.core.totals.bossCatches++;
      r.moments.add('catch', 42, { fine: i18n.formatMoney(fine) });
    } else if (e.type === 'yell') {
      r.core.totals.bossYells++;
      r.moments.add('yell', 30 + r.boss.yells * 4, { count: r.boss.yells });
    }
  }
  return events;
}

/** Spielstand-Kern mit dem aktuellen Stand der Tagesobjekte. */
export function snapshot(r: Run): RunSave {
  return {
    ...r.core,
    personal: r.shift.personal,
    notes: r.notes.notes.map((n) => ({ text: n.text, from: n.from })),
    dossier: r.phone.dossier.snapshot(),
    totals: { ...r.core.totals, schemeWins: { ...r.core.totals.schemeWins } },
    days: [...r.core.days],
    unlocks: [...r.core.unlocks],
  };
}

/**
 * Tag abschließen (DAY-05–09): Ergebnis festhalten, bei Erfolg den nächsten Tag speichern, beim
 * Rauswurf den Run beenden (Kündigungsbericht, Bestenliste, Statistik). Mehrfacher Aufruf liefert
 * dasselbe Ergebnis.
 */
export function finishDay(r: Run): ReviewResult {
  if (r.review) return r.review;
  const s = r.shift;
  r.calls.open = false;
  const seconds = s.dayLength - s.timeLeft;
  const passed = s.quotaReached;
  const rec: DayRecord = { day: s.day, quota: s.quota, team: s.team, passed, calls: r.today.calls, successes: r.today.successes, bestLoot: r.today.bestLoot, seconds };
  const core = r.core;
  core.days.push(rec);
  core.playSeconds += seconds;
  core.personal = s.personal;
  const fillers = i18n.list('review.idle');
  const quoteRng = new Rng((r.seed + s.day * 31) >>> 0);
  const result: ReviewResult = {
    day: s.day,
    quota: s.quota,
    team: s.team,
    passed,
    missing: Math.max(0, s.quota - s.team),
    moments: r.moments.top(3, fillers.length > 0 ? [fillers[quoteRng.int(0, fillers.length - 1)]!, ...fillers] : []),
    tomorrow: passed ? unlocksOn(s.day + 1) : { apps: [], schemes: [] },
    quote: quoteRng.int(0, Math.max(0, i18n.list(passed ? 'boss.passed' : 'boss.fired').length - 1)),
    report: null,
  };
  persistence?.updateStats((st) => {
    st.daysWorked++;
    st.calls += rec.calls;
    st.successes += rec.successes;
    st.loot += s.team;
    st.bestDayLoot = Math.max(st.bestDayLoot, s.team);
    st.playSeconds += seconds;
    st.bossCatches += r.boss.catches;
    st.bossYells += r.boss.yells;
    for (const [id, n] of Object.entries(r.today.schemeWins)) st.schemeWins[id] = (st.schemeWins[id] ?? 0) + n;
  });
  if (passed) {
    core.day = s.day + 1;
    const snap = snapshot(r);
    r.core = snap;
    persistence?.saveRun(snap);
  } else result.report = endRun(r);
  r.review = result;
  return result;
}

/** Tacker-Treffer aus der Bewertung nachtragen (DAY-11, Statistik „verschluckte Tacker“). */
export function recordStaplers(r: Run, hits: number): void {
  if (hits <= 0) return;
  r.core.totals.staplersHit += hits;
  persistence?.updateStats((st) => {
    st.staplersHit += hits;
  });
  if (r.review?.report) r.review.report.staplers = r.core.totals.staplersHit;
  else if (r.review?.passed) persistence?.saveRun(snapshot(r));
}

/** Rauswurf (MOD-05): Bericht, Bestenliste, Statistik; der Spielstand wird gelöscht. */
function endRun(r: Run): RunReport {
  const core = r.core;
  const days = core.days.length;
  const totalLoot = core.days.reduce((sum, d) => sum + d.team, 0);
  const code = shiftCode(core.seed);
  const entry: LeaderEntry = { days, loot: totalLoot, code, date: Date.now(), seconds: core.playSeconds };
  const rank = persistence?.addToLeaderboard(entry) ?? null;
  persistence?.updateStats((st) => {
    st.firings++;
    st.longestRun = Math.max(st.longestRun, days);
  });
  persistence?.clearRun();
  return {
    days,
    totalLoot,
    ranking: [{ id: 'player', loot: core.totals.loot }],
    seconds: core.playSeconds,
    average: days > 0 ? Math.round(totalLoot / days) : 0,
    code,
    rank,
    staplers: core.totals.staplersHit,
  };
}

/** Nach bestandener Bewertung: nächsten Tag aufbauen. */
export function nextDay(r: Run): Run {
  return beginDay(r.core);
}

/** Run verwerfen (Hauptmenü nach dem Rauswurf). */
export function dropRun(): void {
  run?.phone.destroy();
  run = null;
}

// ------------------------------------------------------------------ Debug-Menü (nur Dev-/Test-Build)

export const debugRun = {
  /** Neuen Tag direkt beginnen (Geld und Kundenkartei bleiben). */
  setDay(day: number): Run {
    const r = currentRun();
    const core = snapshot(r);
    core.day = Math.max(1, Math.min(99, Math.round(day)));
    return beginDay(core);
  },
  setMoney(amount: number): void {
    const s = currentRun().shift;
    s.personal = Math.max(0, Math.round(amount));
  },
  /** Quota sofort erreichen (Team-Summe = Quota). */
  skipQuota(): void {
    const s = currentRun().shift;
    if (s.team < s.quota) s.team = s.quota;
  },
  /** Countdown auf wenige Sekunden. */
  endDaySoon(seconds = 3): void {
    const s = currentRun().shift;
    s.timeLeft = Math.min(s.timeLeft, seconds);
  },
  unlockAll(on: boolean): void {
    unlockAllDebug = on;
    const r = currentRun();
    r.unlocks = new Unlocks(r.shift.day, new Set(r.core.unlocks), on);
  },
  get allUnlocked(): boolean {
    return unlockAllDebug;
  },
};

import { CALLERS } from '../data/callers';
import { DESKS } from '../data/office';
import { DEFAULT_SCHEME_FOR, schemeById } from '../data/schemes';
import { TEST_PARAMS } from '../debug/testParams';
import { START_FILES, START_TRASH } from '../data/os/files';
import { PLAUDER_FRIENDS } from '../data/os/plauder';
import { i18n, t } from '../i18n';
import { CallManager } from '../systems/calls/CallManager';
import { LootLedger } from '../systems/calls/ledger';
import { payoutFor } from '../systems/calls/payout';
import { PhoneHub, type Capture } from '../systems/calls/PhoneHub';
import { ShiftState } from '../systems/day/ShiftState';
import { Notebook } from '../systems/os/notebook';
import { Plauder } from '../systems/os/plauder';
import { VirtualFs } from '../systems/os/vfs';
import { Rng } from '../systems/rng/rng';

/**
 * Der laufende Run (Folge von Arbeitstagen bis zum Rauswurf): Schicht-Zustand, Anrufe und der Inhalt
 * des Arbeitsplatz-PCs. Speichern/Fortsetzen, Tageswechsel und Statistiken folgen mit M5.
 */
export interface Run {
  seed: number;
  shift: ShiftState;
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
  /** Wie oft heute schon am PC gesessen wurde (erste Sitzung: Chef-Mail). */
  desktopVisits: number;
}

let run: Run | null = null;

export function startNewRun(seed = TEST_PARAMS?.seed ?? Math.floor(Math.random() * 2 ** 31)): Run {
  run?.phone.destroy();
  const rng = new Rng(seed);
  const shift = new ShiftState();
  const calls = new CallManager(rng, CALLERS, DESKS.length);
  if (TEST_PARAMS) {
    calls.open = TEST_PARAMS.calls;
    calls.scripted = [...TEST_PARAMS.ring];
    if (TEST_PARAMS.ringDesk !== null) calls.ringNow(TEST_PARAMS.ringDesk);
  }
  const notes = new Notebook();
  const ledger = new LootLedger();
  const payRng = new Rng(seed ^ 0x5eed);
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
  // Auszahlung aufs eigene Guthaben und die Team-Summe (SCH-19).
  ledger.onPaid((item) => shift.earn(item.amount));
  const plauder = new Plauder(new Rng(seed ^ 0x91a0), PLAUDER_FRIENDS, () => i18n.list('apps.plauder.spam'));
  run = { seed, shift, vfs: new VirtualFs(START_FILES, START_TRASH), calls, phone, notes, ledger, plauder, desktopVisits: 0 };
  return run;
}

export function currentRun(): Run {
  return run ?? startNewRun();
}

export function currentShift(): ShiftState {
  return currentRun().shift;
}

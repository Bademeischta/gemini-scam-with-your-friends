import { CALLERS } from '../data/callers';
import { DESKS } from '../data/office';
import { TEST_PARAMS } from '../debug/testParams';
import { START_FILES, START_TRASH } from '../data/os/files';
import { i18n, t } from '../i18n';
import { CallManager } from '../systems/calls/CallManager';
import { PhoneHub } from '../systems/calls/PhoneHub';
import { ShiftState } from '../systems/day/ShiftState';
import { Notebook } from '../systems/os/notebook';
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
  const phone = new PhoneHub(calls, CALLERS, i18n, (c) =>
    notes.add(t('os.notes.captured', { demand: t(`calls.demands.${c.loot.kind}`), value: c.loot.value }), c.callerId, shift.dayLength - shift.timeLeft),
  );
  run = { seed, shift, vfs: new VirtualFs(START_FILES, START_TRASH), calls, phone, notes, desktopVisits: 0 };
  return run;
}

export function currentRun(): Run {
  return run ?? startNewRun();
}

export function currentShift(): ShiftState {
  return currentRun().shift;
}

import { START_FILES, START_TRASH } from '../data/os/files';
import { ShiftState } from '../systems/day/ShiftState';
import { VirtualFs } from '../systems/os/vfs';

/**
 * Der laufende Run (Folge von Arbeitstagen bis zum Rauswurf): Schicht-Zustand und der Inhalt
 * des Arbeitsplatz-PCs. Speichern/Fortsetzen, Tageswechsel und Statistiken folgen mit M5.
 */
export interface Run {
  shift: ShiftState;
  vfs: VirtualFs;
  /** Wie oft heute schon am PC gesessen wurde (erste Sitzung: Chef-Mail). */
  desktopVisits: number;
}

let run: Run | null = null;

export function startNewRun(): Run {
  run = { shift: new ShiftState(), vfs: new VirtualFs(START_FILES, START_TRASH), desktopVisits: 0 };
  return run;
}

export function currentRun(): Run {
  return run ?? startNewRun();
}

export function currentShift(): ShiftState {
  return currentRun().shift;
}

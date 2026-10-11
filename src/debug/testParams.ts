/**
 * Start-Parameter nur im E2E-Build (VITE_E2E=1), über die URL: `?calls=on|off&ring=hildegard,gerd&seed=42&ringDesk=0&day=3&dayLength=30`.
 * Damit laufen Tests deterministisch: ohne zufällige Anrufe (Standard im Test-Build), mit festen Anrufern
 * in fester Reihenfolge und festem Zufalls-Seed. Im normalen Build ist alles leer.
 */
export interface TestParams {
  /** Zufällige Anrufe an (Standard im Test-Build: aus). */
  calls: boolean;
  /** Anrufer, die nacheinander klingeln, sobald sich jemand an einen freien Platz setzt. */
  ring: string[];
  seed: number | null;
  /** Dieser Platz klingelt gleich zu Beginn (für Klingel-Pfeile im Büro). */
  ringDesk: number | null;
  /** Neuer Run beginnt an diesem Tag (Freischaltungen späterer Tage testen). */
  day: number | null;
  /** Tageslänge in Sekunden (Bewertung schnell erreichen). */
  dayLength: number | null;
  /** Erster Kontrollgang des Chefs nach … s. */
  bossIn: number | null;
}

function parse(search: string): TestParams {
  const q = new URLSearchParams(search);
  const seed = Number(q.get('seed'));
  const ringDesk = Number(q.get('ringDesk'));
  const day = Number(q.get('day'));
  const dayLength = Number(q.get('dayLength'));
  const bossIn = Number(q.get('bossIn'));
  return {
    bossIn: q.has('bossIn') && Number.isFinite(bossIn) && bossIn >= 0 ? bossIn : null,
    day: q.has('day') && Number.isInteger(day) && day >= 1 ? day : null,
    dayLength: q.has('dayLength') && Number.isFinite(dayLength) && dayLength > 0 ? dayLength : null,
    ringDesk: q.has('ringDesk') && Number.isInteger(ringDesk) ? ringDesk : null,
    calls: q.get('calls') === 'on',
    ring: (q.get('ring') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    seed: Number.isFinite(seed) && q.has('seed') ? seed : null,
  };
}

export const TEST_PARAMS: TestParams | null = import.meta.env.VITE_E2E === '1' && typeof location !== 'undefined' ? parse(location.search) : null;

import { SCHEMES, schemeById } from '../../data/schemes';

/**
 * Freischalt-Plan (DAY-10, PRG-03, SCH-21): Tag 1 Telefon, Ident-o-Mat und Rentennummer-Raffer,
 * Tag 2 Plauderbude (Turbo-Masche) und Gutschein-Kasse, Tag 3 FernGucker und Kundenkartei, danach
 * je Tag zwei weitere, immer absurdere Maschen (Tag der Masche siehe `SchemeDef.unlockDay`).
 * Apps ohne Eintrag sind ab Tag 1 da.
 */
export const APP_UNLOCK_DAY: Readonly<Record<string, number>> = {
  plauder: 2,
  voucher: 2,
  ferngucker: 3,
  kartei: 3,
};

export function appUnlockDay(appId: string): number {
  return APP_UNLOCK_DAY[appId] ?? 1;
}

export function schemeUnlockDay(schemeId: string): number {
  return schemeById(schemeId)?.unlockDay ?? 1;
}

/** Was an genau diesem Tag neu dazukommt (Bewertung: „Morgen gibt es …“, Kalender). */
export function unlocksOn(day: number): { apps: string[]; schemes: string[] } {
  return {
    apps: Object.entries(APP_UNLOCK_DAY)
      .filter(([, d]) => d === day)
      .map(([id]) => id),
    schemes: SCHEMES.filter((s) => s.unlockDay === day).map((s) => s.id),
  };
}

/** Letzter Tag, an dem noch etwas freigeschaltet wird. */
export const LAST_UNLOCK_DAY = Math.max(...Object.values(APP_UNLOCK_DAY), ...SCHEMES.map((s) => s.unlockDay));

/** Freischaltungen eines Tages, plus Extras (Ramschazon ab M6, Debug-Menü). */
export class Unlocks {
  constructor(
    private readonly day: number,
    private readonly extra: ReadonlySet<string> = new Set(),
    /** Alles frei (Debug-Menü). */
    private readonly all = false,
  ) {}

  app(id: string): boolean {
    return this.all || this.extra.has(`app:${id}`) || appUnlockDay(id) <= this.day;
  }

  scheme(id: string): boolean {
    return this.all || this.extra.has(`scheme:${id}`) || schemeUnlockDay(id) <= this.day;
  }
}

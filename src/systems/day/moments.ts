/**
 * Die drei stärksten Momente des Tages (DAY-08): Rekord-Abschlüsse, Zitate von Anrufern und
 * Chaos-Highlights werden während des Tages gesammelt und bewertet; die Bewertung zeigt die
 * drei besten (höchstens einen je Art, damit es abwechslungsreich bleibt).
 */
export type MomentKind = 'record' | 'quote' | 'fast' | 'hangup' | 'bait' | 'typo' | 'yell' | 'catch' | 'idle';

export interface Moment {
  kind: MomentKind;
  /** i18n-Schlüssel `review.moments.<kind>` mit diesen Platzhaltern. */
  params: Record<string, string | number>;
  score: number;
}

export class MomentLog {
  private readonly list: Moment[] = [];

  add(kind: MomentKind, score: number, params: Record<string, string | number> = {}): void {
    this.list.push({ kind, score, params });
  }

  get all(): readonly Moment[] {
    return this.list;
  }

  /** Die besten `n` Momente, je Art höchstens einer; fehlt etwas, füllen Büro-Kleinigkeiten auf. */
  top(n = 3, fillers: readonly string[] = []): Moment[] {
    const sorted = [...this.list].sort((a, b) => b.score - a.score);
    const out: Moment[] = [];
    const kinds = new Set<MomentKind>();
    for (const m of sorted) {
      if (kinds.has(m.kind)) continue;
      kinds.add(m.kind);
      out.push(m);
      if (out.length === n) return out;
    }
    for (const text of fillers) {
      if (out.length >= n) break;
      out.push({ kind: 'idle', score: 0, params: { text } });
    }
    return out;
  }
}

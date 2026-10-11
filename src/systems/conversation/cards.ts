import type { Rng } from '../rng/rng';
import type { Phase } from './engine';
import { DEMANDS, ROLES, TOPICS, type DemandKind, type Mood, type Role, type Topic } from './types';

/**
 * Schnellantwort-Karten (CAL-06): vorgeschlagene Sätze passend zur Lage. Sie laufen durch dieselbe
 * Auswertung wie freie Eingaben – es gibt gute, mittelmäßige und schlechte Optionen; welche Karte
 * bei welcher Figur zieht, muss man herausfinden.
 */
export interface Card {
  id: string;
  category: string;
  text: string;
}

export const CARD_CATEGORIES: readonly string[] = [
  'greet',
  ...ROLES.map((r) => `introduce.${r}`),
  'smalltalk',
  'ask',
  'compliment',
  'empathy',
  'calm',
  'explain',
  'urgency',
  'threat',
  'apology',
  'laugh',
  'thanks',
  'promise',
  'confirm',
  'farewell',
  'insult',
  'askRepeat',
  ...DEMANDS.map((d) => `demand.${d}`),
  ...TOPICS.map((t) => `topic.${t}`),
];

/** i18n-Schlüssel einer Kategorie (Maschen-Karten stehen unter schemes.<id>.cards.*). */
function keyOf(category: string): string {
  return category.startsWith('schemes.') ? category : `cards.${category}`;
}

export interface DealState {
  turns: number;
  trust: number;
  threshold: number;
  mood: Mood;
  role: Role | null;
  /** Themen, zu denen der Anrufer eine Meinung hat (Vorlieben und Abneigungen gemischt – welche was ist, muss man herausfinden). */
  hints?: readonly Topic[];
  phase?: Phase;
  /** Beute schon diktiert (Nachfragen und Verabschieden werden wichtiger). */
  hasLoot?: boolean;
  /** Gewählte Masche: deren Pitch- und Forderungs-Karten kommen dazu. */
  scheme?: { id: string; phase: Phase; nextDemand: DemandKind | null };
}

export class CardDeck {
  private readonly usedIds = new Set<string>();

  constructor(
    private readonly rng: Rng,
    private readonly list: (key: string) => string[],
  ) {}

  /** Karten bereits gesagt (werden nicht wieder angeboten, solange es andere gibt). */
  markUsed(card: Card): void {
    this.usedIds.add(card.id);
  }

  /** `n` Karten für die aktuelle Lage; `exclude` = gerade angezeigte (für „Andere Karten“). */
  deal(s: DealState, n = 4, exclude: readonly Card[] = []): Card[] {
    const weights = this.weights(s);
    const excluded = new Set(exclude.map((c) => c.category));
    const cats = [...weights.entries()].filter(([c, w]) => w > 0 && this.list(keyOf(c)).length > 0);
    const out: Card[] = [];
    const taken = new Set<string>();
    // Gewichtete Auswahl ohne Zurücklegen; gerade gezeigte Kategorien nur, wenn nichts anderes übrig ist.
    for (let pass = 0; pass < 2 && out.length < n; pass++) {
      const pool = cats.filter(([c]) => !taken.has(c) && (pass === 1 || !excluded.has(c)));
      while (out.length < n && pool.length > 0) {
        const total = pool.reduce((a, [, w]) => a + w, 0);
        let r = this.rng.next() * total;
        let i = 0;
        for (; i < pool.length - 1; i++) {
          r -= pool[i]![1];
          if (r <= 0) break;
        }
        const [cat] = pool.splice(i, 1)[0]!;
        taken.add(cat);
        const card = this.pick(cat);
        if (card) out.push(card);
      }
    }
    return out;
  }

  private pick(category: string): Card | null {
    const texts = this.list(keyOf(category));
    if (texts.length === 0) return null;
    const ids = texts.map((_, i) => `${category}.${i}`);
    const fresh = ids.map((id, i) => ({ id, i })).filter((x) => !this.usedIds.has(x.id));
    const choice = fresh.length > 0 ? fresh[this.rng.int(0, fresh.length - 1)]! : { id: ids[0]!, i: 0 };
    return { id: choice.id, category, text: texts[choice.i]! };
  }

  private weights(s: DealState): Map<string, number> {
    const w = new Map<string, number>();
    const set = (c: string, v: number): void => {
      w.set(c, (w.get(c) ?? 0) + v);
    };
    const upset = s.mood === 'wuetend' || s.mood === 'genervt';
    const scared = s.mood === 'aengstlich' || s.mood === 'misstrauisch';
    if (s.turns === 0) {
      set('greet', 6);
      for (const r of ROLES) set(`introduce.${r}`, 0.5);
      set('ask', 1.5);
      set('smalltalk', 1);
      set('compliment', 0.8);
      return w;
    }
    if (s.role === null) for (const r of ROLES) set(`introduce.${r}`, s.turns < 3 ? 0.35 : 0.15);
    set('greet', s.turns < 2 ? 0.6 : 0.05);
    set('smalltalk', 1.2);
    set('ask', 1.2);
    set('compliment', 1.2);
    set('empathy', 1);
    set('explain', 0.8);
    set('promise', 0.5);
    set('laugh', 0.6);
    set('thanks', 0.4);
    set('confirm', 0.3);
    set('calm', upset || scared ? 2 : 0.4);
    set('apology', upset ? 2.5 : 0.25);
    // Themen: eines, zu dem der Anrufer eine Meinung hat (gut oder schlecht – das ist der Reiz), dazu zwei zufällige.
    const hinted = s.hints && s.hints.length > 0 ? s.hints[this.rng.int(0, s.hints.length - 1)]! : null;
    const shuffled = [...TOPICS].filter((t) => t !== hinted).sort(() => this.rng.next() - 0.5).slice(0, hinted ? 2 : 3);
    if (hinted) set(`topic.${hinted}`, 1.4);
    for (const t of shuffled) set(`topic.${t}`, 0.7);
    const ready = s.trust >= s.threshold - 10;
    for (const d of DEMANDS) set(`demand.${d}`, (ready ? 2.2 : 0.35) / DEMANDS.length * 3);
    set('urgency', 0.4);
    set('threat', 0.25);
    set('insult', 0.15);
    set('farewell', s.turns > 12 ? 1 : 0.2);
    // Masche gewählt: Geschichte erzählen, dann passend fordern.
    const sch = s.scheme;
    if (sch) {
      set(`schemes.${sch.id}.cards.pitch`, sch.phase === 'pitch' ? 3.5 : sch.phase === 'vertrauen' ? 0.8 : 0.3);
      set(`schemes.${sch.id}.cards.demand`, sch.phase === 'forderung' && sch.nextDemand ? 3.5 : 0.3);
    }
    // Nach dem Diktat: nachfragen oder verabschieden.
    if (s.hasLoot) {
      set('askRepeat', s.phase === 'beute' ? 2.5 : 1);
      set('farewell', 2);
    }
    return w;
  }
}

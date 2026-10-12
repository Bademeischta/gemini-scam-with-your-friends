/** Gemeinsame Typen der Gesprächs-Engine. */

export const INTENTS = [
  'greet',
  'introduce',
  'smalltalk',
  'compliment',
  'empathy',
  'urgency',
  'threat',
  'calm',
  'explain',
  'demand',
  'confirm',
  'deny',
  'insult',
  'apology',
  'laugh',
  'thanks',
  'farewell',
  'promise',
] as const;
export type Intent = (typeof INTENTS)[number];

/** Rollen, als die sich der Spieler ausgeben kann. */
export const ROLES = ['bank', 'amt', 'technik', 'familie', 'gewinn', 'polizei', 'arzt', 'lieferung', 'krypto', 'raumfahrt', 'kirche', 'presse'] as const;
export type Role = (typeof ROLES)[number];

/** Arten sensibler Forderungen (die eigentliche Beute je Masche folgt mit M4). */
export const DEMANDS = ['nummer', 'code', 'gutschein', 'geld', 'daten', 'klick', 'jawort'] as const;
export type DemandKind = (typeof DEMANDS)[number];

/** Gesprächsthemen, die Anrufer mögen oder hassen. */
export const TOPICS = [
  'katzen', 'hunde', 'garten', 'familie', 'sterne', 'omen', 'raumfahrt', 'protokoll', 'krypto', 'geld', 'mode', 'socialmedia', 'fitness',
  'essen', 'kuehe', 'technik', 'spiele', 'kirche', 'reisen', 'luxus', 'verschwoerung', 'erfindungen', 'wissenschaft', 'grammatik',
  'klatsch', 'schlaf', 'beschwerde', 'musik', 'wetter', 'kaffee', 'kuchen', 'polizei', 'magie', 'autos', 'fussball', 'buecher',
] as const;
export type Topic = (typeof TOPICS)[number];

export const MOODS = ['vertrauensvoll', 'neutral', 'misstrauisch', 'verwirrt', 'amuesiert', 'genervt', 'wuetend', 'aengstlich', 'gelangweilt'] as const;
export type Mood = (typeof MOODS)[number];

/** Ergebnis des Sprachverständnisses für eine Eingabe. */
export interface Features {
  intents: Partial<Record<Intent, number>>;
  /** Rollen, die der Spieler für sich beansprucht. */
  roleClaims: Role[];
  demands: DemandKind[];
  topics: Topic[];
  question: boolean;
  negated: boolean;
  /** Höflichkeit 0–1 (bitte, danke, Siezen). */
  polite: number;
  words: number;
  unknownRatio: number;
  /** 0–1: Kauderwelsch, Tastatur-Gehämmer, völlig Themenfremdes. */
  nonsense: number;
  /** Der Spieler nennt den Namen des Anrufers. */
  nameMention: boolean;
  /** Name, unter dem sich der Spieler vorstellt („Ich bin Herr Schmidt“). */
  claimedName: string | null;
  numbers: string[];
  /** Auffälliges Wort des Spielers für Echo-Antworten („Mondgrundstück?“). */
  echo: string | null;
  /** Wortstämme (für Wiederholungs-Erkennung). */
  stems: string[];
  /** Schreien (Großbuchstaben, viele Ausrufezeichen). */
  shouting: boolean;
  /** Maschen, deren Schlüsselwörter fallen (Pitch, CAL-14). */
  schemes: string[];
  /** Bitte um Wiederholung („Nochmal bitte, langsamer“). */
  askRepeat: boolean;
}

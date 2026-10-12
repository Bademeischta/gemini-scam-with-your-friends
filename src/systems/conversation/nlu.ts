import { DEMAND_LEX, INTENT_LEX, NEGATIONS, POLITE, REPEAT_LEX, ROLE_LEX, STOPWORDS, TOPIC_LEX, type LexEntry } from '../../data/nlu/de';
import { SCHEMES } from '../../data/schemes';
import { analyze, extractNumbers, isNumberWord, normalize, stem, wordMatches, type MatchMode, type Token } from './text';
import { DEMANDS, INTENTS, ROLES, TOPICS, type DemandKind, type Features, type Intent, type Role, type Topic } from './types';

interface Compiled {
  words: string[];
  weight: number;
}

function compile(entries: readonly LexEntry[]): Compiled[] {
  return entries.map((e) => {
    const [text, weight] = typeof e === 'string' ? [e, 1] : [e[0], e[1]];
    return { words: normalize(text).split(' ').filter(Boolean), weight };
  });
}

function compileRecord<K extends string>(keys: readonly K[], lex: Readonly<Record<K, readonly LexEntry[]>>): Record<K, Compiled[]> {
  const out = {} as Record<K, Compiled[]>;
  for (const k of keys) out[k] = compile(lex[k]);
  return out;
}

const INTENT_C = compileRecord(INTENTS, INTENT_LEX);
const ROLE_C = compileRecord(ROLES, ROLE_LEX);
const DEMAND_C = compileRecord(DEMANDS, DEMAND_LEX);
const TOPIC_C = compileRecord(TOPICS, TOPIC_LEX);
const SCHEME_IDS = SCHEMES.map((s) => s.id);
const SCHEME_C = compileRecord(SCHEME_IDS, Object.fromEntries(SCHEMES.map((s) => [s.id, s.keywords])));
const REPEAT_C = compile(REPEAT_LEX);
const NEG = new Set(NEGATIONS.map(normalize));
const STOP = new Set(STOPWORDS.map(normalize));
const POLITE_SET = new Set(POLITE.map(normalize));

/** Fundstellen eines Eintrags: Startindex aller passenden Wortfolgen. */
function findAll(tokens: Token[], words: string[], mode: MatchMode): number[] {
  const hits: number[] = [];
  if (words.length === 0) return hits;
  for (let i = 0; i + words.length <= tokens.length; i++) {
    let ok = true;
    for (let j = 0; j < words.length; j++) {
      if (!wordMatches(tokens[i + j]!, words[j]!, mode)) {
        ok = false;
        break;
      }
    }
    if (ok) hits.push(i);
  }
  return hits;
}

/** Steht eine Verneinung direkt davor (bis zu zwei Wörter)? */
function negatedAt(tokens: Token[], i: number): boolean {
  for (let k = Math.max(0, i - 2); k < i; k++) if (NEG.has(tokens[k]!.norm)) return true;
  return false;
}

/** Tastatur-Gehämmer: keine Vokale oder lange Wiederholungen. */
function gibberish(word: string): boolean {
  if (word.length < 4) return false;
  if (!/[aeiouy]/.test(word)) return true;
  if (/(.)\1\1\1/.test(word)) return true;
  return /^(asdf|qwer|jkl|yxcv|wasd)/.test(word);
}

export interface NluContext {
  /** Name(n) des Anrufers (Vor- und Nachname, Spitzname) für „Name genannt“. */
  callerNames: readonly string[];
}

/**
 * Sprachverständnis: wandelt eine freie Eingabe in einen Merkmalsvektor um.
 * Mehrwort-Einträge haben Vorrang; was sie abdecken, zählt nicht doppelt.
 */
export function understand(text: string, ctx: NluContext): Features {
  const a = analyze(text);
  const tokens = a.tokens;
  /** Von irgendeinem Eintrag erkannte Wörter (für „unbekannt“ und Kauderwelsch). */
  const known = new Set<number>();
  const intents: Partial<Record<Intent, number>> = {};
  let negatedAny = false;

  // Jede Tabelle (Absichten, Rollen, Forderungen, Themen) wertet für sich: Ein Wort wie „Enkel“
  // kann Smalltalk, Rolle und Thema zugleich sein. Innerhalb einer Tabelle zählt jedes Wort nur einmal.
  const scan = <K extends string>(table: Record<K, Compiled[]>, keys: readonly K[], onHit: (k: K, weight: number, negated: boolean) => void): void => {
    const covered = new Set<number>();
    // Längste Einträge zuerst, damit „keine sorge“ vor „sorge“ greift; genaue Treffer vor
    // Komposita vor Tippfehlern („Kuchen“ ist Kuchen, nicht „kochen“ mit Tippfehler).
    const all = keys.flatMap((k) => table[k].map((e) => ({ k, e }))).sort((x, y) => y.e.words.length - x.e.words.length);
    for (const mode of ['exact', 'compound', 'fuzzy'] as const) {
      for (const { k, e } of all) {
        for (const i of findAll(tokens, e.words, mode)) {
          const span = e.words.map((_, j) => i + j);
          if (span.some((s) => covered.has(s))) continue;
          const neg = negatedAt(tokens, i) && !e.words.some((w) => NEG.has(w));
          for (const s of span) {
            covered.add(s);
            known.add(s);
          }
          onHit(k, e.weight, neg);
        }
      }
    }
  };

  scan(INTENT_C, INTENTS, (k, w, neg) => {
    if (neg) {
      negatedAny = true;
      return;
    }
    intents[k] = Math.min(1.5, (intents[k] ?? 0) + w);
  });

  const roleHits = new Set<Role>();
  scan(ROLE_C, ROLES, (k, _w, neg) => {
    if (!neg) roleHits.add(k);
    else negatedAny = true;
  });
  const demands = new Set<DemandKind>();
  scan(DEMAND_C, DEMANDS, (k, _w, neg) => {
    if (!neg) demands.add(k);
  });
  const topics = new Set<Topic>();
  scan(TOPIC_C, TOPICS, (k) => topics.add(k));
  const schemes = new Set<string>();
  scan(SCHEME_C, SCHEME_IDS, (k, _w, neg) => {
    if (!neg) schemes.add(k);
  });
  let askRepeat = false;
  for (const e of REPEAT_C) {
    for (const i of findAll(tokens, e.words, 'compound')) {
      askRepeat = true;
      e.words.forEach((_, j) => known.add(i + j));
    }
  }

  // Forderungs-Absicht: eine Forderungs-Art zählt auch ohne „geben Sie mir“.
  if (demands.size > 0) intents.demand = Math.min(1.5, (intents.demand ?? 0) + 0.8);

  // Rollen gelten als Behauptung, wenn sich der Spieler vorstellt oder „von der …“ sagt.
  const claimsRole = (intents.introduce ?? 0) > 0 || /\b(von der|vom|ich bin|wir sind|hier ist|hier spricht)\b/.test(a.norm);
  const roleClaims = claimsRole ? [...roleHits] : [];

  // Name des Anrufers.
  const nameStems = ctx.callerNames.map((n) => normalize(n)).filter((n) => n.length >= 3);
  const nameMention = tokens.some((t) => nameStems.some((n) => wordMatches(t, n)));

  // Vorstellung mit Namen („ich bin Herr Huber“, „mein Name ist Kim“).
  const claimedName = findClaimedName(text);

  const negated = negatedAny || tokens.some((t) => NEG.has(t.norm));
  const polite = Math.min(1, tokens.filter((t) => POLITE_SET.has(t.norm)).length * 0.35);
  const numbers = extractNumbers(text);

  // Unbekannte Wörter und Kauderwelsch.
  const unknown = tokens.filter((t, i) => !known.has(i) && !STOP.has(t.norm) && !/^\d+$/.test(t.norm) && !isNumberWord(t.norm) && !nameStems.some((n) => wordMatches(t, n)));
  const content = tokens.filter((t) => !STOP.has(t.norm));
  const unknownRatio = content.length === 0 ? 0 : unknown.length / content.length;
  const hasMeaning = Object.keys(intents).length > 0 || topics.size > 0 || roleHits.size > 0 || schemes.size > 0 || askRepeat || numbers.length > 0 || nameMention;
  let nonsense = 0;
  const gib = unknown.filter((t) => gibberish(t.norm)).length;
  if (gib > 0) nonsense = Math.min(1, 0.5 + gib * 0.25);
  else if (!hasMeaning && content.length >= 2 && unknownRatio >= 0.75) nonsense = 0.7;
  else if (!hasMeaning && content.length === 1 && unknown.length === 1) nonsense = 0.4;

  // Echo: längstes unbekanntes Wort ab 5 Zeichen (Original-Schreibweise).
  const echoTok = [...unknown].filter((t) => t.raw.length >= 5 && !gibberish(t.norm)).sort((x, y) => y.raw.length - x.raw.length)[0];

  const letters = text.replace(/[^A-Za-zÄÖÜäöüß]/g, '');
  const shouting = (letters.length >= 6 && letters === letters.toUpperCase()) || /!!+/.test(text);

  return {
    intents,
    roleClaims,
    demands: [...demands],
    topics: [...topics],
    question: a.question,
    negated,
    polite,
    words: tokens.length,
    unknownRatio,
    nonsense,
    nameMention,
    claimedName,
    numbers,
    echo: echoTok?.raw ?? null,
    stems: tokens.filter((t) => !STOP.has(t.norm)).map((t) => t.stem),
    shouting,
    schemes: [...schemes],
    askRepeat,
  };
}

/** „Ich bin Herr Huber“, „mein Name ist Kim Lüdke“, „hier spricht Frau Meier“ → Name. */
export function findClaimedName(text: string): string | null {
  const intro = /(mein name ist|ich hei(?:ß|ss)e|hier spricht|ich bin)\s+/i.exec(text);
  if (!intro) return null;
  const rest = text.slice(intro.index + intro[0].length);
  // Namen beginnen groß; „Ich bin Ihr Enkel“ oder „ich bin müde“ sind keine Namensnennung.
  const m = /^((?:Herr|Frau|Dr\.?|Doktor)\s+)?([A-ZÄÖÜ][\p{L}-]+(?:\s+[A-ZÄÖÜ][\p{L}-]+)?)/u.exec(rest);
  if (!m) return null;
  const first = m[2]!.split(/\s+/)[0]!;
  if (/^(Ihr|Ihre|Ihnen|Sie|Der|Die|Das|Von|Vom|Hier|Gleich|Sehr|Auch|Nicht|Kein|Keine|Ein|Eine)$/.test(first)) return null;
  return `${m[1] ?? ''}${m[2]}`.trim();
}

/** Für Tests und Werkzeuge: Grundform wie im Lexikon. */
export function lexStem(word: string): string {
  return stem(normalize(word));
}

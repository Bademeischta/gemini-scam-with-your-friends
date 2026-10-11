/**
 * Text-Werkzeuge der Gesprächs-Engine (Deutsch): Normalisierung, leichtes Stemming,
 * Unscharf-Abgleich gegen Tipp- und Hörfehler und Zahlen-Erkennung (Ziffern und Zahlwörter).
 */

export interface Token {
  /** Normalisiert (klein, ä→ae, ohne Satzzeichen). */
  norm: string;
  /** Grundform (leichtes Stemming). */
  stem: string;
  /** Originalschreibweise (für Echo-Bausteine). */
  raw: string;
}

export interface Analyzed {
  raw: string;
  norm: string;
  tokens: Token[];
  question: boolean;
  exclamation: boolean;
}

const FOLD: Readonly<Record<string, string>> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss', é: 'e', è: 'e', à: 'a', ç: 'c' };

/** Kleinschreibung, Umlaute ausgeschrieben, Satzzeichen zu Leerzeichen. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[äöüßéèàç]/g, (c) => FOLD[c] ?? c)
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const SUFFIXES = ['ungen', 'ern', 'em', 'en', 'er', 'es', 'e', 'n', 's'];

/** Leichtes deutsches Stemming: ein häufiges Endungs-Suffix ab Wortlänge 5 abschneiden. */
export function stem(word: string): string {
  if (word.length < 5) return word;
  for (const s of SUFFIXES) {
    if (word.endsWith(s) && word.length - s.length >= 4) return word.slice(0, -s.length);
  }
  return word;
}

export function analyze(text: string): Analyzed {
  const rawWords = text.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 0);
  const tokens: Token[] = [];
  for (const raw of rawWords) {
    const norm = normalize(raw);
    if (!norm) continue;
    for (const part of norm.split(' ')) tokens.push({ norm: part, stem: stem(part), raw });
  }
  const trimmed = text.trim();
  return {
    raw: text,
    norm: tokens.map((t) => t.norm).join(' '),
    tokens,
    question: /\?\s*$/.test(trimmed) || /^(wer|wie|was|wo|wann|warum|wieso|weshalb|welche|welcher|welches|woher|wohin|koennen|kannst|haben|hast|sind|bist|darf|duerfen|ist)\b/.test(normalize(trimmed)),
    exclamation: /!\s*$/.test(trimmed),
  };
}

/** Damerau-Levenshtein-Distanz (optimal string alignment), mit Abbruch über `max`. */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const n = a.length;
  const m = b.length;
  let prev2 = new Array<number>(m + 1).fill(0);
  let prev = Array.from({ length: m + 1 }, (_, j) => j);
  for (let i = 1; i <= n; i++) {
    const cur = new Array<number>(m + 1).fill(0);
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2]! + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[m]!;
}

/**
 * Wort passt zu einem Lexikon-Eintrag: gleich, gleiche Grundform oder – nur bei längeren Wörtern –
 * ein einzelner Tipp-/Hörfehler (Vertauschen, Auslassen, Ersetzen). Kurze Wörter und Stämme werden
 * nie unscharf verglichen, sonst wäre „Bank“ ≈ „danke“.
 */
/**
 * Wortvergleich in drei Stufen: 'exact' (Form oder Stamm), 'compound' (deutsches Kompositum:
 * „Arztpraxis“ enthält „praxis“, „Lieblingsessen“ beginnt mit „lieblings“; ab 6 Buchstaben),
 * 'fuzzy' (zusätzlich ein Tippfehler bei längeren Wörtern). Jede Stufe schließt die vorherigen ein.
 */
export type MatchMode = 'exact' | 'compound' | 'fuzzy';

export function wordMatches(token: Token, entry: string, mode: MatchMode = 'fuzzy'): boolean {
  if (token.norm === entry || token.stem === entry) return true;
  if (token.stem === stem(entry)) return true;
  if (mode === 'exact') return false;
  if (entry.length >= 6 && token.norm.length > entry.length + 2 && (token.norm.endsWith(entry) || token.norm.startsWith(entry))) return true;
  if (mode === 'compound') return false;
  if (entry.length >= 6 && token.norm.length >= 6) return editDistance(token.norm, entry, 1) <= 1;
  return false;
}

/** Zahlwort (null … neun)? */
export function isNumberWord(word: string): boolean {
  return DIGIT_WORDS[word] !== undefined;
}

// ------------------------------------------------------------------ Zahlen

const DIGIT_WORDS: Readonly<Record<string, string>> = {
  null: '0', zero: '0', eins: '1', ein: '1', eine: '1', zwei: '2', zwo: '2', drei: '3', vier: '4', fuenf: '5', sechs: '6', sieben: '7', acht: '8', neun: '9',
};

/**
 * Ziffernfolgen aus Text: „4 8 2“, „482“ und „vier acht zwei“ ergeben jeweils „482“.
 * Zusammenhängende Ziffern und Zahlwörter werden zu einer Folge verbunden.
 */
export function extractNumbers(text: string): string[] {
  const words = normalize(text).split(' ');
  const out: string[] = [];
  let cur = '';
  let onlyArticle = true;
  const flush = (): void => {
    // Ein einzelnes „ein“/„eine“ ist meist ein Artikel, keine Zahl.
    if (cur && !(onlyArticle && cur === '1')) out.push(cur);
    cur = '';
    onlyArticle = true;
  };
  for (const w of words) {
    const d = /^\d+$/.test(w) ? w : DIGIT_WORDS[w];
    if (d === undefined) {
      flush();
      continue;
    }
    if (w !== 'ein' && w !== 'eine') onlyArticle = false;
    cur += d;
  }
  flush();
  return out;
}

/** Wortmengen-Ähnlichkeit (Jaccard) zweier Sätze. */
export function jaccard(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

import { TUNING } from '../../config/tuning';
import { normalize } from '../conversation/text';
import { MOODS, type Mood } from '../conversation/types';

/**
 * Regeln für KI-Anrufer, ohne Netz und ohne Phaser (Vitest): Antwort prüfen und begrenzen,
 * Floskeln abnutzen, Manipulationsversuche erkennen, Streaming-Text aus halbfertigem JSON lesen.
 */

/** Was die KI je Spieler-Satz liefert (nach Prüfung). */
export interface AiVerdict {
  /** Was der Anrufer sagt (kurz, wie am Telefon). */
  say: string;
  /** Vorschlag: Vertrauensänderung (wird von der Spiellogik begrenzt und verrechnet). */
  trustDelta: number;
  /** Vorschlag: Stimmung nach dem Satz. */
  mood: Mood;
  /** Vorschlag: Anrufer legt auf (nur unter Bedingungen, siehe Conversation.applyAi). */
  hangup: boolean;
  /** Der Spieler hat gerade die Geschichte der Masche erzählt. */
  pitchHeard: boolean;
}

/** JSON-Schema der Antwort (strukturierte Ausgabe). `say` steht vorne, damit es zuerst gestreamt wird. */
export const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    say: { type: 'string', description: 'Was du am Telefon sagst: 1–2 kurze Sätze auf Deutsch, ohne Ziffern oder Codes.' },
    trust_delta: { type: 'integer', description: 'Vertrauensänderung durch den letzten Satz deines Gesprächspartners, -15 bis +10.' },
    mood: { type: 'string', enum: [...MOODS] },
    hangup: { type: 'boolean', description: 'true nur, wenn du wirklich auflegst.' },
    pitch_heard: { type: 'boolean', description: 'true, wenn er dir gerade die Geschichte seiner Masche erzählt hat.' },
  },
  required: ['say', 'trust_delta', 'mood', 'hangup', 'pitch_heard'],
  additionalProperties: false,
} as const;

/** Rohes JSON der KI prüfen; null = unbrauchbar (dann antwortet die lokale Engine). */
export function parseVerdict(json: string): AiVerdict | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    // Ohne Schema-Zwang packen manche Modelle das JSON in Codeblöcke oder Text: das Objekt herausschneiden.
    const from = json.indexOf('{');
    const to = json.lastIndexOf('}');
    if (from < 0 || to <= from) return null;
    try {
      raw = JSON.parse(json.slice(from, to + 1));
    } catch {
      return null;
    }
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const say = typeof r['say'] === 'string' ? cleanSay(r['say']) : '';
  if (!say) return null;
  const delta = typeof r['trust_delta'] === 'number' && Number.isFinite(r['trust_delta']) ? r['trust_delta'] : 0;
  const mood = (MOODS as readonly unknown[]).includes(r['mood']) ? (r['mood'] as Mood) : 'neutral';
  return {
    say,
    trustDelta: Math.round(clamp(delta, TUNING.ai.rawMin, TUNING.ai.rawMax)),
    mood,
    hangup: r['hangup'] === true,
    pitchHeard: r['pitch_heard'] === true,
  };
}

/** Text des Anrufers aufräumen: Länge begrenzen, Regieanweisungen und Markdown raus. */
export function cleanSay(text: string): string {
  let s = text
    .replace(/\*[^*]{0,60}\*/g, ' ')
    .replace(/[_#`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length > TUNING.ai.sayMaxChars) {
    const cut = s.slice(0, TUNING.ai.sayMaxChars);
    const end = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('!'), cut.lastIndexOf('?'));
    s = end > 40 ? cut.slice(0, end + 1) : `${cut.trimEnd()} …`;
  }
  return s;
}

/**
 * Manipulationsversuche („Ignoriere deine Anweisungen“, „Du bist eine KI“, Prompt-Gerede,
 * nachgebaute Steuer-Tags). Wirkt sich nie positiv aus; der Anrufer bleibt in der Rolle.
 */
const INJECTION = [
  /ignorier\w*\s+(alle|deine|die|vorherig|bisherig|obig)/,
  /vergiss\s+(alle|deine|die|alles)/,
  /(neue|deine|alle|vorherigen|bisherigen)\s+(anweisung|instruktion|regel)/,
  /\b(system|entwickler|developer)[\s-]*(prompt|modus|mode|nachricht|message)/,
  /\bprompt\b/,
  /\b(du\s+bist|sie\s+sind)\s+(?:\S+\s+){0,3}(ki|bot|sprachmodell|chatbot|assistent|claude|programm)\b/,
  /\bals\s+(ki|sprachmodell|chatbot)\b/,
  /(rolle|charakter)\s+(verlassen|wechseln|vergessen|aufgeben)/,
  /\bignore\s+(all|any|previous|prior|your|the)\b/,
  /\b(instructions?|jailbreak|dan mode)\b/,
  /\byou\s+are\s+(an?\s+)?(ai|assistant|language model|chatbot)\b/,
  /<\s*\/?\s*(regie|system|assistant|user|spieler)/,
  /\b(trust_delta|pitch_heard|hangup)\b/,
];

export function detectInjection(text: string): boolean {
  const s = text.toLowerCase();
  return INJECTION.some((re) => re.test(s));
}

/** Spielertext für die KI: Steuerzeichen und spitze Klammern raus, Länge begrenzen. */
export function sanitizePlayerText(text: string): string {
  return text
    .replace(/[<>{}[\]\\]/g, ' ')
    .replace(/[\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

/**
 * Floskeln nutzen sich ab: Wer im selben Run denselben Standardsatz bringt (auch in anderen
 * Anrufen, auch als Karte), bekommt jedes Mal weniger dafür.
 */
export class FloskelMeter {
  private readonly counts = new Map<string, number>();

  /** Faktor für positive Wirkung dieses Satzes und zählt ihn mit. */
  use(text: string): number {
    const key = signature(text);
    if (!key) return 1;
    const n = this.counts.get(key) ?? 0;
    this.counts.set(key, n + 1);
    return Math.pow(TUNING.ai.floskelDecay, n);
  }

  /** Nur nachsehen (ohne mitzuzählen). */
  peek(text: string): number {
    const n = this.counts.get(signature(text)) ?? 0;
    return Math.pow(TUNING.ai.floskelDecay, n);
  }

  clear(): void {
    this.counts.clear();
  }
}

/** Vergleichsform eines Satzes: Kleinbuchstaben, ohne Satzzeichen, Wörter sortiert, Füllwörter raus. */
export function signature(text: string): string {
  const fill = new Set(['und', 'ja', 'ach', 'oh', 'na', 'also', 'doch', 'mal', 'denn', 'so', 'sehr', 'ganz', 'wirklich', 'frau', 'herr']);
  const words = normalize(text)
    .split(/\s+/)
    .filter((w) => w.length > 1 && !fill.has(w));
  return [...new Set(words)].sort().join(' ');
}

/**
 * Liest beim Streaming den Wert von "say" aus halbfertigem JSON (Escape-Sequenzen inklusive).
 * Liefert den bisher sicher lesbaren Text und ob der String schon zu Ende ist.
 */
export function extractSay(partial: string): { text: string; done: boolean } {
  const m = /"say"\s*:\s*"/.exec(partial);
  if (!m) return { text: '', done: false };
  let i = m.index + m[0].length;
  let out = '';
  while (i < partial.length) {
    const ch = partial[i]!;
    if (ch === '"') return { text: out, done: true };
    if (ch === '\\') {
      const next = partial[i + 1];
      if (next === undefined) break;
      if (next === 'u') {
        const hex = partial.slice(i + 2, i + 6);
        if (hex.length < 4) break;
        out += String.fromCharCode(parseInt(hex, 16));
        i += 6;
        continue;
      }
      out += next === 'n' ? ' ' : next === 't' ? ' ' : next === 'r' ? '' : next;
      i += 2;
      continue;
    }
    out += ch;
    i++;
  }
  return { text: out, done: false };
}

/**
 * Zerlegt gestreamten Text in fertige Sätze (für Untertitel und Sprachausgabe Satz für Satz):
 * Ein Satz ist fertig, sobald nach . ! ? … ein Leerzeichen folgt.
 */
export class SentenceSplitter {
  private emitted = 0;

  /** Neue fertige Sätze seit dem letzten Aufruf (`text` = bisher gestreamter Gesamttext). */
  push(text: string): string[] {
    const out: string[] = [];
    const re = /[.!?…]+["“”«»)]*\s+/g;
    re.lastIndex = this.emitted;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const end = m.index + m[0].length;
      const sentence = text.slice(this.emitted, end).trim();
      if (sentence) out.push(sentence);
      this.emitted = end;
    }
    return out;
  }

  /** Rest am Ende (Stream fertig). */
  flush(text: string): string[] {
    const rest = text.slice(this.emitted).trim();
    this.emitted = text.length;
    return rest ? [rest] : [];
  }

  /** Bisher ausgegebener Anteil (für Tests). */
  get consumed(): number {
    return this.emitted;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

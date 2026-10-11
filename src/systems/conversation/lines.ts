import type { Params } from '../../i18n/i18n';
import type { Rng } from '../rng/rng';
import type { LineRef } from './engine';

/** Allgemeine Zeile, wenn eine Masche für eine Situation keine eigene hat. */
const SCHEME_FALLBACK: Readonly<Record<string, string>> = { why: 'demand.why', done: 'end.success' };

/** Woher die Texte kommen (i18n; in Tests austauschbar). */
export interface LineSource {
  list(key: string): string[];
  t(key: string, params?: Params): string;
  has(key: string): boolean;
  format(text: string, params: Params): string;
}

/**
 * Macht aus einer Situation (z. B. „react.compliment.pos“) den Text, den der Anrufer sagt.
 * Reihenfolge: figurenspezifisch (callers.<id>.like.<thema> bzw. callers.<id>.lines.<situation>),
 * dann allgemein (calls.lines.<situation>). Varianten werden ohne Wiederholung gezogen.
 */
export class LinePicker {
  private readonly used = new Map<string, Set<number>>();

  constructor(
    private readonly callerId: string,
    private readonly rng: Rng,
    private readonly src: LineSource,
  ) {}

  /** Text zu einer Zeile (leer, wenn es dafür keinen Text gibt). */
  text(ref: LineRef): string {
    const key = this.resolve(ref);
    if (!key) return '';
    const variants = this.src.list(key);
    const used = this.used.get(key) ?? new Set<number>();
    if (used.size >= variants.length) used.clear();
    const free = variants.map((_, i) => i).filter((i) => !used.has(i));
    const idx = free[this.rng.int(0, free.length - 1)] ?? 0;
    used.add(idx);
    this.used.set(key, used);
    return this.src.format(variants[idx] ?? '', this.params(ref));
  }

  /** Schlüssel, unter dem Varianten für diese Zeile stehen (für Tests). */
  resolve(ref: LineRef): string | null {
    const s = ref.situation;
    const topic = ref.params?.['topic'];
    const candidates: string[] = [];
    if (s.startsWith('scheme.')) {
      // Maschen-Reaktionen: erst die Zeilen der Masche, dann allgemeine.
      const rest = s.slice('scheme.'.length);
      const scheme = ref.params?.['scheme'];
      if (typeof scheme === 'string') candidates.push(`schemes.${scheme}.lines.${rest}`);
      candidates.push(`calls.lines.${SCHEME_FALLBACK[rest] ?? rest}`);
      for (const c of candidates) if (this.src.list(c).length > 0) return c;
      return null;
    }
    if (topic !== undefined && (s === 'topic.like' || s === 'topic.dislike')) candidates.push(`callers.${this.callerId}.${s === 'topic.like' ? 'like' : 'dislike'}.${topic}`);
    candidates.push(`callers.${this.callerId}.lines.${s}`, `calls.lines.${s}`);
    // Situationen mit Unterfällen (z. B. react.urgency.pos) fallen auf die allgemeine Form zurück.
    const parent = s.replace(/\.(pos|neg)$/, '');
    if (parent !== s) candidates.push(`callers.${this.callerId}.lines.${parent}`, `calls.lines.${parent}`);
    for (const c of candidates) if (this.src.list(c).length > 0) return c;
    return null;
  }

  private params(ref: LineRef): Params {
    const p: Params = { caller: this.src.t(`callers.${this.callerId}.short`) };
    const raw = ref.params ?? {};
    for (const [k, v] of Object.entries(raw)) p[k] = v;
    const role = raw['role'];
    const newRole = raw['newRole'];
    if (typeof role === 'string') p['roleFrom'] = this.src.t(`calls.roles.${role}.from`);
    if (typeof newRole === 'string') p['newRoleFrom'] = this.src.t(`calls.roles.${newRole}.from`);
    if (typeof raw['topic'] === 'string') p['topic'] = this.src.t(`calls.topics.${raw['topic']}`);
    if (typeof raw['demand'] === 'string') p['demand'] = this.src.t(`calls.demands.${raw['demand']}`);
    return p;
  }
}

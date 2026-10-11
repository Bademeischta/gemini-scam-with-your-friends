import type { Reply } from '../conversation/engine';
import type { Topic } from '../conversation/types';
import type { DossierSnap } from '../save/schemas';

export interface DossierEntry {
  /** Wie oft schon am Telefon gehabt. */
  calls: number;
  /** Erkannte Vorlieben und Abneigungen (aus Reaktionen im Gespräch). */
  likes: Set<Topic>;
  dislikes: Set<Topic>;
  /** Maschen, die gezogen bzw. nicht gezogen haben. */
  fans: Set<string>;
  skeptics: Set<string>;
  /** Höchstes erreichtes Vertrauen (%). */
  best: number;
  /** Erfolgreiche Anrufe. */
  wins: number;
}

/**
 * Kundenkartei-Wissen (APP-03): Was man über Anrufer herausgefunden hat. Füllt sich aus den Reaktionen
 * im Gespräch (freut sich über Katzen, ärgert sich über Krypto, findet die Mond-Geschichte toll …).
 */
export class Dossier {
  private readonly map = new Map<string, DossierEntry>();
  private readonly listeners = new Set<() => void>();

  get(callerId: string): DossierEntry | undefined {
    return this.map.get(callerId);
  }

  /** Für den Spielstand (Kundenkartei-Wissen bleibt über die Tage erhalten). */
  snapshot(): Record<string, DossierSnap> {
    const out: Record<string, DossierSnap> = {};
    for (const [id, e] of this.map) out[id] = { calls: e.calls, likes: [...e.likes], dislikes: [...e.dislikes], fans: [...e.fans], skeptics: [...e.skeptics], best: e.best, wins: e.wins };
    return out;
  }

  restore(snap: Readonly<Record<string, DossierSnap>>): void {
    this.map.clear();
    for (const [id, e] of Object.entries(snap)) {
      this.map.set(id, { calls: e.calls, likes: new Set(e.likes as Topic[]), dislikes: new Set(e.dislikes as Topic[]), fans: new Set(e.fans), skeptics: new Set(e.skeptics), best: e.best, wins: e.wins });
    }
    this.emit();
  }

  /** Alle bekannten Anrufer (in der Reihenfolge des ersten Anrufs). */
  ids(): string[] {
    return [...this.map.keys()];
  }

  met(callerId: string): void {
    this.entry(callerId).calls++;
    this.emit();
  }

  /** Antwort des Anrufers auswerten. */
  observe(callerId: string, reply: Reply): void {
    const e = this.entry(callerId);
    let changed = false;
    for (const l of reply.lines) {
      const topic = l.params?.['topic'];
      const scheme = l.params?.['scheme'];
      if (l.situation === 'topic.like' && typeof topic === 'string') changed = add(e.likes, topic as Topic) || changed;
      if (l.situation === 'topic.dislike' && typeof topic === 'string') changed = add(e.dislikes, topic as Topic) || changed;
      if (l.situation === 'scheme.pitch.pos' && typeof scheme === 'string') changed = add(e.fans, scheme) || changed;
      if (l.situation === 'scheme.pitch.neg' && typeof scheme === 'string') changed = add(e.skeptics, scheme) || changed;
    }
    // Auch wenn eine andere Reaktion lauter war: Worauf der Anrufer angesprungen ist, merkt man sich.
    for (const topic of reply.learned?.likes ?? []) changed = add(e.likes, topic) || changed;
    for (const topic of reply.learned?.dislikes ?? []) changed = add(e.dislikes, topic) || changed;
    if (reply.trust > e.best) {
      e.best = reply.trust;
      changed = true;
    }
    if (changed) this.emit();
  }

  win(callerId: string): void {
    this.entry(callerId).wins++;
    this.emit();
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private entry(id: string): DossierEntry {
    let e = this.map.get(id);
    if (!e) {
      e = { calls: 0, likes: new Set(), dislikes: new Set(), fans: new Set(), skeptics: new Set(), best: 0, wins: 0 };
      this.map.set(id, e);
    }
    return e;
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }
}

function add<T>(set: Set<T>, v: T): boolean {
  if (set.has(v)) return false;
  set.add(v);
  return true;
}

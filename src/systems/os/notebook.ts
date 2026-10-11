/** Eine Notiz im Notizblock (APP-08). */
export interface Note {
  id: number;
  text: string;
  /** Automatisch aus einem Gespräch erfasst (Anrufer-ID), sonst eigene Notiz (null). */
  from: string | null;
  /** Spielzeit (s) beim Anlegen, für die Sortierung. */
  time: number;
}

/** Notizblock des Arbeitsplatz-PCs: eigene Notizen und automatisch erfasste Beute aus Gesprächen. */
export class Notebook {
  private items: Note[] = [];
  private nextId = 1;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly max = 60) {}

  /** Neueste zuerst. */
  get notes(): readonly Note[] {
    return this.items;
  }

  add(text: string, from: string | null, time = 0): Note | null {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (!clean) return null;
    // Dieselbe erfasste Beute nicht doppelt notieren.
    if (from !== null && this.items.some((n) => n.from === from && n.text === clean)) return null;
    const note: Note = { id: this.nextId++, text: clean, from, time };
    this.items.unshift(note);
    if (this.items.length > this.max) this.items.length = this.max;
    this.emit();
    return note;
  }

  remove(id: number): void {
    const before = this.items.length;
    this.items = this.items.filter((n) => n.id !== id);
    if (this.items.length !== before) this.emit();
  }

  clear(): void {
    if (this.items.length === 0) return;
    this.items = [];
    this.emit();
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }
}

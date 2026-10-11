import { TUNING } from '../../config/tuning';
import type { Rng } from '../rng/rng';

export interface ChatMessage {
  from: 'them' | 'me';
  text: string;
}

export interface Chat {
  handle: string;
  messages: ChatMessage[];
  unread: number;
}

/**
 * Zustand der Plauderbude (APP-05): Chats mit „Freunden“, die regelmäßig Kettenbriefe und Katzenbilder
 * schicken, solange man am PC sitzt, plus ein Chat je Anrufer (Turbo-Geschenk). Phaser-frei.
 */
export class Plauder {
  private readonly list: Chat[] = [];
  private readonly listeners = new Set<() => void>();
  private wait: number;
  /** Benachrichtigungen aus (Nachrichten kommen trotzdem an). */
  muted = false;

  constructor(
    private readonly rng: Rng,
    private readonly friends: readonly string[],
    private readonly spam: () => readonly string[],
  ) {
    this.wait = this.nextWait();
    // Jeder Freund hat schon etwas geschickt (sonst wirkt die App leer).
    for (const f of friends) this.chat(f).messages.push({ from: 'them', text: this.pickSpam() });
  }

  get chats(): readonly Chat[] {
    return this.list;
  }

  /** Chat zu einem Handle (wird bei Bedarf angelegt). */
  chat(handle: string): Chat {
    let c = this.list.find((x) => x.handle === handle);
    if (!c) {
      c = { handle, messages: [], unread: 0 };
      this.list.push(c);
    }
    return c;
  }

  add(handle: string, msg: ChatMessage): Chat {
    const c = this.chat(handle);
    c.messages.push(msg);
    if (c.messages.length > TUNING.plauder.keep) c.messages.splice(0, c.messages.length - TUNING.plauder.keep);
    if (msg.from === 'them') c.unread++;
    this.emit();
    return c;
  }

  read(handle: string): void {
    const c = this.list.find((x) => x.handle === handle);
    if (!c || c.unread === 0) return;
    c.unread = 0;
    this.emit();
  }

  /** Zeit am PC: Ab und zu meldet sich ein Freund. Liefert den Chat mit der neuen Nachricht. */
  tick(dt: number): Chat | null {
    this.wait -= dt;
    if (this.wait > 0 || this.friends.length === 0) return null;
    this.wait = this.nextWait();
    return this.add(this.rng.pick(this.friends), { from: 'them', text: this.pickSpam() });
  }

  setMuted(on: boolean): void {
    this.muted = on;
    this.emit();
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private pickSpam(): string {
    const all = this.spam();
    return all.length > 0 ? this.rng.pick(all) : '';
  }

  private nextWait(): number {
    const [lo, hi] = TUNING.plauder.spamEvery;
    return this.rng.range(lo, hi);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }
}

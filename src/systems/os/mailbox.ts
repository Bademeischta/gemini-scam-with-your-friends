/** Absender einer Mail im Postfach (APP-07). */
export type MailFrom = 'boss' | 'system' | 'spam';

export interface Mail {
  id: number;
  from: MailFrom;
  /** i18n-Schlüssel für Betreff und Text; Platzhalter in `params`. */
  subject: string;
  body: string;
  params: Record<string, string | number>;
  read: boolean;
}

/** Postfach des Arbeitsplatz-PCs: Chef-Mails, Freischaltungen, Spam. Neueste zuerst. */
export class Mailbox {
  private items: Mail[] = [];
  private nextId = 1;
  private readonly listeners = new Set<() => void>();

  get mails(): readonly Mail[] {
    return this.items;
  }

  get unread(): number {
    return this.items.filter((m) => !m.read).length;
  }

  add(from: MailFrom, subject: string, body: string, params: Record<string, string | number> = {}): Mail {
    const mail: Mail = { id: this.nextId++, from, subject, body, params, read: false };
    this.items.unshift(mail);
    this.emit();
    return mail;
  }

  markRead(id: number): void {
    const m = this.items.find((x) => x.id === id);
    if (!m || m.read) return;
    m.read = true;
    this.emit();
  }

  remove(id: number): void {
    const before = this.items.length;
    this.items = this.items.filter((m) => m.id !== id);
    if (this.items.length !== before) this.emit();
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }
}

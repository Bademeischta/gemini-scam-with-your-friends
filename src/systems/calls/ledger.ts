import { DEFAULT_SCHEME_FOR, type SchemeInput } from '../../data/schemes';
import type { DemandKind } from '../conversation/types';

/** Ein erbeuteter Wert, der noch in die richtige App eingegeben werden muss (SCH-19/20). */
export interface LootItem {
  id: number;
  callId: number;
  desk: number;
  callerId: string;
  schemeId: string;
  kind: DemandKind;
  value: string;
  /** Auszahlung in ₮ (beim FernGucker erst nach der Überweisung bekannt: 0). */
  amount: number;
  input: SchemeInput;
  status: 'pending' | 'paid' | 'failed';
  attempts: number;
  /** Von einem Köder: sieht echt aus, ist aber wertlos. */
  bait?: boolean;
}

export type SubmitResult =
  | { ok: true; item: LootItem }
  | { ok: false; reason: 'empty' | 'unknown' | 'locked' | 'bait'; item?: LootItem; attemptsLeft?: number };

/** Vergleichbare Form einer Eingabe: Groß, ohne Leer- und Trennzeichen („sv 49-18 45“ = „SV491845“). */
export function normalizeCode(text: string): string {
  return text.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Beute-Hauptbuch: Was Anrufer verraten haben, wartet hier auf die Eingabe in Ident-o-Mat, FernGucker,
 * Gutschein-Kasse, Plauderbude oder die Skript-App der Masche. Richtig eingegeben → Auszahlung,
 * dreimal falsch → die Masche scheitert (SCH-20).
 */
export class LootLedger {
  private list: LootItem[] = [];
  private nextId = 1;
  private readonly listeners = new Set<() => void>();
  private readonly paidListeners = new Set<(item: LootItem) => void>();

  constructor(private readonly maxAttempts = 3) {}

  get items(): readonly LootItem[] {
    return this.list;
  }

  /** Neue Beute eintragen (ohne Masche: Standard-Masche ihrer Art, sonst nicht verwertbar → null). */
  add(entry: Omit<LootItem, 'id' | 'status' | 'attempts' | 'schemeId' | 'input'> & { schemeId: string | null; input: SchemeInput | null }): LootItem | null {
    const schemeId = entry.schemeId ?? DEFAULT_SCHEME_FOR[entry.kind] ?? null;
    if (!schemeId || !entry.input) return null;
    const item: LootItem = { ...entry, schemeId, input: entry.input, id: this.nextId++, status: 'pending', attempts: 0 };
    this.list.push(item);
    this.emit();
    if (item.input === 'auto') this.pay(item, item.amount);
    return item;
  }

  pending(input: SchemeInput, schemeId?: string): LootItem[] {
    return this.list.filter((i) => i.status === 'pending' && i.input === input && (schemeId === undefined || i.schemeId === schemeId));
  }

  /** Eingabe prüfen. Passt sie zu wartender Beute dieser App, wird sie (außer beim FernGucker) ausgezahlt. */
  submit(input: SchemeInput, text: string, schemeId?: string): SubmitResult {
    const code = normalizeCode(text);
    if (!code) return { ok: false, reason: 'empty' };
    const open = this.pending(input, schemeId);
    const hit = open.find((i) => normalizeCode(i.value) === code);
    if (hit?.bait) {
      // Köder-Beute fliegt beim Prüfen auf.
      hit.status = 'failed';
      this.emit();
      return { ok: false, reason: 'bait', item: hit };
    }
    if (hit) {
      // Der FernGucker zahlt erst nach der Überweisung auf dem Opfer-PC.
      if (input !== 'ferngucker') this.pay(hit, hit.amount);
      return { ok: true, item: hit };
    }
    // Vertippt: Die jüngste wartende (echte) Beute dieser App verbraucht einen Versuch.
    const target = open.filter((i) => !i.bait).pop();
    if (!target) return { ok: false, reason: 'unknown' };
    target.attempts++;
    if (target.attempts >= this.maxAttempts) {
      target.status = 'failed';
      this.emit();
      return { ok: false, reason: 'locked', item: target, attemptsLeft: 0 };
    }
    this.emit();
    return { ok: false, reason: 'unknown', item: target, attemptsLeft: this.maxAttempts - target.attempts };
  }

  /** Auszahlen (FernGucker: Betrag der Überweisung). */
  pay(item: LootItem, amount: number): void {
    if (item.status !== 'pending') return;
    item.status = 'paid';
    item.amount = Math.max(0, Math.round(amount));
    this.emit();
    for (const fn of this.paidListeners) fn(item);
  }

  /** Gescheitert (z. B. Anrufer hat beim Fernzugriff aufgelegt). */
  fail(item: LootItem): void {
    if (item.status !== 'pending') return;
    item.status = 'failed';
    this.emit();
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  onPaid(fn: (item: LootItem) => void): () => void {
    this.paidListeners.add(fn);
    return () => this.paidListeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }
}

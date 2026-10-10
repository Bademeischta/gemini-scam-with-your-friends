/**
 * Verwaltet Pausen-Gründe. Das Spiel ist pausiert, solange mindestens ein Grund aktiv ist.
 * Gründe: 'background' (Tab/App im Hintergrund), 'blur' (Fenster ohne Fokus), 'menu' (Pausenmenü), …
 */
export type PauseReason = 'background' | 'blur' | 'menu' | 'orientation';

export class PauseController {
  private readonly reasons = new Set<PauseReason>();
  private readonly listeners = new Set<(paused: boolean, reasons: ReadonlySet<PauseReason>) => void>();

  get paused(): boolean {
    return this.reasons.size > 0;
  }

  get activeReasons(): ReadonlySet<PauseReason> {
    return this.reasons;
  }

  has(reason: PauseReason): boolean {
    return this.reasons.has(reason);
  }

  add(reason: PauseReason): void {
    if (this.reasons.has(reason)) return;
    const was = this.paused;
    this.reasons.add(reason);
    if (!was) this.emit();
  }

  remove(reason: PauseReason): void {
    if (!this.reasons.delete(reason)) return;
    if (!this.paused) this.emit();
  }

  /** Ruft `fn(paused, reasons)` bei jedem Wechsel zwischen pausiert/laufend auf. */
  onChange(fn: (paused: boolean, reasons: ReadonlySet<PauseReason>) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn(this.paused, this.reasons);
  }
}

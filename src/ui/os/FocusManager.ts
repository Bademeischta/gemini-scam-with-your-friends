import Phaser from 'phaser';
import { hex } from '../../config/palette';
import { pickInDirection, type NavDir, type Rect } from './focusNav';

export interface Focusable {
  id: string;
  /** Aktuelles Bildschirm-Rechteck (physische Pixel). */
  rect(): Rect;
  activate(): void;
  /** Bereich, z. B. 'desktop', 'taskbar', 'win:calc', 'start'. */
  scope: string;
  enabled?(): boolean;
  /**
   * Eigene Navigation innerhalb des Elements (Schieberegler links/rechts, Liste hoch/runter).
   * true = verarbeitet, der Fokus bleibt; false = Fokus wandert weiter.
   */
  navigate?(dir: NavDir): boolean;
  /** Kontextmenü (Gamepad Y / Taste G statt Rechtsklick). */
  context?(): void;
}

/**
 * Fokus für Tastatur und Gamepad. Elemente melden sich an und ab; die Navigation springt
 * innerhalb der erlaubten Bereiche (z. B. nur im offenen Startmenü).
 */
export class FocusManager {
  private readonly items: Focusable[] = [];
  private current: Focusable | null = null;
  private allowed: ((scope: string) => boolean) | null = null;
  private readonly ring: Phaser.GameObjects.Graphics;
  private showRing = false;
  private unit = 2;

  constructor(scene: Phaser.Scene, depth: number) {
    this.ring = scene.add.graphics().setDepth(depth);
  }

  get focusedId(): string | null {
    return this.current?.id ?? null;
  }

  setUnit(u: number): void {
    this.unit = u;
  }

  register(f: Focusable): () => void {
    this.items.push(f);
    return () => {
      const i = this.items.indexOf(f);
      if (i >= 0) this.items.splice(i, 1);
      if (this.current === f) this.current = null;
    };
  }

  /** Nur Bereiche, für die `filter` true liefert, sind erreichbar (null = alle). */
  restrict(filter: ((scope: string) => boolean) | null): void {
    this.allowed = filter;
    if (this.current && !this.isAvailable(this.current)) this.current = null;
  }

  setRingVisible(on: boolean): void {
    this.showRing = on;
  }

  focus(id: string): boolean {
    const f = this.items.find((i) => i.id === id && this.isAvailable(i));
    if (!f) return false;
    this.current = f;
    return true;
  }

  /** Fokus auf das erste Element eines Bereichs. */
  focusScope(scope: string): boolean {
    const f = this.items.find((i) => i.scope === scope && this.isAvailable(i));
    if (!f) return false;
    this.current = f;
    return true;
  }

  move(dir: NavDir): boolean {
    const avail = this.items.filter((i) => this.isAvailable(i));
    if (avail.length === 0) return false;
    if (!this.current || !this.isAvailable(this.current)) {
      this.current = avail[0]!;
      return true;
    }
    if (this.current.navigate?.(dir)) return true;
    const others = avail.filter((i) => i !== this.current);
    const idx = pickInDirection(this.current.rect(), others.map((o) => o.rect()), dir);
    if (idx < 0) return false;
    this.current = others[idx]!;
    return true;
  }

  activate(): boolean {
    if (!this.current || !this.isAvailable(this.current)) return false;
    this.current.activate();
    return true;
  }

  /** Kontextmenü des fokussierten Elements öffnen (falls es eines hat). */
  context(): boolean {
    if (!this.current?.context || !this.isAvailable(this.current)) return false;
    this.current.context();
    return true;
  }

  /** Fokussiertes Element ist noch gültig? Sonst null. */
  get currentScope(): string | null {
    return this.current && this.isAvailable(this.current) ? this.current.scope : null;
  }

  /** Alle angemeldeten, aktivierbaren Elemente unabhängig von der Bereichs-Einschränkung (für Tests). */
  all(): { id: string; scope: string; rect: Rect }[] {
    return this.items.filter((i) => (i.enabled ? i.enabled() : true)).map((i) => ({ id: i.id, scope: i.scope, rect: i.rect() }));
  }

  /** Alle verfügbaren Elemente mit Rechteck (für Tests). */
  snapshot(): { id: string; rect: Rect }[] {
    return this.items.filter((i) => this.isAvailable(i)).map((i) => ({ id: i.id, rect: i.rect() }));
  }

  draw(): void {
    const g = this.ring;
    g.clear();
    if (!this.showRing || !this.current || !this.isAvailable(this.current)) return;
    const r = this.current.rect();
    const u = this.unit;
    g.lineStyle(u, hex('mustard'), 1).strokeRect(r.x - u, r.y - u, r.w + 2 * u, r.h + 2 * u);
    g.lineStyle(u, hex('ink0'), 1).strokeRect(r.x - 2 * u, r.y - 2 * u, r.w + 4 * u, r.h + 4 * u);
  }

  private isAvailable(f: Focusable): boolean {
    if (this.allowed && !this.allowed(f.scope)) return false;
    return f.enabled ? f.enabled() : true;
  }
}

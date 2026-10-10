import { computeViewport, parsePx, type Insets, type ViewportState } from './viewportMath';

/**
 * Beobachtet Fenstergröße, Pixeldichte und Safe Areas (Notch, Home-Indicator).
 * Die Safe Area wird über ein unsichtbares Element mit `padding: env(safe-area-inset-*)` gemessen.
 */
export class Viewport {
  private _state: ViewportState;
  private readonly listeners = new Set<(s: ViewportState) => void>();
  private rafId = 0;
  private dprQuery: MediaQueryList | null = null;
  private readonly onDprChange = (): void => this.schedule();

  constructor(
    private readonly win: Window,
    private readonly probe: HTMLElement | null,
    private readonly maxDpr: number,
  ) {
    this._state = this.measure();
    const schedule = (): void => this.schedule();
    win.addEventListener('resize', schedule);
    win.addEventListener('orientationchange', schedule);
    win.visualViewport?.addEventListener('resize', schedule);
    this.watchDpr();
  }

  get state(): ViewportState {
    return this._state;
  }

  onChange(fn: (s: ViewportState) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Sofort neu messen (z. B. nach Vollbild-Wechsel). */
  refresh(): void {
    const next = this.measure();
    const s = this._state;
    const changed =
      next.width !== s.width ||
      next.height !== s.height ||
      next.dpr !== s.dpr ||
      next.safe.top !== s.safe.top ||
      next.safe.right !== s.safe.right ||
      next.safe.bottom !== s.safe.bottom ||
      next.safe.left !== s.safe.left;
    this._state = next;
    if (changed) for (const fn of this.listeners) fn(next);
  }

  private schedule(): void {
    if (this.rafId) return;
    this.rafId = this.win.requestAnimationFrame(() => {
      this.rafId = 0;
      this.watchDpr();
      this.refresh();
    });
  }

  private watchDpr(): void {
    // Pixeldichte ändert sich beim Zoomen oder Verschieben auf einen anderen Monitor.
    this.dprQuery?.removeEventListener('change', this.onDprChange);
    try {
      this.dprQuery = this.win.matchMedia(`(resolution: ${this.win.devicePixelRatio || 1}dppx)`);
      this.dprQuery.addEventListener('change', this.onDprChange);
    } catch {
      this.dprQuery = null;
    }
  }

  private measure(): ViewportState {
    const doc = this.win.document.documentElement;
    const cssW = this.win.innerWidth || doc.clientWidth;
    const cssH = this.win.innerHeight || doc.clientHeight;
    return computeViewport(cssW, cssH, this.win.devicePixelRatio || 1, this.maxDpr, this.readSafe());
  }

  private readSafe(): Insets {
    if (!this.probe) return { top: 0, right: 0, bottom: 0, left: 0 };
    const cs = this.win.getComputedStyle(this.probe);
    return {
      top: parsePx(cs.paddingTop),
      right: parsePx(cs.paddingRight),
      bottom: parsePx(cs.paddingBottom),
      left: parsePx(cs.paddingLeft),
    };
  }
}

/**
 * Geräte-Erkennung: Touch oder Desktop (Maus/Tastatur) oder Gamepad, plus Formfaktor.
 * Erst-Erkennung über Media-Queries, Touch-Punkte und Bildschirmgröße;
 * danach Wechsel zur Laufzeit anhand des zuletzt benutzten Geräts.
 */
export type InputKind = 'touch' | 'mouse' | 'keyboard' | 'gamepad';
export type HintMode = 'touch' | 'desktop' | 'gamepad';
export type FormFactor = 'phone' | 'tablet' | 'desktop';

export interface DeviceEnv {
  /** Primärer Zeiger ist grob (Finger): `(pointer: coarse)`. */
  coarsePointer: boolean;
  /** Irgendein feiner Zeiger vorhanden: `(any-pointer: fine)`. */
  anyFinePointer: boolean;
  /** Primärer Zeiger kann hovern: `(hover: hover)`. */
  hover: boolean;
  maxTouchPoints: number;
  /** Kürzere und längere Bildschirmseite in CSS-px (orientierungsunabhängig). */
  screenShort: number;
  screenLong: number;
}

export function readDeviceEnv(win: Window): DeviceEnv {
  const mq = (q: string): boolean => {
    try {
      return win.matchMedia(q).matches;
    } catch {
      return false;
    }
  };
  const w = win.screen?.width || win.innerWidth;
  const h = win.screen?.height || win.innerHeight;
  return {
    coarsePointer: mq('(pointer: coarse)'),
    anyFinePointer: mq('(any-pointer: fine)'),
    hover: mq('(hover: hover)'),
    maxTouchPoints: win.navigator?.maxTouchPoints ?? 0,
    screenShort: Math.min(w, h),
    screenLong: Math.max(w, h),
  };
}

/** Ist das Gerät in erster Linie ein Touch-Gerät? */
export function isTouchPrimary(env: DeviceEnv): boolean {
  if (env.coarsePointer) return true;
  // Manche Browser melden keinen groben Zeiger, haben aber Touch und kein Hover (ältere Android-WebViews).
  return env.maxTouchPoints > 0 && !env.hover && !env.anyFinePointer;
}

export function detectFormFactor(env: DeviceEnv, tabletMinShortSide: number): FormFactor {
  if (!isTouchPrimary(env)) return 'desktop';
  return env.screenShort < tabletMinShortSide ? 'phone' : 'tablet';
}

export function detectInitialKind(env: DeviceEnv): InputKind {
  return isTouchPrimary(env) ? 'touch' : 'mouse';
}

export function hintModeFor(kind: InputKind): HintMode {
  switch (kind) {
    case 'touch':
      return 'touch';
    case 'gamepad':
      return 'gamepad';
    case 'mouse':
    case 'keyboard':
      return 'desktop';
  }
}

/** Verfolgt das zuletzt benutzte Eingabegerät und meldet Wechsel des Hinweis-Modus. */
export class DeviceTracker {
  private _kind: InputKind;
  readonly formFactor: FormFactor;
  private readonly listeners = new Set<(mode: HintMode, kind: InputKind) => void>();

  constructor(initialKind: InputKind, formFactor: FormFactor) {
    this._kind = initialKind;
    this.formFactor = formFactor;
  }

  get kind(): InputKind {
    return this._kind;
  }

  get hintMode(): HintMode {
    return hintModeFor(this._kind);
  }

  /** Meldet die Benutzung eines Geräts. Löst nur bei Wechsel des Hinweis-Modus ein Ereignis aus. */
  report(kind: InputKind): void {
    if (kind === this._kind) return;
    const before = this.hintMode;
    this._kind = kind;
    if (this.hintMode !== before) for (const fn of this.listeners) fn(this.hintMode, kind);
  }

  onChange(fn: (mode: HintMode, kind: InputKind) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

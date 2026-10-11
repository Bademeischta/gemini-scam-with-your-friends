import { ACTIONS, type Action, type Bindings, type PadBinding } from './actions';
import type { DeviceTracker } from './device';

/** Benannte Tasten, die zusätzlich zu druckbaren Zeichen als Texteingabe zählen. */
const TYPED_KEYS = new Set(['Enter', 'Backspace', 'Delete']);

/** Minimal benötigte Gamepad-Form (testbar ohne Browser). */
export interface PadState {
  connected: boolean;
  mapping?: string;
  buttons: ReadonlyArray<{ pressed: boolean; value: number }>;
  axes: ReadonlyArray<number>;
}

export interface InputEnv {
  getGamepads: () => ReadonlyArray<PadState | null>;
}

export interface InputOptions {
  stickDeadzone: number;
}

/**
 * Vereinigt Tastatur und Gamepads zu Aktionen.
 * Pro Frame: `beginFrame()` (Gamepads abfragen, Flanken berechnen) → Spiel fragt ab → `endFrame()`.
 * Touch-Steuerelemente (Joystick, Buttons) speisen ab M1 über `setVirtual()` ein.
 */
export class InputManager {
  private bindings: Bindings;
  private readonly env: InputEnv;
  private readonly opts: InputOptions;
  private readonly tracker: DeviceTracker | undefined;

  private readonly keysDown = new Set<string>();
  private readonly keysPressedThisFrame = new Set<string>();
  /** Getippte Zeichen und Bearbeitungstasten dieses Frames (Texteingabe, z. B. Rechner). */
  private typedThisFrame: string[] = [];
  private readonly virtualDown = new Set<Action>();
  private readonly virtualPressed = new Set<Action>();

  private down = new Set<Action>();
  private prevDown = new Set<Action>();
  private readonly pressedNow = new Set<Action>();
  private readonly releasedNow = new Set<Action>();
  private anyPressed = false;
  private padAnyPrev = false;
  private _stick = { x: 0, y: 0 };
  private virtualStick = { x: 0, y: 0 };

  constructor(bindings: Bindings, env: InputEnv, opts: InputOptions, tracker?: DeviceTracker) {
    this.bindings = bindings;
    this.env = env;
    this.opts = opts;
    this.tracker = tracker;
  }

  setBindings(bindings: Bindings): void {
    this.bindings = bindings;
  }

  getBindings(): Bindings {
    return this.bindings;
  }

  // ---------- Ereignis-Eingang (von DOM-Listenern bzw. Tests) ----------

  /**
   * Rückgabe true = Taste gehört zu einer Aktion (Aufrufer kann preventDefault machen).
   * `key` (KeyboardEvent.key) speist die Texteingabe; mit Strg/Alt/Meta (Browser-Kürzel)
   * werden weder Aktionen noch Zeichen ausgelöst.
   */
  handleKeyDown(code: string, repeat: boolean, fromTextField = false, key?: string, modifier = false): boolean {
    if (fromTextField) return false;
    this.tracker?.report('keyboard');
    if (modifier) return false;
    if (key !== undefined && (key.length === 1 || TYPED_KEYS.has(key))) this.typedThisFrame.push(key);
    if (!repeat) {
      this.keysPressedThisFrame.add(code);
      this.anyPressed = true;
    }
    this.keysDown.add(code);
    return this.isBoundKey(code);
  }

  handleKeyUp(code: string): void {
    this.keysDown.delete(code);
  }

  /** Fenster verliert Fokus: alle Tasten loslassen, sonst „klemmen“ sie. */
  releaseAll(): void {
    this.keysDown.clear();
    this.virtualDown.clear();
    this.virtualStick = { x: 0, y: 0 };
  }

  /** Zeiger-Benutzung melden (für Geräte-Wechsel); `press` = Antippen/Klicken. */
  handlePointer(pointerType: string, press: boolean): void {
    this.tracker?.report(pointerType === 'mouse' ? 'mouse' : 'touch');
    if (press) this.anyPressed = true;
  }

  /** Virtuelle Steuerelemente (Touch-Buttons, Joystick). */
  setVirtual(action: Action, isDown: boolean): void {
    if (isDown) {
      if (!this.virtualDown.has(action)) this.virtualPressed.add(action);
      this.virtualDown.add(action);
    } else {
      this.virtualDown.delete(action);
    }
  }

  setVirtualStick(x: number, y: number): void {
    this.virtualStick = { x, y };
  }

  // ---------- Frame-Takt ----------

  beginFrame(): void {
    const next = new Set<Action>();
    let stickX = 0;
    let stickY = 0;
    let padActive = false;

    const pads = this.safePads();
    for (const pad of pads) {
      for (const action of ACTIONS) {
        if (this.bindings.pad[action].some((bnd) => this.padBindingDown(pad, bnd))) next.add(action);
      }
      const ax = pad.axes[0] ?? 0;
      const ay = pad.axes[1] ?? 0;
      if (Math.hypot(ax, ay) > this.opts.stickDeadzone) {
        stickX += ax;
        stickY += ay;
      }
      if (pad.buttons.some((btn) => btn.pressed) || pad.axes.some((a) => Math.abs(a) > this.opts.stickDeadzone)) {
        padActive = true;
      }
    }
    if (padActive) {
      this.tracker?.report('gamepad');
      if (!this.padAnyPrev) this.anyPressed = true;
    }
    this.padAnyPrev = padActive;

    for (const action of ACTIONS) {
      if (this.bindings.keys[action].some((code) => this.keysDown.has(code) || this.keysPressedThisFrame.has(code))) {
        next.add(action);
      }
      if (this.virtualDown.has(action) || this.virtualPressed.has(action)) next.add(action);
    }

    this.prevDown = this.down;
    this.down = next;
    this.pressedNow.clear();
    this.releasedNow.clear();
    for (const a of next) if (!this.prevDown.has(a)) this.pressedNow.add(a);
    // Kurz angetippte Tasten (Down+Up im selben Frame) zählen trotzdem als gedrückt.
    for (const action of ACTIONS) {
      if (this.bindings.keys[action].some((code) => this.keysPressedThisFrame.has(code))) this.pressedNow.add(action);
      if (this.virtualPressed.has(action)) this.pressedNow.add(action);
    }
    for (const a of this.prevDown) if (!next.has(a)) this.releasedNow.add(a);

    // Bewegungsvektor: Tastatur/Steuerkreuz digital, Sticks analog, Touch-Joystick analog.
    let mx = (next.has('moveRight') ? 1 : 0) - (next.has('moveLeft') ? 1 : 0);
    let my = (next.has('moveDown') ? 1 : 0) - (next.has('moveUp') ? 1 : 0);
    if (stickX !== 0 || stickY !== 0) {
      mx = stickX;
      my = stickY;
    }
    if (this.virtualStick.x !== 0 || this.virtualStick.y !== 0) {
      mx = this.virtualStick.x;
      my = this.virtualStick.y;
    }
    const len = Math.hypot(mx, my);
    this._stick = len > 1 ? { x: mx / len, y: my / len } : { x: mx, y: my };
  }

  endFrame(): void {
    this.keysPressedThisFrame.clear();
    this.typedThisFrame = [];
    this.virtualPressed.clear();
    this.anyPressed = false;
  }

  // ---------- Abfrage ----------

  isDown(action: Action): boolean {
    return this.down.has(action);
  }

  justPressed(action: Action): boolean {
    return this.pressedNow.has(action);
  }

  justReleased(action: Action): boolean {
    return this.releasedNow.has(action);
  }

  /** Irgendeine Taste, ein Gamepad-Button oder ein Tippen in diesem Frame („Press Start“). */
  anyJustPressed(): boolean {
    return this.anyPressed;
  }

  /**
   * Texteingabe dieses Frames: druckbare Zeichen (KeyboardEvent.key) sowie Enter, Backspace und Delete.
   * Für Eingabefelder wie den Rechner; Spiel-Aktionen laufen weiter über `justPressed`.
   */
  typed(): readonly string[] {
    return this.typedThisFrame;
  }

  /** Bewegungsrichtung, Länge 0–1. */
  get move(): { x: number; y: number } {
    return this._stick;
  }

  // ---------- intern ----------

  private isBoundKey(code: string): boolean {
    return ACTIONS.some((a) => this.bindings.keys[a].includes(code));
  }

  private safePads(): PadState[] {
    try {
      return this.env.getGamepads().filter((p): p is PadState => !!p && p.connected);
    } catch {
      return [];
    }
  }

  private padBindingDown(pad: PadState, bnd: PadBinding): boolean {
    if ('button' in bnd) {
      const btn = pad.buttons[bnd.button];
      return !!btn && (btn.pressed || btn.value > 0.5);
    }
    const v = pad.axes[bnd.axis] ?? 0;
    return v * bnd.dir > Math.max(0.5, this.opts.stickDeadzone);
  }
}

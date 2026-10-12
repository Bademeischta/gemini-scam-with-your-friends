import { describe, expect, it } from 'vitest';
import { DEFAULT_BINDINGS, PAD } from '../../src/config/input-defaults';
import { ACTIONS } from '../../src/systems/input/actions';
import {
  DeviceTracker,
  detectFormFactor,
  detectInitialKind,
  hintModeFor,
  type DeviceEnv,
} from '../../src/systems/input/device';
import { InputManager, type PadState } from '../../src/systems/input/InputManager';
import { NavRepeat } from '../../src/systems/input/NavRepeat';

const env = (over: Partial<DeviceEnv>): DeviceEnv => ({
  coarsePointer: false,
  anyFinePointer: true,
  hover: true,
  maxTouchPoints: 0,
  screenShort: 1080,
  screenLong: 1920,
  ...over,
});

describe('Geräte-Erkennung', () => {
  it('Desktop mit Maus', () => {
    const e = env({});
    expect(detectInitialKind(e)).toBe('mouse');
    expect(detectFormFactor(e, 600)).toBe('desktop');
  });

  it('Handy (grober Zeiger, kleiner Bildschirm)', () => {
    const e = env({ coarsePointer: true, anyFinePointer: false, hover: false, maxTouchPoints: 5, screenShort: 412, screenLong: 915 });
    expect(detectInitialKind(e)).toBe('touch');
    expect(detectFormFactor(e, 600)).toBe('phone');
  });

  it('Tablet (grober Zeiger, große kurze Seite)', () => {
    const e = env({ coarsePointer: true, anyFinePointer: false, hover: false, maxTouchPoints: 5, screenShort: 744, screenLong: 1133 });
    expect(detectFormFactor(e, 600)).toBe('tablet');
  });

  it('Laptop mit Touchscreen bleibt Desktop', () => {
    const e = env({ maxTouchPoints: 10 });
    expect(detectInitialKind(e)).toBe('mouse');
    expect(detectFormFactor(e, 600)).toBe('desktop');
  });

  it('alte WebViews ohne pointer-Query, aber mit Touch und ohne Hover', () => {
    const e = env({ anyFinePointer: false, hover: false, maxTouchPoints: 5, screenShort: 360 });
    expect(detectInitialKind(e)).toBe('touch');
  });

  it('Hinweis-Modus und Laufzeit-Wechsel', () => {
    expect(hintModeFor('keyboard')).toBe('desktop');
    const tr = new DeviceTracker('touch', 'phone');
    const modes: string[] = [];
    tr.onChange((m) => modes.push(m));
    tr.report('mouse');
    tr.report('keyboard'); // gleicher Hinweis-Modus → kein Ereignis
    tr.report('gamepad');
    tr.report('touch');
    expect(modes).toEqual(['desktop', 'gamepad', 'touch']);
    expect(tr.formFactor).toBe('phone');
  });
});

function pad(): PadState & { buttons: { pressed: boolean; value: number }[]; axes: number[] } {
  return { connected: true, mapping: 'standard', buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] };
}

describe('InputManager', () => {
  it('jede Aktion hat eine Tastatur-Standardbelegung', () => {
    for (const a of ACTIONS) expect(DEFAULT_BINDINGS.keys[a].length, a).toBeGreaterThan(0);
  });

  it('Tastatur: gedrückt, Flanke, losgelassen', () => {
    const im = new InputManager(DEFAULT_BINDINGS, { getGamepads: () => [] }, { stickDeadzone: 0.3 });
    im.handleKeyDown('Enter', false);
    im.beginFrame();
    expect(im.isDown('uiConfirm')).toBe(true);
    expect(im.justPressed('uiConfirm')).toBe(true);
    expect(im.anyJustPressed()).toBe(true);
    im.endFrame();
    im.beginFrame();
    expect(im.justPressed('uiConfirm')).toBe(false);
    expect(im.isDown('uiConfirm')).toBe(true);
    im.endFrame();
    im.handleKeyUp('Enter');
    im.beginFrame();
    expect(im.justReleased('uiConfirm')).toBe(true);
  });

  it('kurzes Antippen innerhalb eines Frames geht nicht verloren', () => {
    const im = new InputManager(DEFAULT_BINDINGS, { getGamepads: () => [] }, { stickDeadzone: 0.3 });
    im.handleKeyDown('KeyE', false);
    im.handleKeyUp('KeyE');
    im.beginFrame();
    expect(im.justPressed('interact')).toBe(true);
  });

  it('Tasten aus Textfeldern und Wiederholungen lösen keine Flanke aus', () => {
    const im = new InputManager(DEFAULT_BINDINGS, { getGamepads: () => [] }, { stickDeadzone: 0.3 });
    expect(im.handleKeyDown('KeyE', false, true)).toBe(false);
    im.beginFrame();
    expect(im.isDown('interact')).toBe(false);
    im.endFrame();
    im.handleKeyDown('KeyE', false);
    im.beginFrame();
    im.endFrame();
    im.handleKeyDown('KeyE', true);
    im.beginFrame();
    expect(im.justPressed('interact')).toBe(false);
  });

  it('Bewegung: diagonal normalisiert, Stick analog mit Totzone', () => {
    const p = pad();
    const im = new InputManager(DEFAULT_BINDINGS, { getGamepads: () => [p] }, { stickDeadzone: 0.3 });
    im.handleKeyDown('KeyW', false);
    im.handleKeyDown('KeyD', false);
    im.beginFrame();
    expect(Math.hypot(im.move.x, im.move.y)).toBeCloseTo(1, 5);
    im.endFrame();
    im.releaseAll();
    p.axes[0] = 0.2; // innerhalb der Totzone
    im.beginFrame();
    expect(im.move).toEqual({ x: 0, y: 0 });
    im.endFrame();
    p.axes[0] = 0.6;
    im.beginFrame();
    expect(im.move.x).toBeCloseTo(0.6, 5);
    expect(im.isDown('moveRight')).toBe(true);
  });

  it('Gamepad-Buttons und Gerätewechsel', () => {
    const p = pad();
    const tr = new DeviceTracker('mouse', 'desktop');
    const im = new InputManager(DEFAULT_BINDINGS, { getGamepads: () => [p, null] }, { stickDeadzone: 0.3 }, tr);
    p.buttons[PAD.A]!.pressed = true;
    im.beginFrame();
    expect(im.justPressed('uiConfirm')).toBe(true);
    expect(im.anyJustPressed()).toBe(true);
    expect(tr.hintMode).toBe('gamepad');
    im.endFrame();
    im.beginFrame();
    expect(im.anyJustPressed()).toBe(false); // gehaltener Button zählt nur einmal
  });

  it('getrennte Gamepads (Fehler beim Abfragen) bringen nichts zum Absturz', () => {
    const im = new InputManager(DEFAULT_BINDINGS, { getGamepads: () => { throw new Error('nope'); } }, { stickDeadzone: 0.3 });
    expect(() => im.beginFrame()).not.toThrow();
  });

  it('virtuelle Touch-Buttons und Joystick', () => {
    const im = new InputManager(DEFAULT_BINDINGS, { getGamepads: () => [] }, { stickDeadzone: 0.3 });
    im.setVirtual('interact', true);
    im.setVirtualStick(0, -1);
    im.beginFrame();
    expect(im.justPressed('interact')).toBe(true);
    expect(im.move).toEqual({ x: 0, y: -1 });
    im.endFrame();
    im.setVirtual('interact', false);
    im.beginFrame();
    expect(im.justReleased('interact')).toBe(true);
  });

  it('Zeiger melden Gerät und „beliebige Taste“', () => {
    const tr = new DeviceTracker('mouse', 'desktop');
    const im = new InputManager(DEFAULT_BINDINGS, { getGamepads: () => [] }, { stickDeadzone: 0.3 }, tr);
    im.handlePointer('touch', true);
    im.beginFrame();
    expect(tr.hintMode).toBe('touch');
    expect(im.anyJustPressed()).toBe(true);
  });
});

describe('NavRepeat', () => {
  it('feuert sofort, dann nach Verzögerung im Intervall', () => {
    const nav = new NavRepeat(0.4, 0.1);
    const dt = 1 / 60;
    let fires = 0;
    let t = 0;
    let first = true;
    while (t < 1) {
      if (nav.update(dt, true, first)) fires++;
      first = false;
      t += dt;
    }
    // 1 sofort + (1 - 0,4) / 0,1 ≈ 6–7 Wiederholungen
    expect(fires).toBeGreaterThanOrEqual(7);
    expect(fires).toBeLessThanOrEqual(8);
    expect(nav.update(dt, false, false)).toBe(false);
  });

  it('kurzer Druck wiederholt auch bei sehr niedriger Bildrate nicht', () => {
    const nav = new NavRepeat(0.38, 0.11);
    // 4 FPS, Frame-Abstand auf 0,25 s gedeckelt: Druck-Frame plus ein weiterer Frame gehalten.
    expect(nav.update(0.25, true, true)).toBe(true);
    expect(nav.update(0.25, true, false)).toBe(false);
    expect(nav.update(0.25, true, false)).toBe(true);
  });
});

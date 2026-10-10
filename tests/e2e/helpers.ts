import { expect, type CDPSession, type Page, type TestInfo } from '@playwright/test';
import { mkdirSync } from 'node:fs';

/** Sammelt Konsolenfehler und Seitenfehler; am Testende muss die Liste leer sein. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  return errors;
}

export async function openGame(page: Page): Promise<void> {
  await page.goto('./');
  await page.waitForFunction(() => window.__MASCHE__?.ready === true, undefined, { timeout: 20_000 });
}

export async function hook<T>(page: Page, fn: string): Promise<T> {
  return page.evaluate((name) => {
    const h = window.__MASCHE__ as unknown as Record<string, () => unknown>;
    return h[name]!();
  }, fn) as Promise<T>;
}

/** Wartet, bis eine Hook-Abfrage den erwarteten Wert liefert. */
export async function expectHook(page: Page, fn: string, expected: unknown): Promise<void> {
  await expect.poll(() => hook(page, fn), { timeout: 5_000 }).toEqual(expected);
}

/** Speichert einen Screenshot unter test-results/screens/<projekt>-<name>.png (zum Ansehen). */
export async function shot(page: Page, info: TestInfo, name: string): Promise<void> {
  mkdirSync('test-results/screens', { recursive: true });
  // Zwei Frames abwarten, damit Animationen und Layout stabil gezeichnet sind.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.screenshot({ path: `test-results/screens/${info.project.name}-${name}.png` });
}

export function isTouchProject(info: TestInfo): boolean {
  return info.project.name.startsWith('phone') || info.project.name === 'tablet';
}

/** Tippt auf die Mitte des Canvas (Touch-Projekte) bzw. klickt (Desktop). */
export async function tapCanvas(page: Page, info: TestInfo, fx = 0.5, fy = 0.5): Promise<void> {
  const vp = page.viewportSize()!;
  const x = Math.round(vp.width * fx);
  const y = Math.round(vp.height * fy);
  if (isTouchProject(info)) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

/** Mittelpunkt eines Menü-Buttons in CSS-Pixeln (aus dem Test-Hook). */
export async function menuCenter(page: Page, id: string): Promise<{ x: number; y: number }> {
  await expect.poll(async () => (await hook<{ id: string }[]>(page, 'menuRects')).some((r) => r.id === id)).toBe(true);
  const rects = await hook<{ id: string; x: number; y: number; w: number; h: number }[]>(page, 'menuRects');
  const r = rects.find((e) => e.id === id)!;
  return { x: Math.round(r.x + r.w / 2), y: Math.round(r.y + r.h / 2) };
}

export interface OfficeState {
  x: number;
  y: number;
  facing: string;
  seated: number | null;
  focus: string | null;
  prompt: string | null;
  zoom: number;
}

export async function office(page: Page): Promise<OfficeState> {
  return hook<OfficeState>(page, 'office');
}

/** Vom Titel ins Büro (Desktop: Tastatur). */
export async function enterOfficeByKeyboard(page: Page): Promise<void> {
  await page.keyboard.press('Enter');
  await expectHook(page, 'menuFocus', 'start');
  await page.keyboard.press('Enter');
  await expectHook(page, 'scene', 'Office');
  await expect.poll(async () => (await office(page))?.zoom ?? 0).toBeGreaterThan(0);
}

/**
 * Läuft per Tastatur, bis `done(state)` erfüllt ist (oder Zeitlimit).
 * Hält die Taste gedrückt und fragt den Zustand ab – wie ein echter Spieler.
 */
export async function walkUntil(page: Page, key: string, done: (s: OfficeState) => boolean, timeoutMs = 6000): Promise<OfficeState> {
  await page.keyboard.down(key);
  const t0 = Date.now();
  let s = await office(page);
  while (!done(s) && Date.now() - t0 < timeoutMs) {
    await page.waitForTimeout(16);
    s = await office(page);
  }
  await page.keyboard.up(key);
  await page.waitForTimeout(120);
  return office(page);
}

/** Touch-Ziehen per CDP (Chromium): Finger aufsetzen, bewegen, halten bis Bedingung, loslassen. */
const cdpSessions = new WeakMap<Page, CDPSession>();

async function cdpFor(page: Page): Promise<CDPSession> {
  let s = cdpSessions.get(page);
  if (!s) {
    s = await page.context().newCDPSession(page);
    cdpSessions.set(page, s);
  }
  return s;
}

export async function touchDrag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  until: () => Promise<boolean>,
  timeoutMs = 6000,
): Promise<void> {
  const cdp = await cdpFor(page);
  const point = (p: { x: number; y: number }) => [{ x: Math.round(p.x), y: Math.round(p.y), id: 1, radiusX: 4, radiusY: 4, force: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(from) });
  for (let i = 1; i <= 3; i++) {
    const p = { x: from.x + ((to.x - from.x) * i) / 3, y: from.y + ((to.y - from.y) * i) / 3 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(p) });
  }
  const t0 = Date.now();
  while (!(await until()) && Date.now() - t0 < timeoutMs) await page.waitForTimeout(16);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

export async function installFakePad(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const state = {
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
      axes: [0, 0, 0, 0],
    };
    (window as unknown as { __pad: typeof state }).__pad = state;
    const pad = {
      id: 'Fake Pad (STANDARD GAMEPAD)',
      index: 0,
      connected: true,
      mapping: 'standard',
      timestamp: 0,
      get buttons() {
        return state.buttons;
      },
      get axes() {
        return state.axes;
      },
    };
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad, null, null, null], configurable: true });
  });
}

export async function padButton(page: Page, index: number): Promise<void> {
  const set = (down: boolean): Promise<void> =>
    page.evaluate(
      ([i, d]) => {
        const b = (window as unknown as { __pad: { buttons: { pressed: boolean; value: number }[] } }).__pad.buttons[i as number]!;
        b.pressed = d as boolean;
        b.value = d ? 1 : 0;
      },
      [index, down] as const,
    );
  // Mindestens zwei echte Frames halten bzw. loslassen: Das Gamepad wird nur einmal pro Frame
  // abgefragt, und bei niedriger Bildrate (Software-Rendering) ginge ein reiner 80-ms-Druck verloren.
  await set(true);
  await Promise.all([nextFrames(page, 2), page.waitForTimeout(80)]);
  await set(false);
  await Promise.all([nextFrames(page, 2), page.waitForTimeout(80)]);
}

/** Wartet, bis die Seite `n` Animation-Frames gezeichnet hat (Phaser läuft im selben Takt). */
export function nextFrames(page: Page, n: number): Promise<void> {
  return page.evaluate(
    (count) =>
      new Promise<void>((resolve) => {
        let i = 0;
        const tick = (): void => {
          if (++i >= count) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    n,
  );
}


/** Setzt eine Stick-Achse des Fake-Gamepads (-1 … 1). */
export async function padAxis(page: Page, axis: number, value: number): Promise<void> {
  await page.evaluate(([a, v]) => {
    (window as unknown as { __pad: { axes: number[] } }).__pad.axes[a as number] = v as number;
  }, [axis, value] as const);
}

export type Dir = 'up' | 'down' | 'left' | 'right';

/**
 * Läuft geregelt zu einem Zielpunkt: kurze Eingabe-Impulse in Richtung der größten Abweichung,
 * danach neu messen. Robust auch bei niedriger Bildrate (Software-Rendering in CI).
 */
export async function approach(
  page: Page,
  target: { x: number; y: number },
  pulse: (dir: Dir, ms: number) => Promise<void>,
  // Toleranz größer als ein einzelner Bewegungsschritt bei sehr niedriger Bildrate (sonst Pendeln),
  // aber klar unter dem Interaktionsradius (18 px).
  tol = 9,
  maxIter = 40,
): Promise<OfficeState> {
  for (let i = 0; i < maxIter; i++) {
    const s = await office(page);
    const dx = target.x - s.x;
    const dy = target.y - s.y;
    if (Math.abs(dx) <= tol && Math.abs(dy) <= tol) return s;
    const vertical = Math.abs(dy) > tol && (Math.abs(dy) >= Math.abs(dx) || Math.abs(dx) <= tol);
    const d = vertical ? dy : dx;
    const dir: Dir = vertical ? (d < 0 ? 'up' : 'down') : d < 0 ? 'left' : 'right';
    // 72 px/s Laufgeschwindigkeit; knapp die ganze Strecke pro Impuls (Beschleunigung kostet etwas).
    const ms = Math.max(60, Math.min(900, (Math.abs(d) / 72) * 1000 * 0.95));
    await pulse(dir, ms);
    await page.waitForTimeout(90);
  }
  return office(page);
}

/** Wegpunkte nacheinander anlaufen. */
export async function walkPath(page: Page, points: { x: number; y: number }[], pulse: (dir: Dir, ms: number) => Promise<void>): Promise<OfficeState> {
  let s = await office(page);
  for (const p of points) s = await approach(page, p, pulse);
  return s;
}

export const keyPulse =
  (page: Page) =>
  async (dir: Dir, ms: number): Promise<void> => {
    const key = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' }[dir];
    await page.keyboard.down(key);
    await holdFor(page, ms);
    await page.keyboard.up(key);
  };

export const padPulse =
  (page: Page) =>
  async (dir: Dir, ms: number): Promise<void> => {
    const [axis, v] = { up: [1, -1], down: [1, 1], left: [0, -1], right: [0, 1] }[dir] as [number, number];
    await padAxis(page, axis, v);
    await holdFor(page, ms);
    await padAxis(page, axis, 0);
  };

/**
 * Touch-Joystick geregelt zu Wegpunkten führen: Der Finger bleibt unten, die Auslenkung wird
 * nach jeder Messung proportional zur Restdistanz gesetzt (analoger Stick = langsamer am Ziel).
 * Jeder CDP-Touch-Event wartet auf einen Frame; bei sehr niedriger Bildrate würden feste
 * Impulse deshalb weit überschwingen.
 */
export async function touchWalkPath(page: Page, points: { x: number; y: number }[], rest: { x: number; y: number }, tol = 9): Promise<OfficeState> {
  const cdp = await cdpFor(page);
  const touch = (type: 'touchStart' | 'touchMove', x: number, y: number) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [{ x: Math.round(x), y: Math.round(y), id: 1, radiusX: 4, radiusY: 4, force: 1 }] });
  // Joystick-Radius in CSS-px (TUNING.touch.joystickRadius × 0.8) und Totzone.
  const radius = 41;
  const deadzone = 0.18;
  await touch('touchStart', rest.x, rest.y);
  try {
    for (const target of points) {
      const t0 = Date.now();
      while (Date.now() - t0 < 30_000) {
        const s = await office(page);
        const dx = target.x - s.x;
        const dy = target.y - s.y;
        if (Math.abs(dx) <= tol && Math.abs(dy) <= tol) break;
        const vertical = Math.abs(dy) > tol && (Math.abs(dy) >= Math.abs(dx) || Math.abs(dx) <= tol);
        const d = vertical ? dy : dx;
        const speed = Math.min(1, Math.max(0.12, Math.abs(d) / 60));
        const len = radius * (deadzone + (1 - deadzone) * speed) * Math.sign(d);
        await touch('touchMove', rest.x + (vertical ? 0 : len), rest.y + (vertical ? len : 0));
        await nextFrames(page, 1);
      }
      // Am Wegpunkt anhalten (Stick in die Mitte), bevor die Achse wechselt.
      await touch('touchMove', rest.x, rest.y);
      await nextFrames(page, 2);
    }
  } finally {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  await nextFrames(page, 2);
  return office(page);
}

/**
 * Hält eine Eingabe mindestens `ms` lang und mindestens zwei echte Frames: Bei sehr niedriger
 * Bildrate (große Canvas im Software-Rendering) ginge ein kurzer Impuls sonst zwischen zwei Frames verloren.
 */
async function holdFor(page: Page, ms: number): Promise<void> {
  await Promise.all([page.waitForTimeout(ms), nextFrames(page, 2)]);
}

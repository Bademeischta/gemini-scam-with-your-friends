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
  await expect.poll(() => hook(page, fn)).toEqual(expected);
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
  desktop: boolean;
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
    const raw = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
    // Kurzer Druck = gedrückt für die nächsten N Abfragen (das Spiel fragt einmal pro Frame ab).
    const tapUntil = new Array<number>(17).fill(-1);
    let poll = 0;
    const buttons = raw.map((b, i) => ({
      get pressed() {
        return b.pressed || poll <= tapUntil[i]!;
      },
      get touched() {
        return this.pressed;
      },
      get value() {
        return this.pressed ? 1 : b.value;
      },
    }));
    const state = { buttons: raw, axes: [0, 0, 0, 0], tapUntil, poll: () => poll };
    (window as unknown as { __pad: typeof state }).__pad = state;
    const pad = { id: 'Fake Pad (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', timestamp: 0, buttons, axes: state.axes };
    Object.defineProperty(navigator, 'getGamepads', {
      value: () => {
        poll++;
        return [pad, null, null, null];
      },
      configurable: true,
    });
  });
}

type FakePad = { tapUntil: number[]; poll: () => number };

/**
 * Kurzer Knopfdruck: genau zwei Abfragen lang gedrückt, danach losgelassen – unabhängig davon,
 * wie schnell die Seite rendert (zeitbasiertes Halten löst bei niedriger Bildrate die Menü-Wiederholung aus
 * oder geht ganz verloren).
 */
export async function padButton(page: Page, index: number): Promise<void> {
  const until = await page.evaluate((i) => {
    const pad = (window as unknown as { __pad: FakePad }).__pad;
    pad.tapUntil[i] = pad.poll() + 2;
    return pad.tapUntil[i];
  }, index);
  // Warten, bis das Spiel auch das Loslassen gesehen hat.
  await page.waitForFunction((u) => (window as unknown as { __pad: FakePad }).__pad.poll() > u + 1, until);
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
    await page.waitForTimeout(ms);
    await page.keyboard.up(key);
  };

export const padPulse =
  (page: Page) =>
  async (dir: Dir, ms: number): Promise<void> => {
    const [axis, v] = { up: [1, -1], down: [1, 1], left: [0, -1], right: [0, 1] }[dir] as [number, number];
    await padAxis(page, axis, v);
    await page.waitForTimeout(ms);
    await padAxis(page, axis, 0);
  };

/**
 * Schneller Wisch per CDP mit festen Zeitstempeln (Dauer `ms`): Die Spiellogik misst die Gesten-Dauer
 * an den Event-Zeitstempeln; ohne sie würde die Verarbeitungszeit des Test-Browsers mitgezählt.
 */
export async function touchSwipe(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, ms = 200): Promise<void> {
  const cdp = await cdpFor(page);
  const t0 = Date.now() / 1000;
  const steps = 4;
  const pt = (i: number) => [{ x: Math.round(from.x + ((to.x - from.x) * i) / steps), y: Math.round(from.y + ((to.y - from.y) * i) / steps), id: 1, radiusX: 4, radiusY: 4, force: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(0), timestamp: t0 });
  for (let i = 1; i <= steps; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(i), timestamp: t0 + (ms / 1000) * (i / (steps + 1)) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [], timestamp: t0 + ms / 1000 });
  await nextFrames(page, 2);
}

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


// ---------- MogelOS ----------

export interface OsTarget {
  id: string;
  scope: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface OsWindowState {
  id: string;
  app: string;
  title: string;
  active: boolean;
  minimized: boolean;
  rect: { x: number; y: number; w: number; h: number };
  titleRect: { x: number; y: number; w: number; h: number };
  state: Record<string, unknown> | null;
}

export interface OsState {
  /** Nimmt Eingaben an (kein Übergangs-Effekt, nicht pausiert). */
  ready: boolean;
  compact: boolean;
  wallpaper: string;
  theme: string;
  ring: boolean;
  focus: string | null;
  start: boolean;
  ctx: boolean;
  /** Desktop-Fläche zwischen den Leisten. */
  area: { x: number; y: number; w: number; h: number };
  windows: OsWindowState[];
  toasts: { title: string; body: string }[];
  toastRects: { x: number; y: number; w: number; h: number }[];
  taskbar: { money: string; team: string; countdown: string };
  icons: { id: string; selected: boolean; rect: { x: number; y: number; w: number; h: number } }[];
  targets: OsTarget[];
}

export async function osState(page: Page): Promise<OsState> {
  return hook<OsState>(page, 'os');
}

/** Mittelpunkt eines Klickziels von MogelOS (CSS-Pixel). */
export async function osTarget(page: Page, id: string): Promise<{ x: number; y: number }> {
  let t: OsTarget | undefined;
  await expect
    .poll(
      async () => {
        t = (await osState(page))?.targets.find((tt) => tt.id === id);
        return t !== undefined;
      },
      { message: `Ziel ${id}` },
    )
    .toBe(true);
  return { x: t!.x + t!.w / 2, y: t!.y + t!.h / 2 };
}

export async function osWindow(page: Page, app: string): Promise<OsWindowState | undefined> {
  return (await osState(page))?.windows.find((w) => w.app === app);
}

/** Vom Titel an Platz 7 setzen (Desktop: Tastatur, Touch: Joystick + Kontext-Button); wartet, bis MogelOS bereit ist. */
export async function sitAtDesk(page: Page, touch: boolean, alreadyInOffice = false): Promise<void> {
  if (touch) {
    if (await hook<boolean>(page, 'rotateHintVisible')) await page.locator('#rotate-continue').tap();
    await page.touchscreen.tap(20, 200);
    await expectHook(page, 'titleState', 'menu');
    const startBtn = await menuCenter(page, 'start');
    await page.touchscreen.tap(startBtn.x, startBtn.y);
    await expectHook(page, 'scene', 'Office');
    await expect.poll(async () => (await hook<{ action: { w: number } } | undefined>(page, 'touchRects'))?.action.w ?? 0).toBeGreaterThan(50);
    const rects = await hook<{ stickRest: { x: number; y: number }; action: { x: number; y: number; w: number; h: number } }>(page, 'touchRects');
    await touchWalkPath(page, DESK7_PATH, rects.stickRest);
    await expect.poll(async () => (await office(page)).focus).toBe('desk7');
    await page.touchscreen.tap(rects.action.x + rects.action.w / 2, rects.action.y + rects.action.h / 2);
  } else {
    if (!alreadyInOffice) await enterOfficeByKeyboard(page);
    await expect.poll(async () => (await office(page))?.zoom ?? 0).toBeGreaterThan(0);
    await walkPath(page, DESK7_PATH, keyPulse(page));
    await expect.poll(async () => (await office(page)).focus).toBe('desk7');
    await page.keyboard.press('KeyE');
  }
  await waitOsReady(page);
}

/** Wartet, bis MogelOS Eingaben annimmt (Einschalt-Effekt vorbei). */
export async function waitOsReady(page: Page): Promise<void> {
  await expect.poll(async () => (await office(page)).desktop).toBe(true);
  await expect.poll(async () => (await osState(page))?.ready ?? false).toBe(true);
}

/** Weg vom Eingang zu Platz 7 (Reihe B, ganz rechts), komplett im freien Gang. */
export const DESK7_PATH = [
  { x: 288, y: 306 },
  { x: 256, y: 306 },
  { x: 256, y: 292 },
];

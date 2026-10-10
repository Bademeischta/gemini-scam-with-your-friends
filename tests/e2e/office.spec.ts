import { expect, test } from '@playwright/test';
import {
  collectErrors,
  enterOfficeByKeyboard,
  expectHook,
  hook,
  installFakePad,
  isTouchProject,
  menuCenter,
  office,
  openGame,
  padButton,
  keyPulse,
  padPulse,
  shot,
  touchWalkPath,
  walkPath,
  walkUntil,
} from './helpers';

// Platz 7 (Reihe B, ganz rechts): Stehplatz hinter dem Stuhl.
const DESK7 = { x: 256, y: 292 };
// Weg vom Eingang dorthin, komplett im freien Gang unter Reihe B.
const PATH_TO_DESK7 = [
  { x: 288, y: 306 },
  { x: 256, y: 306 },
  DESK7,
];

test.describe('Büro', () => {
  test('Tastatur: laufen, Kollision, hinsetzen und aufstehen', async ({ page }, info) => {
    // Software-Rendering ohne GPU (lokal und in CI): Bewegungstests brauchen mehr Zeit.
    test.slow();
    test.skip(isTouchProject(info), 'Tastatur-Test nur am Desktop');
    const errors = collectErrors(page);
    await openGame(page);
    await enterOfficeByKeyboard(page);
    const start = await office(page);
    expect(start.seated).toBeNull();
    await shot(page, info, 'office');

    let s = await walkPath(page, PATH_TO_DESK7, keyPulse(page));
    expect(s.y).toBeLessThan(start.y - 25);
    expect(['up', 'down']).toContain(s.facing);
    await expect.poll(async () => (await office(page)).focus).toBe('desk7');
    expect((await office(page)).prompt).toBe('E: Hinsetzen');
    await shot(page, info, 'office-focus');

    await page.keyboard.press('KeyE');
    await expect.poll(async () => (await office(page)).seated).toBe(7);
    expect((await office(page)).prompt).toBe('E: Aufstehen');
    // Im Sitzen bewegt man sich nicht.
    const seated = await office(page);
    await walkUntil(page, 'KeyA', () => false, 400);
    expect((await office(page)).x).toBe(seated.x);
    await shot(page, info, 'office-seated');

    await page.keyboard.press('KeyE');
    await expect.poll(async () => (await office(page)).seated).toBeNull();

    // Kollision: Der Stuhl hält die Figur auf.
    s = await walkUntil(page, 'KeyW', () => false, 1200);
    expect(s.y).toBeGreaterThan(280);
    expect(errors).toEqual([]);
  });

  test('Gamepad-Stick bewegt die Figur, A setzt sich hin', async ({ page }, info) => {
    // Software-Rendering ohne GPU (lokal und in CI): Bewegungstests brauchen mehr Zeit.
    test.slow();
    test.skip(isTouchProject(info), 'nur Desktop');
    await installFakePad(page);
    await openGame(page);
    await padButton(page, 0);
    await expectHook(page, 'menuFocus', 'start');
    await padButton(page, 0);
    await expectHook(page, 'scene', 'Office');
    const start = await office(page);
    await walkPath(page, PATH_TO_DESK7, padPulse(page));
    expect((await office(page)).y).toBeLessThan(start.y);
    expect(await hook(page, 'hintMode')).toBe('gamepad');
    await expect.poll(async () => (await office(page)).prompt).toBe('A: Hinsetzen');
    await padButton(page, 0);
    await expect.poll(async () => (await office(page)).seated).toBe(7);
    await padButton(page, 1); // B = Aufstehen (leave)
    await expect.poll(async () => (await office(page)).seated).toBeNull();
  });

  test('Touch: Joystick bewegt die Figur, Kontext-Button setzt sich hin', async ({ page }, info) => {
    // Software-Rendering ohne GPU (lokal und in CI): Bewegungstests brauchen mehr Zeit.
    test.slow();
    test.skip(!isTouchProject(info), 'nur Touch-Geräte');
    const errors = collectErrors(page);
    await openGame(page);
    if (await hook<boolean>(page, 'rotateHintVisible')) await page.locator('#rotate-continue').tap();
    await page.touchscreen.tap(20, 200);
    await expectHook(page, 'titleState', 'menu');
    const startBtn = await menuCenter(page, 'start');
    await page.touchscreen.tap(startBtn.x, startBtn.y);
    await expectHook(page, 'scene', 'Office');
    await expect.poll(async () => (await hook<{ action: { w: number } } | undefined>(page, 'touchRects'))?.action.w ?? 0).toBeGreaterThan(50);
    const rects = await hook<{ stickRest: { x: number; y: number }; action: { x: number; y: number; w: number; h: number }; pause: { x: number; y: number; w: number; h: number } }>(page, 'touchRects');
    // Daumengröße der Buttons.
    expect(rects.action.w).toBeGreaterThanOrEqual(70);
    expect(rects.pause.w).toBeGreaterThanOrEqual(55);
    await shot(page, info, 'office');

    const start = await office(page);
    await touchWalkPath(page, PATH_TO_DESK7, rects.stickRest);
    expect((await office(page)).y).toBeLessThan(start.y - 25);
    await expect.poll(async () => (await office(page)).focus).toBe('desk7');
    // Auf Touch steht die Aktion ohne Tastenname im Hinweis.
    expect((await office(page)).prompt).toBe('Hinsetzen');
    await page.touchscreen.tap(rects.action.x + rects.action.w / 2, rects.action.y + rects.action.h / 2);
    await expect.poll(async () => (await office(page)).seated).toBe(7);
    await shot(page, info, 'office-seated');

    await page.touchscreen.tap(rects.pause.x + rects.pause.w / 2, rects.pause.y + rects.pause.h / 2);
    await expect.poll(() => hook<string[]>(page, 'scenes')).toContain('Pause');
    await shot(page, info, 'pause');
    const resume = await menuCenter(page, 'resume');
    await page.touchscreen.tap(resume.x, resume.y);
    await expect.poll(() => hook<string[]>(page, 'scenes')).not.toContain('Pause');
    expect(errors).toEqual([]);
  });

  test('Pause friert die Logik ein; Hauptmenü kehrt zum Titel zurück', async ({ page }, info) => {
    // Software-Rendering ohne GPU (lokal und in CI): Bewegungstests brauchen mehr Zeit.
    test.slow();
    test.skip(isTouchProject(info), 'Tastatur-Test nur am Desktop');
    const errors = collectErrors(page);
    await openGame(page);
    await enterOfficeByKeyboard(page);
    await page.keyboard.press('Escape');
    await expect.poll(() => hook<string[]>(page, 'scenes')).toContain('Pause');
    expect(await hook<string[]>(page, 'pauseReasons')).toContain('menu');
    const before = await office(page);
    await walkUntil(page, 'KeyW', () => false, 400);
    expect((await office(page)).y).toBe(before.y);
    await shot(page, info, 'pause');
    await page.keyboard.press('Escape');
    await expect.poll(() => hook<string[]>(page, 'scenes')).not.toContain('Pause');
    expect(await hook<boolean>(page, 'paused')).toBe(false);
    await page.keyboard.press('KeyP');
    await expect.poll(() => hook<string[]>(page, 'scenes')).toContain('Pause');
    await page.keyboard.press('ArrowDown');
    await expectHook(page, 'menuFocus', 'mainMenu');
    await page.keyboard.press('Enter');
    await expectHook(page, 'scene', 'Title');
    expect(await hook<string[]>(page, 'scenes')).toEqual(['Title']);
    expect(await hook<boolean>(page, 'paused')).toBe(false);
    // Erneut ins Büro: alles frisch, keine Reste der alten Schicht.
    await expectHook(page, 'menuFocus', 'start');
    await page.keyboard.press('Enter');
    await expectHook(page, 'scene', 'Office');
    expect((await office(page)).seated).toBeNull();
    expect(errors).toEqual([]);
  });

  test('Auto-Pause: Hintergrund öffnet das Pausenmenü, das offen bleibt', async ({ page }, info) => {
    test.skip(isTouchProject(info), 'Desktop');
    await openGame(page);
    await enterOfficeByKeyboard(page);
    const setVisibility = (state: 'hidden' | 'visible'): Promise<void> =>
      page.evaluate((st) => {
        Object.defineProperty(document, 'visibilityState', { value: st, configurable: true });
        Object.defineProperty(document, 'hidden', { value: st === 'hidden', configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
      }, state);
    await setVisibility('hidden');
    await setVisibility('visible');
    await expect.poll(() => hook<string[]>(page, 'scenes')).toContain('Pause');
    expect(await hook<boolean>(page, 'paused')).toBe(true);
  });
});

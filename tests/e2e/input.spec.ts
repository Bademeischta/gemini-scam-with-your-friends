import { expect, test } from '@playwright/test';
import { collectErrors, expectHook, hook, installFakePad, isTouchProject, menuCenter, openGame, padButton, shot, tapCanvas } from './helpers';

test.describe('Eingabe & Menüs', () => {
  test('Tastatur: Einstempeln, Menü navigieren, Info-Seite und zurück', async ({ page }, info) => {
    test.skip(isTouchProject(info), 'Tastatur-Test nur am Desktop');
    const errors = collectErrors(page);
    await openGame(page);
    await page.keyboard.press('Enter');
    await expectHook(page, 'titleState', 'menu');
    await expectHook(page, 'menuFocus', 'start');
    await page.keyboard.press('ArrowDown');
    await expectHook(page, 'menuFocus', 'stats');
    await page.keyboard.press('ArrowDown');
    await expectHook(page, 'menuFocus', 'about');
    await page.keyboard.press('ArrowDown');
    await expectHook(page, 'menuFocus', 'fullscreen');
    await page.keyboard.press('ArrowDown');
    await expectHook(page, 'menuFocus', 'start');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await expectHook(page, 'menuFocus', 'about');
    await shot(page, info, 'menu');
    await page.keyboard.press('Enter');
    await expectHook(page, 'scene', 'About');
    await shot(page, info, 'about');
    await page.keyboard.press('Escape');
    await expectHook(page, 'scene', 'Title');
    await expectHook(page, 'titleState', 'menu');
    await page.keyboard.press('Escape');
    await expectHook(page, 'titleState', 'attract');
    expect(errors).toEqual([]);
  });

  test('Maus: Hover fokussiert, Klick wählt aus', async ({ page }, info) => {
    test.skip(isTouchProject(info), 'Maus-Test nur am Desktop');
    await openGame(page);
    await page.mouse.click(10, 10);
    await expectHook(page, 'titleState', 'menu');
    const fs = await menuCenter(page, 'fullscreen');
    const about = await menuCenter(page, 'about');
    await page.mouse.move(fs.x, fs.y);
    await expectHook(page, 'menuFocus', 'fullscreen');
    await page.mouse.move(about.x, about.y);
    await expectHook(page, 'menuFocus', 'about');
    await page.mouse.click(about.x, about.y);
    await expectHook(page, 'scene', 'About');
  });

  test('Touch: Tippen stempelt ein, Antippen öffnet die Info-Seite', async ({ page }, info) => {
    test.skip(!isTouchProject(info), 'Touch-Test nur auf Touch-Geräten');
    const errors = collectErrors(page);
    await openGame(page);
    if (await hook<boolean>(page, 'rotateHintVisible')) await page.locator('#rotate-continue').tap();
    await tapCanvas(page, info, 0.5, 0.3);
    await expectHook(page, 'titleState', 'menu');
    await shot(page, info, 'menu');
    // Buttons sind mindestens daumengroß (56 CSS-px).
    const rects = await hook<{ h: number }[]>(page, 'menuRects');
    for (const r of rects) expect(r.h).toBeGreaterThanOrEqual(55.5);
    const about = await menuCenter(page, 'about');
    await page.touchscreen.tap(about.x, about.y);
    await expectHook(page, 'scene', 'About');
    await shot(page, info, 'about');
    expect(errors).toEqual([]);
  });

  test('Gamepad: A stempelt ein, Steuerkreuz navigiert, Hinweise wechseln zu Gamepad', async ({ page }) => {
    await installFakePad(page);
    await openGame(page);
    if (await hook<boolean>(page, 'rotateHintVisible')) await page.locator('#rotate-continue').click();
    await padButton(page, 0); // A
    await expectHook(page, 'titleState', 'menu');
    await expectHook(page, 'hintMode', 'gamepad');
    await expectHook(page, 'menuFocus', 'start');
    await padButton(page, 13); // Steuerkreuz runter
    await expectHook(page, 'menuFocus', 'stats');
    await padButton(page, 13);
    await expectHook(page, 'menuFocus', 'about');
    await padButton(page, 0);
    await expectHook(page, 'scene', 'About');
    await padButton(page, 1); // B zurück
    await expectHook(page, 'scene', 'Title');
  });

  test('Laufzeit-Wechsel: Maus auf Touch-Gerät schaltet auf Desktop-Hinweise und zurück', async ({ page }, info) => {
    test.skip(!isTouchProject(info), 'nur Touch-Geräte');
    await openGame(page);
    expect(await hook(page, 'hintMode')).toBe('touch');
    await page.mouse.move(50, 50);
    await page.mouse.move(80, 90);
    await expectHook(page, 'hintMode', 'desktop');
    await page.touchscreen.tap(20, 20);
    await expectHook(page, 'hintMode', 'touch');
  });

  test('Laufzeit-Wechsel: Desktop → Gamepad → Tastatur', async ({ page }, info) => {
    test.skip(isTouchProject(info), 'nur Desktop');
    await installFakePad(page);
    await openGame(page);
    expect(await hook(page, 'hintMode')).toBe('desktop');
    await padButton(page, 3);
    await expectHook(page, 'hintMode', 'gamepad');
    await page.keyboard.press('ArrowLeft');
    await expectHook(page, 'hintMode', 'desktop');
  });
});

test.describe('Plattform', () => {
  test('Hochformat-Hinweis nur auf Handys im Hochformat, wegklickbar und gemerkt', async ({ page }, info) => {
    await openGame(page);
    const shouldShow = info.project.name === 'phone-portrait';
    expect(await hook(page, 'rotateHintVisible')).toBe(shouldShow);
    if (!shouldShow) return;
    expect(await hook<string[]>(page, 'pauseReasons')).toContain('orientation');
    await page.locator('#rotate-continue').tap();
    await expectHook(page, 'rotateHintVisible', false);
    expect(await hook<string[]>(page, 'pauseReasons')).not.toContain('orientation');
    await shot(page, info, 'title-after-hint');
    await page.reload();
    await page.waitForFunction(() => window.__MASCHE__?.ready === true);
    expect(await hook(page, 'rotateHintVisible')).toBe(false);
  });

  test('Auto-Pause im Hintergrund und Fortsetzen', async ({ page }) => {
    await openGame(page);
    const setVisibility = (state: 'hidden' | 'visible'): Promise<void> =>
      page.evaluate((s) => {
        Object.defineProperty(document, 'visibilityState', { value: s, configurable: true });
        Object.defineProperty(document, 'hidden', { value: s === 'hidden', configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
      }, state);
    await setVisibility('hidden');
    expect(await hook<string[]>(page, 'pauseReasons')).toContain('background');
    await setVisibility('visible');
    expect(await hook<string[]>(page, 'pauseReasons')).not.toContain('background');
  });

  test('Ton wird erst nach Nutzer-Geste freigeschaltet', async ({ page }, info) => {
    await openGame(page);
    expect(await hook(page, 'audioState')).toBe('none');
    if (await hook<boolean>(page, 'rotateHintVisible')) await page.locator('#rotate-continue').tap();
    await tapCanvas(page, info, 0.5, 0.2);
    await expect.poll(() => hook(page, 'audioState')).toBe('running');
    // Auf dem Handy schaltet die erste Geste automatisch in den Vollbildmodus.
    if (info.project.name.startsWith('phone')) await expect.poll(() => hook(page, 'fullscreen')).toBe(true);
    else expect(await hook(page, 'fullscreen')).toBe(false);
  });

  test('Vollbild-Knopf schaltet um', async ({ page }, info) => {
    test.skip(isTouchProject(info), 'Desktop-Vollbild-Test');
    await openGame(page);
    const vp = page.viewportSize()!;
    // Knopf oben rechts innerhalb von 16 px Rand.
    await page.mouse.click(vp.width - 16 - 28, 16 + 28);
    await expect.poll(() => hook(page, 'fullscreen')).toBe(true);
    await page.mouse.click(vp.width - 16 - 28, 16 + 28);
    await expect.poll(() => hook(page, 'fullscreen')).toBe(false);
  });
});

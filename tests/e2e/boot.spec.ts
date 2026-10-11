import { expect, test } from '@playwright/test';
import { collectErrors, expectHook, hook, isTouchProject, openGame, shot } from './helpers';

test.describe('Start & Darstellung', () => {
  test('lädt ohne Fehler und zeigt den Titel', async ({ page }, info) => {
    const errors = collectErrors(page);
    await openGame(page);
    await expectHook(page, 'scene', 'Title');
    await expectHook(page, 'titleState', 'attract');
    await expectHook(page, 'locale', 'de');
    await shot(page, info, 'title');
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => window.__MASCHE__!.errors)).toEqual([]);
  });

  test('Canvas hat physische Auflösung (scharf auf Retina)', async ({ page }) => {
    await openGame(page);
    const vp = page.viewportSize()!;
    const dpr = await page.evaluate(() => window.devicePixelRatio);
    const c = await hook<{ width: number; height: number; cssWidth: string; cssHeight: string }>(page, 'canvas');
    expect(c.width).toBe(Math.round(vp.width * Math.min(dpr, 3)));
    expect(c.height).toBe(Math.round(vp.height * Math.min(dpr, 3)));
    expect(c.cssWidth).toBe(`${vp.width}px`);
    expect(c.cssHeight).toBe(`${vp.height}px`);
  });

  test('erkennt das Gerät automatisch', async ({ page }, info) => {
    await openGame(page);
    const touch = isTouchProject(info);
    expect(await hook(page, 'hintMode')).toBe(touch ? 'touch' : 'desktop');
    const expectedForm = info.project.name.startsWith('phone') ? 'phone' : info.project.name === 'tablet' ? 'tablet' : 'desktop';
    expect(await hook(page, 'formFactor')).toBe(expectedForm);
  });

  test('kein Zoomen, Scrollen oder Markieren', async ({ page }) => {
    await openGame(page);
    const meta = await page.locator('meta[name=viewport]').getAttribute('content');
    expect(meta).toContain('user-scalable=no');
    expect(meta).toContain('viewport-fit=cover');
    const styles = await page.evaluate(() => {
      const cs = getComputedStyle(document.body);
      return { touch: cs.touchAction, overscroll: cs.overscrollBehaviorY, select: cs.userSelect, overflow: cs.overflow };
    });
    expect(styles.touch).toBe('none');
    expect(styles.overscroll).toBe('none');
    expect(styles.select).toBe('none');
    expect(styles.overflow).toBe('hidden');
    await page.mouse.wheel(0, 800);
    expect(await page.evaluate(() => [window.scrollX, window.scrollY])).toEqual([0, 0]);
    // Strg+Mausrad (Browser-Zoom) wird verhindert.
    const prevented = await page.evaluate(() => {
      const e = new WheelEvent('wheel', { deltaY: -100, ctrlKey: true, cancelable: true, bubbles: true });
      window.dispatchEvent(e);
      return e.defaultPrevented;
    });
    expect(prevented).toBe(true);
  });

  test('PWA: Manifest, Icons und Service Worker', async ({ page, request }) => {
    await openGame(page);
    const href = await page.locator('link[rel=manifest]').getAttribute('href');
    expect(href).toBeTruthy();
    const manifest = await (await request.get(href!)).json();
    expect(manifest.name).toBe('Masche & Co.');
    expect(manifest.display).toBe('fullscreen');
    expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
    expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
    for (const icon of manifest.icons as { src: string }[]) {
      const res = await request.get(icon.src);
      expect(res.status()).toBe(200);
      expect(res.headers()['content-type']).toContain('image/png');
    }
    const swReady = await page.evaluate(async () => {
      const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 10_000))]);
      return !!reg;
    });
    expect(swReady).toBe(true);
  });
});

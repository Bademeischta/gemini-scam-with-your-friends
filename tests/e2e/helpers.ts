import { expect, type Page, type TestInfo } from '@playwright/test';
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

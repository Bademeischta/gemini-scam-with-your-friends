import { expect, test, type Page } from '@playwright/test';
import { collectErrors, enterOfficeByTouch, expectHook, hook, menuCenter, openGame, osState, osTarget, osWindow, shot, sitAtDesk } from './helpers';

interface RunState {
  day: number;
  personal: number;
  team: number;
  quota: number;
  clockedIn: boolean;
  clockedOut: boolean;
  mails: { from: string; read: boolean }[];
  unlockedApps: string[];
  days: number;
}
interface ReviewState {
  phase: string;
  passed: boolean;
  day: number;
  hits: number;
  moments: string[];
  tomorrow: { apps: string[]; schemes: string[] };
  playerX: number;
}
interface SavesState {
  backend: string;
  run: { day: number; personal: number; days: number } | null;
  stats: { runs: number; firings: number; daysWorked: number; staplersHit: number };
  leaderboard: { days: number; code: string }[];
}

const run = (page: Page): Promise<RunState> => hook<RunState>(page, 'run');
const review = (page: Page): Promise<ReviewState | null> => hook<ReviewState | null>(page, 'review');
const saves = (page: Page): Promise<SavesState> => hook<SavesState>(page, 'saves');

async function click(page: Page, id: string): Promise<void> {
  const p = await osTarget(page, id);
  await page.mouse.click(p.x, p.y);
}

async function clickMenu(page: Page, id: string): Promise<void> {
  const p = await menuCenter(page, id);
  await page.mouse.click(p.x, p.y);
}

/** Debug-Menü (F9) öffnen und einen Knopf drücken. */
async function debug(page: Page, button: string): Promise<void> {
  const panel = page.locator('#debug-menu');
  if (!(await panel.isVisible())) await page.keyboard.press('F9');
  await expect(panel).toBeVisible();
  await page.locator(`#${button}`).click();
}

const desktopOnly = (info: { project: { name: string } }): boolean => info.project.name !== 'desktop';

test.describe('Arbeitstag und Run', () => {
  test('Einstempeln, Postfach, gesperrte Apps, Ausstempeln, Bewertung bestanden, Tag 2 fortsetzen', async ({ page }, info) => {
    test.slow();
    test.skip(desktopOnly(info), 'Tastatur/Maus, DPR-unabhängig');
    const errors = collectErrors(page);
    await openGame(page, '?seed=7');
    await expect.poll(async () => (await saves(page)).backend).toBe('indexeddb');
    await sitAtDesk(page, false);
    // Einstempeln und Chef-Mail mit Tagesziel (DAY-14).
    await expect.poll(async () => (await run(page)).clockedIn).toBe(true);
    expect((await run(page)).mails.map((m) => m.from)).toContain('boss');
    await expect.poll(async () => (await osState(page)).toasts.some((t) => t.title.startsWith('Chef-Mail'))).toBe(true);
    // Gesperrte Apps sind sichtbar, lassen sich aber erst ab ihrem Tag öffnen (OS-10, DAY-10).
    const icons = (await osState(page)).icons;
    expect(icons.find((i) => i.id === 'ferngucker')?.locked).toBe(true);
    expect(icons.find((i) => i.id === 'identomat')?.locked).toBe(false);
    const fg = await osTarget(page, 'icon:ferngucker');
    await page.mouse.dblclick(fg.x, fg.y);
    await expect.poll(async () => (await osState(page)).toasts.some((t) => t.title === 'Noch gesperrt')).toBe(true);
    expect(await osWindow(page, 'ferngucker')).toBeUndefined();
    // Postfach öffnen: Chef-Mail gelesen.
    const mail = await osTarget(page, 'icon:mail');
    await page.mouse.dblclick(mail.x, mail.y);
    await expect.poll(async () => (await osWindow(page, 'mail'))?.active).toBe(true);
    await expect.poll(async () => (await run(page)).mails.find((m) => m.from === 'boss')?.read).toBe(true);
    await shot(page, info, 'day-mail');
    // Ausstempeln erst mit Quota (OS-07): per Debug-Menü die Quota überspringen.
    expect((await osState(page)).targets.some((t) => t.id === 'tb:clockout')).toBe(false);
    await debug(page, 'debug-skip');
    await page.keyboard.press('F9');
    await expect.poll(async () => (await osState(page)).targets.some((t) => t.id === 'tb:clockout')).toBe(true);
    await expect.poll(async () => (await osState(page)).toasts.some((t) => t.title === 'Quota erreicht!')).toBe(true);
    await shot(page, info, 'day-clockout');
    await click(page, 'tb:clockout');
    // Bewertung: Tacker fliegen, dann das Urteil (DAY-05, 08, 09, 11).
    await expectHook(page, 'scene', 'Review');
    await expect.poll(async () => (await review(page))?.phase, { timeout: 40_000 }).toBe('verdict');
    const r = (await review(page))!;
    expect(r.passed).toBe(true);
    expect(r.moments).toHaveLength(3);
    expect(r.tomorrow.apps).toEqual(['plauder', 'voucher']);
    await shot(page, info, 'day-review');
    // Gespeichert: Tag 2 (MOD-07).
    await expect.poll(async () => (await saves(page)).run?.day).toBe(2);
    await clickMenu(page, 'nextDay');
    await expectHook(page, 'scene', 'Office');
    await expect.poll(async () => (await run(page)).day).toBe(2);
    expect((await run(page)).unlockedApps).toContain('plauder');
    // Browser zu, wieder auf: „Weiter: Tag 2“ im Titel.
    await page.reload();
    await page.waitForFunction(() => window.__MASCHE__?.ready === true);
    await page.keyboard.press('Enter');
    await expectHook(page, 'menuFocus', 'continue');
    await page.keyboard.press('Enter');
    await expectHook(page, 'scene', 'Office');
    await expect.poll(async () => (await run(page)).day).toBe(2);
    expect((await run(page)).personal).toBe((await run(page)).quota > 0 ? (await saves(page)).run!.personal : 0);
    expect(errors).toEqual([]);
  });

  test('Quota verfehlt: gefeuert, Kündigungsbericht, Bestenliste, neue Bewerbung', async ({ page }, info) => {
    test.slow();
    test.skip(desktopOnly(info), 'Tastatur/Maus, DPR-unabhängig');
    const errors = collectErrors(page);
    await openGame(page, '?seed=11&dayLength=8');
    await page.keyboard.press('Enter');
    await expectHook(page, 'menuFocus', 'start');
    await page.keyboard.press('Enter');
    await expectHook(page, 'scene', 'Office');
    // HUD im Büro (HUD-01).
    await expect.poll(async () => (await hook<{ day: number; quota: number } | null>(page, 'hud'))?.quota).toBe(600);
    await shot(page, info, 'day-hud');
    await expectHook(page, 'scene', 'Review');
    await expect.poll(async () => (await review(page))?.phase, { timeout: 40_000 }).toBe('verdict');
    expect((await review(page))!.passed).toBe(false);
    await shot(page, info, 'day-fired');
    await clickMenu(page, 'report');
    await expectHook(page, 'scene', 'Report');
    const rep = await hook<{ days: number; code: string; rank: number | null }>(page, 'report');
    expect(rep).toMatchObject({ days: 1, rank: 1 });
    expect(rep.code).toMatch(/^MC-/);
    await shot(page, info, 'day-report');
    // Spielstand ist weg, Bestenliste und Statistik sind gefüllt (PRG-04–06, MOD-05).
    await expect.poll(async () => (await saves(page)).run).toBeNull();
    const sv = await saves(page);
    expect(sv.leaderboard).toHaveLength(1);
    expect(sv.stats).toMatchObject({ runs: 1, firings: 1, daysWorked: 1 });
    // Neue Bewerbung schreiben (PRG-07).
    await clickMenu(page, 'again');
    await expectHook(page, 'scene', 'Office');
    await expect.poll(async () => (await run(page)).day).toBe(1);
    expect((await saves(page)).stats.runs).toBe(2);
    expect(errors).toEqual([]);
  });

  test('Bestenliste und Statistik im Titel; beschädigter Spielstand führt zu einem Hinweis statt einem Absturz', async ({ page }, info) => {
    test.slow();
    test.skip(desktopOnly(info), 'Tastatur/Maus');
    const errors = collectErrors(page);
    await openGame(page);
    // Kaputten Spielstand direkt in IndexedDB schreiben, dann neu laden.
    await page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const req = indexedDB.open('masche', 1);
          req.onsuccess = () => {
            const tx = req.result.transaction('saves', 'readwrite');
            tx.objectStore('saves').put('{"format":"masche-run","version":1,"data":{"day":"kaputt"}}', 'run');
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
          };
          req.onerror = () => reject(req.error);
        }),
    );
    await page.reload();
    await page.waitForFunction(() => window.__MASCHE__?.ready === true);
    await expectHook(page, 'titleState', 'menu');
    expect(await hook<string>(page, 'titleNotice')).toContain('beschädigt');
    expect((await saves(page)).run).toBeNull();
    await shot(page, info, 'title-notice');
    // Kein „Weiter“, der Fokus steht auf „Schicht beginnen“.
    expect(await hook<string>(page, 'menuFocus')).toBe('start');
    await clickMenu(page, 'stats');
    await expectHook(page, 'scene', 'Stats');
    await shot(page, info, 'stats');
    await page.keyboard.press('Escape');
    await expectHook(page, 'scene', 'Title');
    expect(errors).toEqual([]);
  });

  test('Chef auf Kontrollgang erwischt Faulenzer im Büro', async ({ page }, info) => {
    test.slow();
    test.skip(desktopOnly(info), 'Tastatur/Maus');
    const errors = collectErrors(page);
    await openGame(page, '?seed=3&bossIn=1');
    await page.keyboard.press('Enter');
    await expectHook(page, 'menuFocus', 'start');
    await page.keyboard.press('Enter');
    await expectHook(page, 'scene', 'Office');
    await expect.poll(async () => (await hook<{ state: string }>(page, 'boss')).state).toBe('patrol');
    await shot(page, info, 'boss-patrol');
    // Am Eingang stehen bleiben: Der Kontrollgang kommt vorbei.
    await expect.poll(async () => (await hook<{ catches: number }>(page, 'boss')).catches, { timeout: 80_000 }).toBe(1);
    await shot(page, info, 'boss-catch');
    expect(errors).toEqual([]);
  });

  test('Handy: HUD im Büro, Bewertung mit Ausweichen per Tippen', async ({ page }, info) => {
    test.slow();
    test.skip(info.project.name !== 'phone-landscape', 'Handy');
    const errors = collectErrors(page);
    await openGame(page, '?seed=5&dayLength=6');
    await enterOfficeByTouch(page);
    await expect.poll(async () => (await hook<{ day: number } | null>(page, 'hud'))?.day).toBe(1);
    await shot(page, info, 'day-hud');
    await expectHook(page, 'scene', 'Review');
    const vp = page.viewportSize()!;
    // Rechts tippen und halten: Die Figur läuft nach rechts.
    const x0 = (await review(page))!.playerX;
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: vp.width * 0.5, y: vp.height * 0.3 }] });
    await expect.poll(async () => (await review(page))!.playerX).toBeGreaterThan(x0);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(async () => (await review(page))?.phase, { timeout: 40_000 }).toBe('verdict');
    await shot(page, info, 'day-review');
    expect(errors).toEqual([]);
  });
});

import { expect, test, type Page } from '@playwright/test';
import {
  collectErrors,
  DESK7_PATH,
  expectHook,
  hook,
  installFakePad,
  isTouchProject,
  nextFrames,
  office,
  openGame,
  osState,
  osTarget,
  osWindow,
  padButton,
  padPulse,
  shot,
  sitAtDesk,
  touchDrag,
  touchSwipe,
  waitOsReady,
  walkPath,
} from './helpers';

async function click(page: Page, id: string, opts: { button?: 'left' | 'right' } = {}): Promise<void> {
  const p = await osTarget(page, id);
  await page.mouse.click(p.x, p.y, opts);
}

async function tap(page: Page, id: string): Promise<void> {
  const p = await osTarget(page, id);
  await page.touchscreen.tap(p.x, p.y);
}

// HiDPI rendert im Software-Renderer mit ~4-facher Pixelzahl (teils < 1 FPS unter Parallel-Last).
// Diese Abläufe sind DPR-unabhängig und laufen auf „desktop“; HiDPI deckt der erste Maus-Test
// (Treffer, Ziehen, Taskleiste in physischen Pixeln) und der Tastatur-Test ab.
const HIDPI_SKIP = 'DPR-unabhängig, abgedeckt auf desktop';

const calcDisplay = async (page: Page): Promise<unknown> => (await osWindow(page, 'calc'))?.state?.['display'];

test.describe('MogelOS', () => {
  test('Maus: Taskleiste, Rechner, Fenster verschieben, minimieren, schließen', async ({ page }, info) => {
    test.slow();
    test.skip(isTouchProject(info), 'Maus-Test nur am Desktop');
    const errors = collectErrors(page);
    await openGame(page);
    await sitAtDesk(page, false);
    const os = await osState(page);
    expect(os.compact).toBe(false);
    // Taskleiste: eigenes Geld, Team-Summe gegen Quota, Countdown (OS-03 bis OS-06).
    expect(os.taskbar.money).toBe('Du: 0 ₮');
    expect(os.taskbar.team).toBe('Team 0 / 600 ₮');
    expect(os.taskbar.countdown).toMatch(/^\d+:\d\d$/);
    await expect.poll(async () => (await osState(page)).taskbar.countdown, { timeout: 30_000 }).not.toBe(os.taskbar.countdown);
    // Chef-Mail als Benachrichtigung (OS-11).
    await expect.poll(async () => (await osState(page)).toasts.map((t) => t.title)).toContain('Chef-Mail: Direktor Brülling');
    await shot(page, info, 'os-desktop');

    // Einfacher Klick wählt aus, Doppelklick öffnet.
    const icon = await osTarget(page, 'icon:calc');
    await page.mouse.click(icon.x, icon.y);
    await expect.poll(async () => (await osState(page)).icons.find((i) => i.id === 'calc')?.selected).toBe(true);
    expect(await osWindow(page, 'calc')).toBeUndefined();
    await page.mouse.dblclick(icon.x, icon.y);
    await expect.poll(async () => (await osWindow(page, 'calc'))?.active).toBe(true);

    // Rechner per Maus und per Tastatur.
    for (const k of ['1', '2', '+', '3', '0', '=']) await click(page, `calc:key:${k}`);
    await expect.poll(() => calcDisplay(page)).toBe('42');
    await page.keyboard.type('6*7');
    await page.keyboard.press('Enter');
    await expect.poll(() => calcDisplay(page)).toBe('42');
    await page.keyboard.type('5/0');
    await page.keyboard.press('Enter');
    await expect.poll(() => calcDisplay(page)).toBe('Nö.');
    await shot(page, info, 'os-calc');

    // Fenster an der Titelleiste verschieben.
    const before = (await osWindow(page, 'calc'))!;
    await page.mouse.move(before.titleRect.x + 30, before.titleRect.y + before.titleRect.h / 2);
    await page.mouse.down();
    await page.mouse.move(before.titleRect.x + 150, before.titleRect.y + before.titleRect.h / 2 + 60, { steps: 6 });
    await page.mouse.up();
    await expect.poll(async () => Math.round((await osWindow(page, 'calc'))!.rect.x - before.rect.x)).toBe(120);
    expect(Math.round((await osWindow(page, 'calc'))!.rect.y - before.rect.y)).toBe(60);

    // Minimieren und über die Taskleiste zurückholen, dann schließen.
    await click(page, 'calc:min');
    await expect.poll(async () => (await osWindow(page, 'calc'))?.minimized).toBe(true);
    await click(page, 'tb:win:calc');
    await expect.poll(async () => (await osWindow(page, 'calc'))?.minimized).toBe(false);
    await click(page, 'calc:close');
    await expect.poll(async () => (await osWindow(page, 'calc')) ?? null).toBeNull();

    // Aufstehen über die Taskleiste.
    await click(page, 'tb:leave');
    await expect.poll(async () => (await office(page)).seated).toBeNull();
    expect(await hook<string[]>(page, 'scenes')).not.toContain('Desktop');
    expect(errors).toEqual([]);
  });

  test('Maus: Dateien, Papierkorb, Start- und Kontextmenü, Systemsteuerung', async ({ page }, info) => {
    test.slow();
    test.skip(isTouchProject(info), 'Maus-Test nur am Desktop');
    test.skip(info.project.name === 'desktop-hidpi', HIDPI_SKIP);
    const errors = collectErrors(page);
    await openGame(page);
    await sitAtDesk(page, false);

    // Startmenü → Dateien.
    await click(page, 'tb:start');
    await expect.poll(async () => (await osState(page)).start).toBe(true);
    await shot(page, info, 'os-start');
    await click(page, 'start:files');
    await expect.poll(async () => (await osWindow(page, 'files'))?.active).toBe(true);
    const docs = (await osWindow(page, 'files'))!.state!['files'] as string[];
    expect(docs).toContain('passwoerter');

    // Passwörter.txt (4. Zeile) auswählen und löschen.
    const row = (await osState(page)).targets.find((t) => t.id === 'files:list')!;
    await page.mouse.click(row.x + 30, row.y + row.h * (docs.indexOf('passwoerter') + 0.5));
    await expect.poll(async () => (await osWindow(page, 'files'))!.state!['selected']).toBe('passwoerter');
    await click(page, 'files:delete');
    await expect.poll(async () => (await osWindow(page, 'files'))!.state!['files']).not.toContain('passwoerter');

    // Papierkorb über das Kontextmenü des Desktop-Symbols öffnen (Dateien-Fenster verdeckt es: minimieren).
    await click(page, 'files:min');
    await expect.poll(async () => (await osWindow(page, 'files'))?.minimized).toBe(true);
    await click(page, 'icon:trash', { button: 'right' });
    await expect.poll(async () => (await osState(page)).ctx).toBe(true);
    await click(page, 'ctx:open');
    await expect.poll(async () => (await osWindow(page, 'trash'))?.state?.['files']).toContain('passwoerter');
    const trashed = (await osWindow(page, 'trash'))!.state!['files'] as string[];
    const trow = (await osState(page)).targets.find((t) => t.id === 'trash:list')!;
    await page.mouse.click(trow.x + 30, trow.y + trow.h * (trashed.indexOf('passwoerter') + 0.5));
    await click(page, 'trash:restore');
    await expect.poll(async () => (await osWindow(page, 'files'))!.state!['files']).toContain('passwoerter');
    await shot(page, info, 'os-trash');
    await click(page, 'trash:empty');
    await expect.poll(async () => (await osWindow(page, 'trash'))!.state!['files']).toEqual([]);
    await expect.poll(async () => (await osState(page)).toasts.map((t) => t.title)).toContain('Papierkorb geleert');

    // Datei öffnen: Textansicht mit Dateiname als Titel.
    await click(page, 'tb:win:files');
    const files = (await osWindow(page, 'files'))!.state!['files'] as string[];
    const frow = (await osState(page)).targets.find((t) => t.id === 'files:list')!;
    // Zeilenhöhe = Höhe des Fokus-Rechtecks; die erste Zeile liegt am Listenanfang.
    const sel = files.indexOf((await osWindow(page, 'files'))!.state!['selected'] as string);
    await page.mouse.click(frow.x + 30, frow.y + frow.h * (files.indexOf('leitfaden') - sel + 0.5));
    await expect.poll(async () => (await osWindow(page, 'files'))!.state!['selected']).toBe('leitfaden');
    await click(page, 'files:open');
    await expect.poll(async () => (await osWindow(page, 'viewer'))?.title).toBe('Leitfaden_Telefon.txt');

    // Rechtsklick auf freien Desktop: nächster Hintergrund.
    const { area } = await osState(page);
    const wp0 = (await osState(page)).wallpaper;
    await page.mouse.click(area.x + area.w - 40, area.y + 30, { button: 'right' });
    await expect.poll(async () => (await osState(page)).ctx).toBe(true);
    await click(page, 'ctx:wallpaper');
    await expect.poll(async () => (await osState(page)).wallpaper).not.toBe(wp0);

    // Systemsteuerung: Farbschema, Hintergrund, Vibration – gespeichert.
    await click(page, 'tb:start');
    await click(page, 'start:settings');
    await expect.poll(async () => (await osWindow(page, 'settings'))?.active).toBe(true);
    await click(page, 'settings:theme:petrol');
    await click(page, 'settings:wp:nacht');
    await expect.poll(async () => (await osState(page)).theme).toBe('petrol');
    expect((await osState(page)).wallpaper).toBe('nacht');
    await shot(page, info, 'os-settings');
    await click(page, 'settings:tab:1');
    await click(page, 'settings:vibration');
    await expect.poll(async () => (await osWindow(page, 'settings'))!.state!['vibration']).toBe(false);
    const saved = await page.evaluate(() => localStorage.getItem('masche.settings.v1') ?? '');
    expect(saved).toContain('"osTheme":"petrol"');
    expect(saved).toContain('"osWallpaper":"nacht"');
    expect(errors).toEqual([]);
  });

  test('Tastatur: Pfeile und Enter bedienen den Desktop, Esc pausiert, Tab steht auf', async ({ page }, info) => {
    test.slow();
    test.skip(isTouchProject(info), 'Tastatur-Test nur am Desktop');
    const errors = collectErrors(page);
    await openGame(page);
    await sitAtDesk(page, false);
    await page.keyboard.press('ArrowDown');
    await expect.poll(async () => (await osState(page)).focus).toBe('icon:phone');
    expect((await osState(page)).ring).toBe(true);
    // Telefon und Notizen stehen vorne; „Dateien“ liegt in der zweiten Spalte rechts neben den Notizen.
    await page.keyboard.press('ArrowDown');
    await expect.poll(async () => (await osState(page)).focus).toBe('icon:notes');
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => (await osState(page)).focus).toBe('icon:files');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await osWindow(page, 'files'))?.active).toBe(true);
    await expect.poll(async () => (await osState(page)).focus).toBe('files:tab:0');
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => (await osState(page)).focus).toBe('files:tab:1');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await osWindow(page, 'files'))!.state!['folder']).toBe('downloads');
    await shot(page, info, 'os-keyboard');

    // Esc öffnet am PC die Pause; danach geht es am Desktop weiter.
    await page.keyboard.press('Escape');
    await expect.poll(() => hook<string[]>(page, 'scenes')).toContain('Pause');
    await page.keyboard.press('Escape');
    await expect.poll(() => hook<string[]>(page, 'scenes')).not.toContain('Pause');
    expect((await office(page)).desktop).toBe(true);

    await page.keyboard.press('Tab');
    await expect.poll(async () => (await office(page)).seated).toBeNull();
    expect(errors).toEqual([]);
  });

  test('Hauptmenü vom PC aus baut alles ab; neue Schicht startet frisch', async ({ page }, info) => {
    test.slow();
    test.skip(isTouchProject(info), 'Tastatur-Test nur am Desktop');
    test.skip(info.project.name === 'desktop-hidpi', HIDPI_SKIP);
    const errors = collectErrors(page);
    await openGame(page);
    await sitAtDesk(page, false);
    // Etwas am PC verändern: Papierkorb leeren.
    await click(page, 'icon:trash', { button: 'right' });
    await click(page, 'ctx:emptyTrash');
    await expect.poll(async () => (await osState(page)).toasts.map((t) => t.title)).toContain('Papierkorb geleert');
    await page.keyboard.press('Escape');
    await expect.poll(() => hook<string[]>(page, 'scenes')).toContain('Pause');
    await page.keyboard.press('ArrowDown');
    await expectHook(page, 'menuFocus', 'mainMenu');
    await page.keyboard.press('Enter');
    await expectHook(page, 'scene', 'Title');
    expect(await hook<string[]>(page, 'scenes')).toEqual(['Title']);
    expect(await hook(page, 'os')).toBeNull();
    // Neue Schicht: wieder hinsetzen, der PC ist im Ausgangszustand.
    await expectHook(page, 'menuFocus', 'start');
    await page.keyboard.press('Enter');
    await expectHook(page, 'scene', 'Office');
    await sitAtDesk(page, false, true);
    for (const [key, id] of [['ArrowDown', 'phone'], ['ArrowDown', 'notes'], ['ArrowRight', 'files'], ['ArrowDown', 'trash']] as const) {
      await page.keyboard.press(key);
      await expect.poll(async () => (await osState(page)).focus).toBe(`icon:${id}`);
    }
    await page.keyboard.press('Enter');
    await expect.poll(async () => ((await osWindow(page, 'trash'))?.state?.['files'] as string[] | undefined)?.length).toBe(4);
    expect((await osState(page)).windows).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  test('Gamepad: Steuerkreuz-Fokus, A öffnet und drückt, B steht auf', async ({ page }, info) => {
    test.slow();
    test.skip(isTouchProject(info), 'nur Desktop');
    test.skip(info.project.name === 'desktop-hidpi', HIDPI_SKIP);
    const errors = collectErrors(page);
    await installFakePad(page);
    await openGame(page);
    await padButton(page, 0);
    await expectHook(page, 'menuFocus', 'start');
    await padButton(page, 0);
    await expectHook(page, 'scene', 'Office');
    await walkPath(page, DESK7_PATH, padPulse(page));
    await expect.poll(async () => (await office(page)).focus).toBe('desk7');
    await padButton(page, 0);
    await waitOsReady(page);
    await padButton(page, 13); // runter: Fokus erscheint auf dem ersten Symbol
    await expect.poll(async () => (await osState(page)).focus).toBe('icon:phone');
    // 13 = runter, 15 = rechts (Dateien steht in der zweiten Spalte neben den Notizen).
    for (const [btn, id] of [[13, 'notes'], [15, 'files'], [13, 'trash'], [13, 'calc']] as const) {
      await padButton(page, btn);
      await expect.poll(async () => (await osState(page)).focus).toBe(`icon:${id}`);
    }
    await padButton(page, 0);
    await expect.poll(async () => (await osState(page)).focus).toBe('calc:key:7');
    await padButton(page, 15); // rechts
    await expect.poll(async () => (await osState(page)).focus).toBe('calc:key:8');
    await padButton(page, 0);
    await expect.poll(() => calcDisplay(page)).toBe('8');
    await shot(page, info, 'os-gamepad');
    await padButton(page, 1); // B = Aufstehen
    await expect.poll(async () => (await office(page)).seated).toBeNull();
    expect(errors).toEqual([]);
  });

  test('Touch: Apps antippen, Wischen wechselt, langes Drücken = Kontextmenü, Aufstehen', async ({ page }, info) => {
    test.slow();
    test.skip(!isTouchProject(info), 'nur Touch-Geräte');
    const errors = collectErrors(page);
    await openGame(page);
    await sitAtDesk(page, true);
    const phone = (await hook<string>(page, 'formFactor')) === 'phone';
    const os = await osState(page);
    // Handys: Apps im Vollbild mit App-Umschalter; Tablets: normaler Desktop.
    expect(os.compact).toBe(phone);
    await shot(page, info, 'os-touch-desktop');

    await tap(page, 'icon:calc');
    await expect.poll(async () => (await osWindow(page, 'calc'))?.active).toBe(true);
    if (phone) expect(Math.round((await osWindow(page, 'calc'))!.rect.w)).toBe(Math.round(os.area.w));
    await tap(page, 'calc:key:4');
    await tap(page, 'calc:key:2');
    await expect.poll(() => calcDisplay(page)).toBe('42');
    await shot(page, info, 'os-touch-calc');

    // Zweite App öffnen (Handy: über den Startbildschirm).
    if (phone) await tap(page, 'tb:start');
    await tap(page, 'icon:weather');
    await expect.poll(async () => (await osWindow(page, 'weather'))?.active).toBe(true);
    await shot(page, info, 'os-touch-weather');

    if (phone) {
      // Wischen über das Fenster wechselt zur anderen App.
      const w = (await osWindow(page, 'weather'))!.rect;
      const y = w.y + w.h * 0.6;
      await touchSwipe(page, { x: w.x + w.w * 0.85, y }, { x: w.x + w.w * 0.15, y });
      await expect.poll(async () => (await osWindow(page, 'calc'))?.active).toBe(true);
      await tap(page, 'tb:start');
    }

    // Langes Drücken auf ein Symbol öffnet das Kontextmenü (Notizen: erste Spalte, nie verdeckt).
    const icon = await osTarget(page, 'icon:notes');
    await touchDrag(page, icon, icon, async () => {
      await page.waitForTimeout(700);
      await nextFrames(page, 2);
      return true;
    });
    await expect.poll(async () => (await osState(page)).ctx).toBe(true);
    await shot(page, info, 'os-touch-context');
    await tap(page, 'ctx:open');
    await expect.poll(async () => (await osWindow(page, 'notes'))?.active).toBe(true);

    await tap(page, 'tb:leave');
    await expect.poll(async () => (await office(page)).seated).toBeNull();
    expect((await office(page)).desktop).toBe(false);
    expect(errors).toEqual([]);
  });
});

import { expect, test, type Page } from '@playwright/test';
import { collectErrors, hook, openGame, osState, osTarget, osWindow, shot, sitAtDesk } from './helpers';

interface PhoneState {
  mode: string;
  callerId: string | null;
  trust: number | null;
  phase: string | null;
  scheme: string | null;
  pitchTrust: number | null;
  need: number | null;
  outcome: string | null;
  transcript: { who: string; text: string }[];
}

interface LootState {
  callerId: string;
  schemeId: string;
  kind: string;
  value: string;
  amount: number;
  input: string;
  status: string;
  attempts: number;
  bait: boolean;
}

interface CallsState {
  loot: LootState[];
  team: number;
  schemes: (string | null)[];
  dossier: Record<string, { calls: number; likes: string[] }>;
  plauder: { handle: string; unread: number; messages: number }[];
}

const phone = async (page: Page): Promise<PhoneState | undefined> => (await osWindow(page, 'phone'))?.state as PhoneState | undefined;
const calls = (page: Page): Promise<CallsState> => hook<CallsState>(page, 'calls');
const appState = async <T>(page: Page, app: string): Promise<T> => (await osWindow(page, app))?.state as T;

async function click(page: Page, id: string): Promise<void> {
  const p = await osTarget(page, id);
  await page.mouse.click(p.x, p.y);
}

async function dbl(page: Page, id: string): Promise<void> {
  const p = await osTarget(page, id);
  await page.mouse.dblclick(p.x, p.y);
}

/** Zeile einer Liste doppelklicken (0 = oberste), über das Fokus-Rechteck der Auswahl. */
async function dblRow(page: Page, listId: string, row: number): Promise<void> {
  const t = (await osState(page)).targets.find((x) => x.id === listId)!;
  await page.mouse.dblclick(t.x + t.w / 2, t.y + t.h / 2 + row * t.h);
}

async function active(page: Page, app: string): Promise<void> {
  await expect.poll(async () => (await osWindow(page, app))?.active).toBe(true);
}

/** Ins (einzige) Eingabefeld des aktiven Fensters tippen und abschicken. */
async function typeInto(page: Page, text: string): Promise<void> {
  // Ganzer Text auf einmal (Tastendruck für Tastendruck dauert im Software-Rendering zu lange).
  const input = page.locator('#os-text-input');
  await expect(input).toBeVisible();
  await input.fill(text);
  await input.press('Enter');
}

/** Satz ins Telefon sagen und auf die Antwort warten. */
async function say(page: Page, text: string): Promise<void> {
  if (process.env['T_LOG']) console.log(Date.now() % 1000000, 'say', text.slice(0, 20));
  const before = (await phone(page))!.transcript.length;
  await typeInto(page, text);
  await expect.poll(async () => (await phone(page))?.transcript.length ?? 0).toBeGreaterThan(before + 1);
}

/** Freundlich reden, bis das Vertrauen reicht. */
async function warmUp(page: Page, lines: string[], target: (p: PhoneState) => number): Promise<void> {
  for (const line of lines) {
    const p = (await phone(page))!;
    if ((p.trust ?? 0) >= target(p)) return;
    await say(page, line);
  }
  const p = (await phone(page))!;
  expect(p.trust ?? 0).toBeGreaterThanOrEqual(target(p));
}

const HILDEGARD = [
  'Guten Tag, Frau Sonnenschein! Wie geht es denn Ihrer Katze Mausi?',
  'Sie haben so eine sympathische, freundliche Stimme.',
  'Backen Sie am Wochenende wieder Streuselkuchen?',
  'Ihr Garten blüht bestimmt wunderschön, Sie haben sicher einen grünen Daumen.',
  'Trinken Sie lieber Kaffee mit Milch oder schwarz?',
  'Erzählen Sie doch mal von Ihrer Familie und den Enkeln.',
];

const desktopOnly = (info: { project: { name: string } }): boolean => info.project.name !== 'desktop';

test.describe('Maschen', () => {
  test('Rentennummer-Raffer: Masche wählen, Pitch, Diktat, Ident-o-Mat zahlt aus, Kundenkartei', async ({ page }, info) => {
    test.slow();
    test.skip(desktopOnly(info), 'Tastatur/Maus, DPR-unabhängig');
    const errors = collectErrors(page);
    await openGame(page, '?ring=hildegard&seed=7');
    await sitAtDesk(page, false);
    // Vor dem Abheben: Masche in der Übersicht wählen (SCH-17).
    await dbl(page, 'icon:schemes');
    await active(page, 'schemes');
    await dblRow(page, 'schemes:list', 0);
    await active(page, 'script');
    expect((await osWindow(page, 'script'))!.title).toBe('Rentennummer-Raffer 98');
    await click(page, 'script:rentennummer:use');
    await expect.poll(async () => (await calls(page)).schemes).toContain('rentennummer');
    expect((await appState<{ chosen: boolean }>(page, 'script')).chosen).toBe(true);
    await shot(page, info, 'scheme-script');
    // Abheben: Das Gespräch übernimmt die Masche.
    await page.keyboard.press('KeyE');
    await expect.poll(async () => (await phone(page))?.mode).toBe('call');
    expect((await phone(page))!.scheme).toBe('rentennummer');
    // Vertrauen, dann die Geschichte, dann die Forderung (CAL-14).
    await warmUp(page, HILDEGARD, (p) => p.pitchTrust ?? 0);
    await say(page, 'Ihre Rente wird erhöht, das Rentenamt hat eine Nachzahlung für Sie.');
    await expect.poll(async () => (await phone(page))?.phase).toBe('forderung');
    // Vorliebe ansprechen: landet in der Kundenkartei.
    await say(page, 'Backen Sie am Wochenende wieder Streuselkuchen?');
    await warmUp(page, HILDEGARD.slice(3), (p) => p.need ?? 100);
    await say(page, 'Bitte lesen Sie mir Ihre Bürgernummer vor.');
    await expect.poll(async () => (await calls(page)).loot.length).toBe(1);
    const loot = (await calls(page)).loot[0]!;
    expect(loot).toMatchObject({ callerId: 'hildegard', schemeId: 'rentennummer', kind: 'nummer', input: 'identomat', status: 'pending' });
    // Der Anruf läuft weiter (Beute-Phase), das Diktat steht im Verlauf.
    expect((await phone(page))!.mode).toBe('call');
    await expect.poll(async () => (await osState(page)).toasts.some((t) => t.title === 'Notiert!')).toBe(true);
    await shot(page, info, 'scheme-phone');
    // Kundenkartei: Hildegard steht oben, mit dem Herausgefundenen.
    await dbl(page, 'icon:kartei');
    await active(page, 'kartei');
    await expect.poll(async () => (await appState<{ callers: string[]; selected: string }>(page, 'kartei')).selected).toBe('hildegard');
    expect((await calls(page)).dossier['hildegard']!.likes).toContain('kuchen');
    await shot(page, info, 'kartei');
    // Ident-o-Mat: einmal vertippt, dann richtig (SCH-19/20).
    await dbl(page, 'icon:identomat');
    await active(page, 'identomat');
    await typeInto(page, 'ZZ-0000');
    await expect.poll(async () => (await appState<{ status: string }>(page, 'identomat')).status).toContain('Noch 2 Versuche');
    expect((await calls(page)).loot[0]!.attempts).toBe(1);
    await typeInto(page, loot.value.toLowerCase());
    await expect.poll(async () => (await calls(page)).loot[0]!.status).toBe('paid');
    const paid = (await calls(page)).loot[0]!.amount;
    expect(paid).toBeGreaterThanOrEqual(250);
    expect((await calls(page)).team).toBe(paid);
    await expect.poll(async () => (await osState(page)).toasts.some((t) => t.title.startsWith('Ausgezahlt'))).toBe(true);
    await shot(page, info, 'identomat');
    // Auflegen mit Beute = Erfolg.
    await click(page, 'tb:win:phone');
    await active(page, 'phone');
    await click(page, 'phone:hangup');
    await expect.poll(async () => (await phone(page))?.outcome).toBe('success');
    expect(errors).toEqual([]);
  });

  test('FernGucker: Guck-Code, Opfer-PC mit verdächtigem Klick, Überweisung an die Treuhand', async ({ page }, info) => {
    test.slow();
    test.skip(desktopOnly(info), 'Tastatur/Maus, DPR-unabhängig');
    const errors = collectErrors(page);
    await openGame(page, '?ring=hildegard&seed=7');
    await sitAtDesk(page, false);
    await page.keyboard.press('KeyE');
    await expect.poll(async () => (await phone(page))?.mode).toBe('call');
    // Während des Anrufs: Maschen-Knopf im Telefon → Übersicht → FernGucker-Support.
    await click(page, 'phone:scheme');
    await active(page, 'schemes');
    await dblRow(page, 'schemes:list', 1);
    await active(page, 'script');
    await click(page, 'script:ferngucker:use');
    await expect.poll(async () => (await calls(page)).schemes).toContain('ferngucker');
    await click(page, 'tb:win:phone');
    await active(page, 'phone');
    expect((await phone(page))!.scheme).toBe('ferngucker');
    await warmUp(page, HILDEGARD, (p) => p.pitchTrust ?? 0);
    await say(page, 'Ihr Computer hat leider einen Virus, ich muss Ihren Computer reparieren.');
    await expect.poll(async () => (await phone(page))?.phase).toBe('forderung');
    await warmUp(page, HILDEGARD.slice(2), (p) => p.need ?? 100);
    await say(page, 'Nennen Sie mir bitte den Guck-Code.');
    await expect.poll(async () => (await calls(page)).loot.length).toBe(1);
    const loot = (await calls(page)).loot[0]!;
    expect(loot).toMatchObject({ kind: 'code', input: 'ferngucker', status: 'pending' });
    // Fernzugriff auf Hildegards PC.
    await dbl(page, 'icon:ferngucker');
    await active(page, 'ferngucker');
    await typeInto(page, loot.value);
    await expect.poll(async () => (await appState<{ mode: string }>(page, 'ferngucker')).mode).toBe('pc');
    await shot(page, info, 'ferngucker-pc');
    // Private Datei anklicken: „Was machen Sie mit meiner Maus?!“ kostet Vertrauen.
    const before = (await phone(page))!.trust!;
    await click(page, 'ferngucker:pc:file0');
    await expect.poll(async () => (await phone(page))!.trust!).toBeLessThan(before);
    // Online-Banking: Empfänger wechseln, bis die Treuhand dran ist, dann überweisen.
    await click(page, 'ferngucker:pc:bank');
    await expect.poll(async () => (await appState<{ mode: string }>(page, 'ferngucker')).mode).toBe('bank');
    for (let i = 0; i < 3 && (await appState<{ recipient: string }>(page, 'ferngucker')).recipient !== 'masche'; i++) {
      await click(page, 'ferngucker:bank:recipient');
    }
    expect((await appState<{ recipient: string }>(page, 'ferngucker')).recipient).toBe('masche');
    await click(page, 'ferngucker:bank:more');
    await expect.poll(async () => (await appState<{ amount: number }>(page, 'ferngucker')).amount).toBe(150);
    await shot(page, info, 'ferngucker-bank');
    await click(page, 'ferngucker:bank:transfer');
    await expect.poll(async () => (await calls(page)).loot[0]!.status).toBe('paid');
    expect((await calls(page)).loot[0]!.amount).toBe(150);
    expect((await calls(page)).team).toBe(150);
    expect((await appState<{ mode: string; entry: { status: string } }>(page, 'ferngucker')).entry.status).toContain('überwiesen');
    expect(errors).toEqual([]);
  });

  test('Turbo-Geschenk: Geschenk in der Plauderbude, Login-Code vom Köder fliegt auf', async ({ page }, info) => {
    test.slow();
    test.skip(desktopOnly(info), 'Tastatur/Maus, DPR-unabhängig');
    const errors = collectErrors(page);
    await openGame(page, '?ring=kevin&seed=7');
    await sitAtDesk(page, false);
    await page.keyboard.press('KeyE');
    await expect.poll(async () => (await phone(page))?.mode).toBe('call');
    await click(page, 'phone:scheme');
    await active(page, 'schemes');
    await dblRow(page, 'schemes:list', 2);
    await active(page, 'script');
    await click(page, 'script:turbo:use');
    await click(page, 'tb:win:phone');
    await active(page, 'phone');
    const kevin = ['Hallo Kevin, wie läuft das Zocken?', 'Du kennst dich echt super mit Technik aus.', 'Was isst du am liebsten, Pizza oder Burger?', 'Spielst du gerade ein neues Spiel?'];
    await warmUp(page, kevin, (p) => p.pitchTrust ?? 0);
    await say(page, 'Sie haben ein Turbo-Geschenk in der Plauderbude gewonnen!');
    await expect.poll(async () => (await phone(page))?.phase).toBe('forderung');
    // Ohne Geschenk gibt es keinen Code.
    await say(page, 'Lesen Sie mir bitte Ihren Code vor.');
    expect((await calls(page)).loot).toHaveLength(0);
    // Plauderbude über die Skript-App öffnen: Kevins Kontakt steht oben.
    await click(page, 'tb:win:script:turbo');
    await active(page, 'script');
    await click(page, 'script:turbo:target');
    await active(page, 'plauder');
    await expect.poll(async () => (await appState<{ selected: string }>(page, 'plauder')).selected).toBe('caller:kevin');
    expect((await calls(page)).plauder.filter((c) => !c.handle.startsWith('caller:'))).toHaveLength(8);
    const lines = (await phone(page))!.transcript.length;
    await click(page, 'plauder:gift');
    await expect.poll(async () => (await appState<{ giftEnabled: boolean }>(page, 'plauder')).giftEnabled).toBe(false);
    await expect.poll(async () => (await phone(page))!.transcript.length).toBeGreaterThan(lines);
    await shot(page, info, 'plauder');
    // Jetzt rückt Kevin einen Code heraus – als Köder.
    await click(page, 'tb:win:phone');
    await active(page, 'phone');
    await warmUp(page, kevin.slice(2), (p) => p.need ?? 100);
    await say(page, 'Lesen Sie mir bitte Ihren Code vor.');
    await expect.poll(async () => (await calls(page)).loot.length).toBe(1);
    const loot = (await calls(page)).loot[0]!;
    expect(loot).toMatchObject({ input: 'plauderbude', bait: true });
    await click(page, 'tb:win:plauder');
    await active(page, 'plauder');
    await click(page, 'plauder:tab:1');
    await typeInto(page, loot.value);
    await expect.poll(async () => (await calls(page)).loot[0]!.status).toBe('failed');
    expect((await appState<{ entry: { status: string } }>(page, 'plauder')).entry.status).toContain('Fälschung');
    expect((await calls(page)).team).toBe(0);
    expect(errors).toEqual([]);
  });

  test('Atlantis-Lotto: Zahlungs-Code in der Skript-App verbuchen', async ({ page }, info) => {
    test.slow();
    test.skip(desktopOnly(info), 'Tastatur/Maus, DPR-unabhängig');
    const errors = collectErrors(page);
    await openGame(page, '?ring=rosi&seed=7');
    await sitAtDesk(page, false);
    await dbl(page, 'icon:schemes');
    await active(page, 'schemes');
    await dblRow(page, 'schemes:list', 7);
    await active(page, 'script');
    await click(page, 'script:atlantis:use');
    await page.keyboard.press('KeyE');
    await expect.poll(async () => (await phone(page))?.scheme).toBe('atlantis');
    const rosi = ['Guten Tag! Wohin geht denn Ihre nächste Reise?', 'Sie haben so eine sympathische Stimme.', 'Erzählen Sie doch von Ihrer Familie.', 'Backen Sie gern Kuchen?'];
    await warmUp(page, rosi, (p) => p.pitchTrust ?? 0);
    await say(page, 'Sie haben in der Unterwasser-Lotterie von Atlantis gewonnen!');
    await expect.poll(async () => (await phone(page))?.phase).toBe('forderung');
    await warmUp(page, rosi.slice(2), (p) => p.need ?? 100);
    await say(page, 'Nennen Sie mir bitte den Zahlungs-Code für die kleine Gebühr.');
    await expect.poll(async () => (await calls(page)).loot.length).toBe(1);
    const loot = (await calls(page)).loot[0]!;
    expect(loot).toMatchObject({ schemeId: 'atlantis', kind: 'geld', input: 'script', status: 'pending' });
    await click(page, 'tb:win:script:atlantis');
    await active(page, 'script');
    await typeInto(page, loot.value);
    await expect.poll(async () => (await calls(page)).loot[0]!.status).toBe('paid');
    expect((await calls(page)).team).toBeGreaterThanOrEqual(350);
    await shot(page, info, 'script-paid');
    expect(errors).toEqual([]);
  });

  test('Gutschein-Gaudi: Gutscheincode mit Betrag in der Gutschein-Kasse einlösen', async ({ page }, info) => {
    test.slow();
    test.skip(desktopOnly(info), 'Tastatur/Maus, DPR-unabhängig');
    const errors = collectErrors(page);
    await openGame(page, '?ring=hildegard&seed=7');
    await sitAtDesk(page, false);
    await dbl(page, 'icon:schemes');
    await active(page, 'schemes');
    await dblRow(page, 'schemes:list', 3);
    await active(page, 'script');
    await click(page, 'script:gutschein:use');
    await page.keyboard.press('KeyE');
    await expect.poll(async () => (await phone(page))?.scheme).toBe('gutschein');
    await warmUp(page, HILDEGARD, (p) => p.pitchTrust ?? 0);
    await say(page, 'Gehen Sie bitte zum Kiosk und begleichen Sie das dort.');
    await expect.poll(async () => (await phone(page))?.phase).toBe('forderung');
    await warmUp(page, HILDEGARD.slice(2), (p) => p.need ?? 100);
    await say(page, 'Lesen Sie mir bitte den Gutscheincode vor.');
    await expect.poll(async () => (await calls(page)).loot.length).toBe(1);
    const loot = (await calls(page)).loot[0]!;
    expect(loot).toMatchObject({ kind: 'gutschein', input: 'gutschein' });
    expect(loot.amount).toBeGreaterThanOrEqual(80);
    await dbl(page, 'icon:voucher');
    await active(page, 'voucher');
    await typeInto(page, loot.value);
    await expect.poll(async () => (await calls(page)).loot[0]!.status).toBe('paid');
    expect((await calls(page)).team).toBe(loot.amount);
    await shot(page, info, 'voucher');
    expect(errors).toEqual([]);
  });

  test('Handy: alle Symbole auf dem Startbildschirm, Masche per Tippen wählen', async ({ page }, info) => {
    test.slow();
    test.skip(info.project.name !== 'phone-landscape', 'Handy-Oberfläche');
    const errors = collectErrors(page);
    await openGame(page);
    await sitAtDesk(page, true);
    const os = await osState(page);
    expect(os.compact).toBe(true);
    expect(os.icons.length).toBeGreaterThanOrEqual(13);
    for (const ic of os.icons) expect(ic.rect.y + ic.rect.h).toBeLessThanOrEqual(os.area.y + os.area.h + 1);
    const tap = async (id: string): Promise<void> => {
      const p = await osTarget(page, id);
      await page.touchscreen.tap(p.x, p.y);
    };
    await tap('icon:schemes');
    await active(page, 'schemes');
    await tap('schemes:list');
    await active(page, 'script');
    await tap('script:rentennummer:use');
    await expect.poll(async () => (await calls(page)).schemes).toContain('rentennummer');
    await shot(page, info, 'scheme-script');
    expect(errors).toEqual([]);
  });
});

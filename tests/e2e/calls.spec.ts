import { expect, test, type Page } from '@playwright/test';
import {
  collectErrors,
  DESK7_PATH,
  enterOfficeByKeyboard,
  enterOfficeByTouch,
  hook,
  installFakePad,
  isTouchProject,
  office,
  openGame,
  osState,
  osTarget,
  osWindow,
  padButton,
  padPulse,
  shot,
  sitAtDesk,
  touchSwipe,
  waitOsReady,
  walkPath,
} from './helpers';

interface PhoneState {
  mode: string;
  callerId: string | null;
  trust: number | null;
  mood: string | null;
  hold: boolean;
  speaker: boolean;
  speaking: boolean;
  outcome: string | null;
  cards: string[];
  transcript: { who: string; text: string; shown: number; dTrust: number | null }[];
  typing: boolean;
  inputRect: { x: number; y: number; w: number; h: number } | null;
  listening: boolean;
  interim: string;
  history: string[];
}

async function phone(page: Page): Promise<PhoneState | undefined> {
  return (await osWindow(page, 'phone'))?.state as PhoneState | undefined;
}

async function click(page: Page, id: string): Promise<void> {
  const p = await osTarget(page, id);
  await page.mouse.click(p.x, p.y);
}

interface CallsState {
  views: { desk: number; kind: string; callerId?: string }[];
  history: { desk: number; callerId: string; outcome: string; trust: number }[];
  notes: { text: string; from: string | null }[];
  arrows: number;
}

const calls = (page: Page): Promise<CallsState> => hook<CallsState>(page, 'calls');
const popupOf = async (page: Page): Promise<{ callerId: string } | null> => ((await osState(page)) as unknown as { popup: { callerId: string } | null }).popup;

/**
 * Ersetzt Sprachausgabe und Spracherkennung des Browsers durch Attrappen (Headless-Chromium hat
 * keine deutschen Stimmen und kein Mikrofon): eine deutsche Stimme, eine Erkennung, die beim
 * Loslassen „Guten Tag Frau Sonnenschein“ liefert.
 */
async function installFakeSpeech(page: Page): Promise<void> {
  await page.addInitScript(() => {
    class FakeUtterance {
      voice: unknown = null;
      lang = '';
      pitch = 1;
      rate = 1;
      volume = 1;
      constructor(public text: string) {}
    }
    const voices = [{ name: 'Test Katja', lang: 'de-DE', localService: true, default: true, voiceURI: 'katja' }];
    const synth = { speaking: false, getVoices: () => voices, speak: () => undefined, cancel: () => undefined, addEventListener: () => undefined };
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: FakeUtterance, configurable: true });
    type Handler = ((e: unknown) => void) | null;
    class FakeRecognition {
      lang = '';
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onresult: Handler = null;
      onerror: Handler = null;
      onend: (() => void) | null = null;
      start(): void {
        setTimeout(() => this.onresult?.({ resultIndex: 0, results: [{ isFinal: false, 0: { transcript: 'Guten Tag' } }] }), 150);
      }
      stop(): void {
        setTimeout(() => {
          this.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: 'Guten Tag Frau Sonnenschein' } }] });
          this.onend?.();
        }, 50);
      }
      abort(): void {
        this.onend?.();
      }
    }
    Object.defineProperty(window, 'SpeechRecognition', { value: FakeRecognition, configurable: true });
    Object.defineProperty(window, 'webkitSpeechRecognition', { value: FakeRecognition, configurable: true });
  });
}

test.describe('Anrufe', () => {
  test('Desktop: Klingeln, annehmen, tippen, Karte, halten, auflegen', async ({ page }, info) => {
    test.slow();
    test.skip(isTouchProject(info), 'Tastatur und Maus');
    const errors = collectErrors(page);
    await openGame(page, '?ring=hildegard&seed=7');
    await sitAtDesk(page, false);
    await expect.poll(async () => ((await osState(page)) as unknown as { popup: { callerId: string } | null }).popup?.callerId).toBe('hildegard');
    await shot(page, info, 'call-popup');
    await page.keyboard.press('KeyE');
    await expect.poll(async () => (await phone(page))?.mode).toBe('call');
    // Untertitel laufen im Logik-Takt (bei Software-Rendering langsamer); Eingaben gehen trotzdem sofort.
    await expect.poll(async () => (await phone(page))?.transcript[0]?.shown ?? 0).toBeGreaterThan(10);
    await shot(page, info, 'call-phone');

    // Tastatur: Das Eingabefeld hat schon den Fokus – einfach tippen, Enter sendet.
    await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('os-text-input');
    await page.keyboard.type('Guten Tag, Frau Sonnenschein! Wie geht es Ihrer Katze?');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await phone(page))?.transcript.filter((l) => l.who === 'player').length).toBe(1);
    const said = (await phone(page))!.transcript.find((l) => l.who === 'player')!;
    expect(said.text).toContain('Sonnenschein');
    expect(said.dTrust).toBeGreaterThan(0);
    await expect.poll(async () => (await phone(page))?.transcript.at(-1)?.who).toBe('caller');

    // Taste 1 im leeren Feld sagt die erste Karte.
    const card = (await phone(page))!.cards[0]!;
    await page.keyboard.press('Digit1');
    await expect.poll(async () => (await phone(page))?.transcript.some((l) => l.who === 'player' && l.text === card)).toBe(true);

    // Halten (Warteschleife) und zurückholen.
    await click(page, 'phone:hold');
    await expect.poll(async () => (await phone(page))?.hold).toBe(true);
    await shot(page, info, 'call-hold');
    await click(page, 'phone:hold');
    await expect.poll(async () => (await phone(page))?.hold).toBe(false);

    // Auflegen: Verlauf bleibt, „Fertig“ führt zur Anrufliste.
    await click(page, 'phone:hangup');
    await expect.poll(async () => (await phone(page))?.mode).toBe('ended');
    expect((await phone(page))!.outcome).toBe('playerHangup');
    await shot(page, info, 'call-ended');
    await click(page, 'phone:done');
    await expect.poll(async () => (await phone(page))?.mode).toBe('idle');
    expect((await phone(page))!.history.length).toBe(1);
    const calls = await hook<{ history: { callerId: string; outcome: string }[] }>(page, 'calls');
    expect(calls.history).toEqual([expect.objectContaining({ callerId: 'hildegard', outcome: 'playerHangup' })]);
    expect(errors).toEqual([]);
  });

  test('Touch: Wischen nimmt an, Karten sind die Hauptsteuerung, Tippen zuschaltbar', async ({ page }, info) => {
    test.slow();
    test.skip(!isTouchProject(info), 'Touch-Bedienung');
    const errors = collectErrors(page);
    await openGame(page, '?ring=rosi&seed=11');
    await sitAtDesk(page, true);
    let popup: { rect: { x: number; y: number; w: number; h: number } } | null = null;
    await expect
      .poll(async () => {
        popup = ((await osState(page)) as unknown as { popup: typeof popup }).popup;
        return popup !== null;
      })
      .toBe(true);
    await shot(page, info, 'call-popup');
    // Wischen nach oben über das Popup nimmt an.
    const r = popup!.rect;
    await touchSwipe(page, { x: r.x + r.w * 0.3, y: r.y + r.h * 0.45 }, { x: r.x + r.w * 0.3, y: r.y + 4 }, 150);
    await expect.poll(async () => (await phone(page))?.mode).toBe('call');
    const compact = (await osState(page)).compact;
    // Auf dem Handy: nur Karten, das Eingabefeld ist aus, bis man „Tippen“ antippt.
    if (compact) expect((await phone(page))!.typing).toBe(false);
    // Bei niedriger Bildrate (Software-Rendering) laufen Untertitel langsamer; Karten gehen trotzdem sofort.
    await expect.poll(async () => (await phone(page))?.transcript.length ?? 0).toBeGreaterThan(0);
    await shot(page, info, 'call-phone');
    const card = (await phone(page))!.cards[1]!;
    const c = await osTarget(page, 'phone:card:1');
    await page.touchscreen.tap(c.x, c.y);
    await expect.poll(async () => (await phone(page))?.transcript.some((l) => l.who === 'player' && l.text === card)).toBe(true);
    if (compact) {
      const k = await osTarget(page, 'phone:kbd');
      await page.touchscreen.tap(k.x, k.y);
      await expect.poll(async () => (await phone(page))?.typing).toBe(true);
    }
    const ir = (await phone(page))!.inputRect!;
    await page.touchscreen.tap(ir.x + ir.w / 2, ir.y + ir.h / 2);
    await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('os-text-input');
    await page.keyboard.type('Haben Sie schon mal eine Kreuzfahrt gemacht?');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await phone(page))?.transcript.filter((l) => l.who === 'player').length).toBe(2);
    await shot(page, info, 'call-typing');
    const h = await osTarget(page, 'phone:hangup');
    await page.touchscreen.tap(h.x, h.y);
    await expect.poll(async () => (await phone(page))?.mode).toBe('ended');
    expect(errors).toEqual([]);
  });

  test('Stimme und Mikrofon: Sprachausgabe je Figur, Halten-zum-Sprechen per Taste und Knopf', async ({ page }, info) => {
    test.slow();
    test.skip(isTouchProject(info) || info.project.name === 'desktop-hidpi', 'Tastatur/Maus, DPR-unabhängig');
    const errors = collectErrors(page);
    await installFakeSpeech(page);
    await openGame(page, '?ring=hildegard&seed=7');
    await sitAtDesk(page, false);
    await expect.poll(async () => (await popupOf(page))?.callerId).toBe('hildegard');
    await page.keyboard.press('KeyE');
    await expect.poll(async () => (await phone(page))?.mode).toBe('call');
    // Die Anruferin spricht (Sprachsynthese mit deutscher Stimme statt Brabbeln).
    await expect.poll(async () => (await hook<{ usable: boolean; spoken: string[] }>(page, 'voice')).spoken.length).toBeGreaterThan(0);
    expect((await hook<{ usable: boolean }>(page, 'voice')).usable).toBe(true);
    // Esc verlässt das Eingabefeld; danach ist V wieder Halten-zum-Sprechen.
    await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('os-text-input');
    await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => document.activeElement?.id ?? '')).not.toBe('os-text-input');
    expect(await hook<boolean>(page, 'paused')).toBe(false);
    await page.keyboard.down('KeyV');
    await expect.poll(async () => (await phone(page))?.listening).toBe(true);
    await expect.poll(async () => (await phone(page))?.interim).toContain('Guten Tag');
    await shot(page, info, 'call-listening');
    await page.keyboard.up('KeyV');
    await expect.poll(async () => (await phone(page))?.transcript.filter((l) => l.who === 'player').map((l) => l.text)).toEqual(['Guten Tag Frau Sonnenschein']);
    expect((await phone(page))!.listening).toBe(false);
    // Mikrofon-Knopf gedrückt halten.
    const m = await osTarget(page, 'phone:mic');
    await page.mouse.move(m.x, m.y);
    await page.mouse.down();
    await expect.poll(async () => (await phone(page))?.listening).toBe(true);
    await page.mouse.up();
    await expect.poll(async () => (await phone(page))?.transcript.filter((l) => l.who === 'player').length).toBe(2);
    // Lautsprecher umschalten.
    await click(page, 'phone:speaker');
    await expect.poll(async () => (await phone(page))?.speaker).toBe(true);
    expect(errors).toEqual([]);
  });

  test('Gamepad: A nimmt an, A sagt die Karte, X hält, LT legt auf', async ({ page }, info) => {
    test.slow();
    test.skip(isTouchProject(info) || info.project.name === 'desktop-hidpi', 'Gamepad am Desktop, DPR-unabhängig');
    const errors = collectErrors(page);
    await installFakePad(page);
    await openGame(page, '?ring=benedikt&seed=5');
    await padButton(page, 0);
    await padButton(page, 0);
    await expect.poll(async () => (await office(page))?.zoom ?? 0).toBeGreaterThan(0);
    await walkPath(page, DESK7_PATH, padPulse(page));
    await expect.poll(async () => (await office(page)).focus).toBe('desk7');
    await padButton(page, 0);
    await waitOsReady(page);
    await expect.poll(async () => (await popupOf(page))?.callerId).toBe('benedikt');
    await padButton(page, 0);
    await expect.poll(async () => (await phone(page))?.mode).toBe('call');
    await expect.poll(async () => (await osState(page)).focus).toBe('phone:card:0');
    const card = (await phone(page))!.cards[0]!;
    await padButton(page, 0);
    await expect.poll(async () => (await phone(page))?.transcript.some((l) => l.who === 'player' && l.text === card)).toBe(true);
    await padButton(page, 2);
    await expect.poll(async () => (await phone(page))?.hold).toBe(true);
    await padButton(page, 2);
    await expect.poll(async () => (await phone(page))?.hold).toBe(false);
    await padButton(page, 6);
    await expect.poll(async () => (await phone(page))?.mode).toBe('ended');
    expect(errors).toEqual([]);
  });

  test('Notizblock: Beute wird automatisch notiert, eigene Notizen lassen sich anlegen und löschen', async ({ page }, info) => {
    test.slow();
    test.skip(isTouchProject(info) || info.project.name === 'desktop-hidpi', 'Tastatur/Maus, DPR-unabhängig');
    const errors = collectErrors(page);
    await openGame(page, '?ring=hildegard&seed=7');
    await sitAtDesk(page, false);
    await page.keyboard.press('KeyE');
    await expect.poll(async () => (await phone(page))?.mode).toBe('call');
    await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('os-text-input');
    // Freundlich Vertrauen aufbauen, dann nach der Nummer fragen.
    const friendly = [
      'Guten Tag, Frau Sonnenschein! Wie geht es denn Ihrer Katze Mausi?',
      'Sie haben so eine sympathische, freundliche Stimme.',
      'Backen Sie am Wochenende wieder Streuselkuchen?',
      'Ihr Garten blüht bestimmt wunderschön, Sie haben sicher einen grünen Daumen.',
      'Das tut mir leid, ich verstehe Sie gut. Ich höre Ihnen gern zu.',
      'Trinken Sie lieber Kaffee mit Milch oder schwarz?',
      'Erzählen Sie doch mal von Ihrer Familie und den Enkeln.',
    ];
    for (const line of friendly) {
      if (((await phone(page))?.trust ?? 0) >= 66) break;
      const before = (await phone(page))!.transcript.length;
      await page.keyboard.type(line);
      await page.keyboard.press('Enter');
      await expect.poll(async () => (await phone(page))?.transcript.length ?? 0).toBeGreaterThan(before + 1);
    }
    expect((await phone(page))!.trust).toBeGreaterThanOrEqual(60);
    await page.keyboard.type('Bitte lesen Sie mir Ihre Bürgernummer vor.');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await calls(page)).notes.length).toBe(1);
    expect((await calls(page)).notes[0]!.from).toBe('hildegard');
    await expect.poll(async () => (await osState(page)).toasts.some((t) => t.title === 'Notiert!')).toBe(true);
    // Mit der Beute ist das Gespräch nicht vorbei: Verabschieden beendet es erfolgreich.
    expect((await phone(page))!.mode).toBe('call');
    await page.keyboard.type('Vielen Dank, auf Wiederhören!');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await phone(page))?.outcome).toBe('success');
    await shot(page, info, 'call-success');
    // Notizblock öffnen und eine eigene Notiz anlegen.
    const ni = await osTarget(page, 'icon:notes');
    await page.mouse.dblclick(ni.x, ni.y);
    await expect.poll(async () => (await osWindow(page, 'notes'))?.active).toBe(true);
    const box = await page.locator('#os-text-input').boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.keyboard.type('Rückruf bei Rosi, Kreuzfahrt-Thema!');
    await page.keyboard.press('Enter');
    await expect.poll(async () => ((await osWindow(page, 'notes'))?.state as { notes: unknown[] }).notes.length).toBe(2);
    await shot(page, info, 'notes');
    // Neueste steht oben: auswählen und löschen.
    await click(page, 'notes:list');
    await click(page, 'notes:delete');
    await expect.poll(async () => ((await osWindow(page, 'notes'))?.state as { notes: { from: string | null }[] }).notes).toEqual([expect.objectContaining({ from: 'hildegard' })]);
    expect(errors).toEqual([]);
  });

  test('Systemsteuerung „Sprache“: Stimmen-Modus und Mikrofon-Modus werden gespeichert', async ({ page }, info) => {
    test.slow();
    test.skip(isTouchProject(info) || info.project.name === 'desktop-hidpi', 'Maus, DPR-unabhängig');
    const errors = collectErrors(page);
    await openGame(page);
    await sitAtDesk(page, false);
    await click(page, 'tb:start');
    await click(page, 'start:settings');
    await click(page, 'settings:tab:2');
    await click(page, 'settings:voice:babble');
    await click(page, 'settings:mic:auto');
    const st = async (): Promise<Record<string, unknown>> => (await osWindow(page, 'settings'))!.state as Record<string, unknown>;
    await expect.poll(async () => (await st())['voiceMode']).toBe('babble');
    await expect.poll(async () => (await st())['micMode']).toBe('auto');
    await shot(page, info, 'settings-voice');
    const saved = await page.evaluate(() => localStorage.getItem('masche.settings.v1') ?? '');
    expect(saved).toContain('"voiceMode":"babble"');
    expect(saved).toContain('"micMode":"auto"');
    expect(errors).toEqual([]);
  });

  test('Büro: klingelnde Telefone außerhalb des Bildes zeigen Pfeile; Ablehnen zählt als verpasst', async ({ page }, info) => {
    test.slow();
    test.skip(info.project.name === 'desktop-hidpi', 'DPR-unabhängig');
    const errors = collectErrors(page);
    // Platz 0 klingelt gleich zu Beginn; der nächste Anrufer klingelt an Platz 7.
    await openGame(page, '?ringDesk=0&ring=zoe,moonboy');
    const touch = isTouchProject(info);
    if (touch) await enterOfficeByTouch(page);
    else await enterOfficeByKeyboard(page);
    await expect.poll(async () => (await calls(page)).views[0]?.kind).toBe('ringing');
    // Ist Platz 0 nicht im Bild, zeigt ein Pfeil in seine Richtung.
    const arrows = (await calls(page)).arrows;
    console.log(`[${info.project.name}] Pfeile: ${arrows}`);
    await shot(page, info, 'office-ringing');
    await sitAtDesk(page, touch, true);
    await expect.poll(async () => (await popupOf(page))?.callerId).toBe('moonboy');
    if (touch) {
      const d = await osTarget(page, 'call:decline');
      await page.touchscreen.tap(d.x, d.y);
    } else await click(page, 'call:decline');
    await expect.poll(async () => (await calls(page)).history.some((r) => r.callerId === 'moonboy' && r.outcome === 'missed')).toBe(true);
    expect(await popupOf(page)).toBeNull();
    expect(errors).toEqual([]);
  });
});

import { expect, test, type Page } from '@playwright/test';
import { collectErrors, openGame, osState, osTarget, osWindow, shot, sitAtDesk, touchSwipe } from './helpers';

/**
 * Mikrofon auf dem Handy: Antippen statt Halten (Safari erlaubt das Mikrofon nur beim Loslassen),
 * sichtbarer Status am Knopf, klare Meldung mit Grund und Rückfall auf das Textfeld, damit man mit
 * dem Mikrofon der Bildschirmtastatur diktieren kann.
 */

interface PhoneState {
  mode: string;
  typing: boolean;
  listening: boolean;
  micState: 'idle' | 'listening' | 'processing' | 'error';
  micIssue: string | null;
  live: string;
  transcript: { who: string; text: string }[];
}

const phone = async (page: Page): Promise<PhoneState | undefined> => (await osWindow(page, 'phone'))?.state as PhoneState | undefined;

/** Spracherkennung ersetzen: `mode` = funktioniert, Fehler beim Start (wie iPhone ohne Siri/Diktat) oder gar nicht vorhanden. */
async function fakeRecognition(page: Page, mode: 'ok' | 'service' | 'none'): Promise<void> {
  await page.addInitScript((m) => {
    const synth = { speaking: false, getVoices: () => [], speak: () => undefined, cancel: () => undefined, addEventListener: () => undefined };
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
    if (m === 'none') {
      Object.defineProperty(window, 'SpeechRecognition', { value: undefined, configurable: true });
      Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined, configurable: true });
      return;
    }
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
        if (m === 'service') {
          setTimeout(() => {
            this.onerror?.({ error: 'service-not-allowed' });
            this.onend?.();
          }, 30);
          return;
        }
        setTimeout(() => this.onresult?.({ resultIndex: 0, results: [{ isFinal: false, 0: { transcript: 'Hallo' } }] }), 100);
      }
      stop(): void {
        setTimeout(() => {
          this.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: 'Hallo Frau Rosi' } }] });
          this.onend?.();
        }, 1500);
      }
      abort(): void {
        this.onend?.();
      }
    }
    Object.defineProperty(window, 'SpeechRecognition', { value: FakeRecognition, configurable: true });
    Object.defineProperty(window, 'webkitSpeechRecognition', { value: FakeRecognition, configurable: true });
  }, mode);
}

/** Klingeln lassen, hinsetzen, per Wischen annehmen. */
async function answerByTouch(page: Page): Promise<void> {
  await openGame(page, '?ring=rosi&seed=5');
  await sitAtDesk(page, true);
  let rect: { x: number; y: number; w: number; h: number } | null = null;
  await expect
    .poll(async () => {
      rect = ((await osState(page)) as unknown as { popup: { rect: typeof rect } | null }).popup?.rect ?? null;
      return rect !== null;
    })
    .toBe(true);
  const r = rect!;
  await touchSwipe(page, { x: r.x + r.w * 0.3, y: r.y + r.h * 0.45 }, { x: r.x + r.w * 0.3, y: r.y + 4 }, 150);
  await expect.poll(async () => (await phone(page))?.mode).toBe('call');
  // Telefon steht (erste Zeile des Anrufers läuft), erst dann antippen.
  await expect.poll(async () => (await phone(page))?.transcript.length ?? 0).toBeGreaterThan(0);
}

async function tapMic(page: Page): Promise<void> {
  // Benachrichtigungen (z. B. Chef-Mail beim Einstempeln) liegen auf dem Handy über den Telefon-Knöpfen
  // und fangen ein Antippen ab (es schließt sie) – erst warten, bis keine mehr da ist.
  await expect.poll(async () => (await osState(page)).toasts.length, { timeout: 30_000 }).toBe(0);
  const m = await osTarget(page, 'phone:mic');
  await page.touchscreen.tap(m.x, m.y);
}

const phoneOnly = (info: { project: { name: string } }): boolean => info.project.name !== 'phone-landscape';

test.describe('Mikrofon auf dem Handy', () => {
  test('Antippen startet, Status „Hört zu“ → „Verarbeitet“, erneutes Antippen schickt den Satz', async ({ page }, info) => {
    test.slow();
    test.skip(phoneOnly(info), 'Handy');
    const errors = collectErrors(page);
    await fakeRecognition(page, 'ok');
    await answerByTouch(page);
    await tapMic(page);
    await expect.poll(async () => (await phone(page))?.micState).toBe('listening');
    await shot(page, info, 'mic-listening');
    await tapMic(page);
    await expect.poll(async () => (await phone(page))?.micState).toBe('processing');
    await expect.poll(async () => (await phone(page))?.transcript.some((l) => l.who === 'player' && l.text === 'Hallo Frau Rosi')).toBe(true);
    await expect.poll(async () => (await phone(page))?.micState).toBe('idle');
    expect(errors).toEqual([]);
  });

  test('Erkennung gesperrt (iPhone ohne „Siri & Diktat“): Grund nennen, nächstes Antippen öffnet das Textfeld', async ({ page }, info) => {
    test.slow();
    test.skip(phoneOnly(info), 'Handy');
    await fakeRecognition(page, 'service');
    await answerByTouch(page);
    await tapMic(page);
    await expect.poll(async () => (await phone(page))?.micState).toBe('error');
    expect((await phone(page))!.micIssue).toBe('service');
    await expect.poll(async () => (await phone(page))?.live).toContain('Siri & Diktat');
    await shot(page, info, 'mic-error');
    await tapMic(page);
    await expect.poll(async () => (await phone(page))?.typing).toBe(true);
    await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('os-text-input');
  });

  test('Keine Spracherkennung im Browser: Antippen öffnet sofort das Textfeld zum Diktieren', async ({ page }, info) => {
    test.slow();
    test.skip(phoneOnly(info), 'Handy');
    await fakeRecognition(page, 'none');
    await answerByTouch(page);
    expect((await phone(page))!.typing).toBe(false);
    await tapMic(page);
    await expect.poll(async () => (await phone(page))?.typing).toBe(true);
    await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('os-text-input');
    await expect.poll(async () => (await phone(page))?.live).toContain('keine Spracherkennung');
    await shot(page, info, 'mic-fallback');
  });
});

import type { AudioEngine } from './AudioEngine';

/** UI-Klänge (prozedural). Weitere Effekte folgen mit M11. */
export function createUiSfx(audio: AudioEngine) {
  const bus = (): GainNode | null => audio.uiBus;
  return {
    move(): void {
      audio.tone(bus(), 880, 0.04, 'square', 0.12);
    },
    confirm(): void {
      audio.tone(bus(), 660, 0.06, 'square', 0.16);
      audio.tone(bus(), 990, 0.08, 'square', 0.14, 0, 0.05);
    },
    back(): void {
      audio.tone(bus(), 520, 0.07, 'triangle', 0.18, 330);
    },
    /** Einstempeln: Stempeluhr-„Klack“ plus kurzes Klingeln. */
    start(): void {
      audio.tone(bus(), 140, 0.08, 'square', 0.25, 70);
      audio.tone(bus(), 1320, 0.07, 'sine', 0.14, 0, 0.1);
      audio.tone(bus(), 1100, 0.07, 'sine', 0.14, 0, 0.18);
    },
    /** MogelOS-Benachrichtigung: freundliches Doppel-„Pling“. */
    notify(): void {
      audio.tone(bus(), 1046, 0.09, 'sine', 0.16);
      audio.tone(bus(), 1568, 0.14, 'sine', 0.14, 0, 0.08);
    },
    /** Röhrenmonitor an (Hinsetzen) bzw. aus (Aufstehen). */
    crtOn(): void {
      audio.tone(bus(), 90, 0.05, 'square', 0.18, 60);
      audio.tone(bus(), 2400, 0.25, 'sine', 0.05, 6000, 0.03);
    },
    crtOff(): void {
      audio.tone(bus(), 3000, 0.18, 'sine', 0.06, 400);
      audio.tone(bus(), 70, 0.08, 'square', 0.16, 45, 0.12);
    },
    /** Telefon klingelt (räumlich: Lautstärke 0–1 nach Entfernung, Panorama nach Richtung). */
    ring(vol: number, pan: number): void {
      const w = audio.worldBus;
      for (let i = 0; i < 6; i++) audio.tone(w, i % 2 === 0 ? 1318 : 1046, 0.05, 'square', 0.07 * vol, 0, i * 0.055, pan);
      for (let i = 0; i < 6; i++) audio.tone(w, i % 2 === 0 ? 1318 : 1046, 0.05, 'square', 0.07 * vol, 0, 0.42 + i * 0.055, pan);
    },
    /** Abheben bzw. Auflegen (Hörer-Klack, Besetztzeichen). */
    pickUp(): void {
      audio.tone(bus(), 180, 0.05, 'square', 0.2, 120);
      audio.tone(bus(), 900, 0.06, 'sine', 0.08, 0, 0.06);
    },
    hangUp(): void {
      audio.tone(bus(), 160, 0.06, 'square', 0.2, 90);
      for (let i = 0; i < 3; i++) audio.tone(bus(), 425, 0.18, 'sine', 0.06, 0, 0.15 + i * 0.36);
    },
    /** Karte/Satz abgeschickt. */
    send(): void {
      audio.tone(bus(), 740, 0.05, 'triangle', 0.12, 990);
    },
    /** Papierkorb leeren: zerknülltes Papier (Rauschen gibt es ab M11, bis dahin Sägezahn-Knistern). */
    crumple(): void {
      for (let i = 0; i < 4; i++) audio.tone(bus(), 300 + i * 170, 0.04, 'sawtooth', 0.08, 120, i * 0.045);
    },
    /** Eine Silbe der Brabbel-Stimme (Fallback ohne Sprachsynthese): Grundton plus Vokal-Färbung. */
    babble(freq: number, vowel: number, vol: number): void {
      const v = audio.voiceBus;
      const f = freq * (0.92 + vowel * 0.16);
      audio.tone(v, f, 0.07, 'square', 0.05 * vol, f * (0.9 + vowel * 0.2));
      audio.tone(v, f * 2.01, 0.05, 'triangle', 0.03 * vol, 0, 0.01);
    },
    /** Neue Notiz (Beute erfasst). */
    note(): void {
      audio.tone(bus(), 1175, 0.06, 'triangle', 0.14);
      audio.tone(bus(), 1568, 0.06, 'triangle', 0.12, 0, 0.06);
      audio.tone(bus(), 2093, 0.1, 'triangle', 0.1, 0, 0.12);
    },
    /** Stimmung kippt ins Schlechte bzw. Gute (kurzer Hinweiston). */
    moodDown(): void {
      audio.tone(bus(), 392, 0.1, 'triangle', 0.1, 330);
    },
    moodUp(): void {
      audio.tone(bus(), 523, 0.08, 'triangle', 0.1, 659);
    },
    /** Mikrofon an bzw. aus. */
    micOn(): void {
      audio.tone(bus(), 880, 0.05, 'sine', 0.12, 1320);
    },
    micOff(): void {
      audio.tone(bus(), 1320, 0.05, 'sine', 0.1, 880);
    },
    /** Auszahlung: Registrierkasse („Ka-tsching“). */
    cash(): void {
      audio.tone(bus(), 220, 0.05, 'square', 0.16, 140);
      audio.tone(bus(), 1975, 0.07, 'square', 0.1, 0, 0.07);
      audio.tone(bus(), 2637, 0.22, 'triangle', 0.12, 0, 0.12);
      audio.tone(bus(), 3951, 0.18, 'sine', 0.06, 0, 0.16);
    },
    /** Eingabe abgelehnt (falscher Code). */
    deny(): void {
      audio.tone(bus(), 196, 0.09, 'square', 0.14);
      audio.tone(bus(), 147, 0.14, 'square', 0.14, 0, 0.1);
    },
    /** Geschenk verschickt (Plauderbude). */
    gift(): void {
      for (let i = 0; i < 4; i++) audio.tone(bus(), 784 * 1.26 ** i, 0.06, 'triangle', 0.12, 0, i * 0.06);
    },
    /** Mausklick auf dem fremden PC (Fernzugriff). */
    click(): void {
      audio.tone(bus(), 2200, 0.015, 'square', 0.08);
    },
  };
}

export type UiSfx = ReturnType<typeof createUiSfx>;

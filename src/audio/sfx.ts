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
    /** Papierkorb leeren: zerknülltes Papier (Rauschen gibt es ab M11, bis dahin Sägezahn-Knistern). */
    crumple(): void {
      for (let i = 0; i < 4; i++) audio.tone(bus(), 300 + i * 170, 0.04, 'sawtooth', 0.08, 120, i * 0.045);
    },
  };
}

export type UiSfx = ReturnType<typeof createUiSfx>;

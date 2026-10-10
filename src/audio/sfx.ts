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
  };
}

export type UiSfx = ReturnType<typeof createUiSfx>;

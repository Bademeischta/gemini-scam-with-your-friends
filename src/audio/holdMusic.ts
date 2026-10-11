import type { AudioEngine } from './AudioEngine';

/** Halbtöne über C5 (null = Pause) und Länge in Achteln: eigene, absichtlich klebrige Warteschleifen-Melodie. */
const MELODY: readonly (readonly [number | null, number])[] = [
  [4, 1], [7, 1], [9, 2], [7, 1], [4, 1], [2, 2],
  [0, 1], [2, 1], [4, 2], [7, 2], [5, 2],
  [4, 1], [5, 1], [7, 2], [12, 1], [11, 1], [9, 2],
  [7, 3], [null, 1], [4, 1], [2, 1], [0, 2],
  [9, 1], [7, 1], [9, 2], [11, 1], [12, 1], [14, 2],
  [12, 1], [11, 1], [9, 2], [7, 2], [4, 2],
  [5, 1], [4, 1], [2, 2], [7, 1], [5, 1], [4, 2],
  [2, 2], [-1, 2], [0, 4],
];
/** Basstöne je Takt (8 Achtel), Halbtöne über C3. */
const BASS: readonly number[] = [0, 7, 9, 5, 2, 7, 5, 0];
const EIGHTH = 0.24;
const C5 = 523.25;
const C3 = 130.81;

/**
 * Warteschleifen-Musik (CAL-20): läuft, solange der Anruf am eigenen Platz gehalten wird.
 * Wird vorausschauend über die Audio-Uhr geplant, damit sie bei schwankender Bildrate gleichmäßig bleibt.
 */
export class HoldMusic {
  private playing = false;
  private next = 0;
  private step = 0;
  private beat = 0;

  constructor(private readonly audio: AudioEngine) {}

  update(on: boolean): void {
    const ctx = this.audio.context;
    if (!ctx || ctx.state !== 'running') return;
    if (!on) {
      this.playing = false;
      return;
    }
    const now = this.audio.now;
    if (!this.playing || this.next < now - 0.5) {
      this.playing = true;
      this.next = now + 0.08;
      this.step = 0;
      this.beat = 0;
    }
    const bus = this.audio.voiceBus;
    while (this.next < now + 0.35) {
      const [semi, len] = MELODY[this.step % MELODY.length]!;
      const delay = this.next - now;
      const dur = len * EIGHTH;
      if (semi !== null) {
        const f = C5 * 2 ** (semi / 12);
        // Leicht „leiernd“ wie ein altes Band.
        this.audio.tone(bus, f, dur * 0.9, 'triangle', 0.06, f * 0.995, delay);
        this.audio.tone(bus, f * 2, dur * 0.5, 'sine', 0.015, 0, delay);
      }
      // Bass auf jeder vierten Achtel.
      for (let i = 0; i < len; i++) {
        const b = this.beat + i;
        if (b % 4 === 0) {
          const root = BASS[Math.floor(b / 8) % BASS.length]!;
          this.audio.tone(bus, C3 * 2 ** (root / 12), EIGHTH * 1.6, 'sine', 0.07, 0, delay + i * EIGHTH);
        }
      }
      this.beat += len;
      this.next += dur;
      this.step++;
    }
  }
}

import { TUNING } from '../config/tuning';
import type { Services } from '../core/services';
import { CALLERS } from '../data/callers';
import { t } from '../i18n';
import type { CallSession, PhoneHub, TranscriptLine } from '../systems/calls/PhoneHub';
import { babbleSyllables } from './speechText';

/** Sprecher bei Lautsprecher-Anrufen (Zeilen beginnen mit „Mama:“ usw.). */
const SPEAKERS = ['Mama', 'Papa', 'Jannik'] as const;

interface Babble {
  syllables: number[];
  index: number;
  timer: number;
  step: number;
  freq: number;
  vol: number;
}

/**
 * Stimme des Anrufers am eigenen Platz (CAL-16, AUD-07): Sprachsynthese mit der Stimme der Figur,
 * sonst (oder auf Wunsch) Brabbeln im Takt der Untertitel. Hörer: leiser, Lautsprecher: voll.
 */
export class CallVoice {
  private babble: Babble | null = null;
  private readonly off: () => void;

  constructor(
    private readonly s: Services,
    hub: PhoneHub,
    private readonly desk: number,
  ) {
    this.off = hub.on((e) => {
      if (e.desk !== this.desk) return;
      if (e.type === 'line' && e.line.who === 'caller') this.say(e.session, e.line);
      else if (e.type === 'answered') this.stop();
    });
  }

  /** Brabbel-Silben im Takt abspielen. */
  update(dt: number): void {
    const b = this.babble;
    if (!b) return;
    b.timer -= dt;
    while (b.timer <= 0 && b.index < b.syllables.length) {
      const v = b.syllables[b.index++]!;
      if (v >= 0) this.s.sfx.babble(b.freq * (0.97 + Math.random() * 0.06), v, b.vol);
      b.timer += v >= 0 ? b.step : b.step * 2;
    }
    if (b.index >= b.syllables.length) this.babble = null;
  }

  stop(): void {
    this.s.voice.cancel();
    this.babble = null;
  }

  destroy(): void {
    this.off();
    this.stop();
  }

  private say(session: CallSession, line: TranscriptLine): void {
    const st = this.s.settings.get();
    if (st.voiceMode === 'off') return;
    const def = session.caller;
    const loud = session.speaker || (def.traits?.includes('speaker') ?? false);
    const vol = loud ? 1 : 0.6;
    if (st.voiceMode === 'tts' && this.s.voice.usable) {
      this.s.voice.speak(line.text, def.voice, {
        index: Math.max(0, CALLERS.indexOf(def)),
        volume: this.s.audio.voiceLevel * vol,
        preferred: st.voiceName,
        speakers: def.traits?.includes('speaker') ? SPEAKERS : [],
        words: { currency: t('calls.voice.currency'), percent: t('calls.voice.percent') },
      });
      return;
    }
    const syllables = babbleSyllables(line.text);
    if (syllables.length === 0) return;
    const duration = line.text.length / (TUNING.calls.subtitleCps * def.voice.rate);
    this.babble = { syllables, index: 0, timer: 0, step: duration / syllables.length, freq: def.voice.babble, vol };
  }
}

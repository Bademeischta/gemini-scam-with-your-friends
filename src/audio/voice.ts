import type { VoiceDef } from '../systems/conversation/caller';
import { guessFemale, speechSegments } from './speechText';

/** Tonhöhen-Versatz je Sprecher bei Lautsprecher-Anrufen (Familie Krawallski). */
const SPEAKER_PITCH: Readonly<Record<string, number>> = { Mama: 0.15, Papa: -0.35, Jannik: 0.55 };

export interface SpeakOptions {
  /** Figur-Index (verteilt Figuren über die vorhandenen Stimmen). */
  index: number;
  /** 0–1 */
  volume: number;
  /** Fest gewählte Systemstimme ('' = automatisch). */
  preferred: string;
  speakers?: readonly string[];
  words: { currency: string; percent: string };
}

/**
 * Anruferstimmen über die Sprachsynthese des Browsers (CAL-16, AUD-07): eigene Tonhöhe, eigenes Tempo
 * und eine passende deutsche Systemstimme je Figur. Ohne deutsche Stimme greift die Brabbel-Stimme.
 */
export class VoiceOut {
  private readonly synth: SpeechSynthesis | null;
  private voices: SpeechSynthesisVoice[] = [];
  /** Zuletzt gesprochene Texte (für Tests). */
  readonly spoken: string[] = [];

  constructor(win: Window) {
    this.synth = 'speechSynthesis' in win && 'SpeechSynthesisUtterance' in win ? win.speechSynthesis : null;
    if (this.synth) {
      const load = (): void => {
        try {
          this.voices = this.synth!.getVoices();
        } catch {
          this.voices = [];
        }
      };
      load();
      this.synth.addEventListener?.('voiceschanged', load);
    }
  }

  get supported(): boolean {
    return this.synth !== null;
  }

  /** Deutsche Stimmen (lokale zuerst, damit es offline klappt). */
  germanVoices(): SpeechSynthesisVoice[] {
    if (this.voices.length === 0 && this.synth) this.voices = this.synth.getVoices();
    return this.voices.filter((v) => v.lang.toLowerCase().startsWith('de')).sort((a, b) => Number(b.localService) - Number(a.localService));
  }

  /** Sprachsynthese nutzbar (es gibt eine deutsche Stimme). */
  get usable(): boolean {
    return this.supported && this.germanVoices().length > 0;
  }

  speak(line: string, def: VoiceDef, o: SpeakOptions): void {
    if (!this.synth) return;
    const voice = this.pick(def, o.index, o.preferred);
    if (!voice) return;
    for (const seg of speechSegments(line, o.speakers ?? [], o.words)) {
      const u = new SpeechSynthesisUtterance(seg.text);
      u.voice = voice;
      u.lang = voice.lang;
      u.pitch = clamp(def.pitch + (seg.speaker ? (SPEAKER_PITCH[seg.speaker] ?? 0) : 0), 0.1, 2);
      u.rate = clamp(def.rate, 0.5, 1.8);
      u.volume = clamp(o.volume, 0, 1);
      this.synth.speak(u);
      this.spoken.push(seg.text);
      if (this.spoken.length > 50) this.spoken.shift();
    }
  }

  cancel(): void {
    this.synth?.cancel();
  }

  get speaking(): boolean {
    return this.synth?.speaking ?? false;
  }

  private pick(def: VoiceDef, index: number, preferred: string): SpeechSynthesisVoice | null {
    const all = this.germanVoices();
    if (all.length === 0) return null;
    if (preferred) {
      const p = all.find((v) => v.name === preferred);
      if (p) return p;
    }
    const matching = all.filter((v) => guessFemale(v.name) === def.female);
    const pool = matching.length > 0 ? matching : all;
    return pool[index % pool.length] ?? null;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

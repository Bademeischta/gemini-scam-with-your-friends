import type { MicMode } from '../save/settings';

/** Der Teil der Web-Speech-API, den wir brauchen (Chrome: webkitSpeechRecognition). */
interface RecognitionResult {
  readonly isFinal: boolean;
  readonly 0: { transcript: string };
}
interface RecognitionEvent {
  readonly resultIndex: number;
  readonly results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

export interface SpeechHandlers {
  /** Zwischenergebnis (Live-Untertitel des Erkannten). */
  interim(text: string): void;
  /** Fertiger Satz. */
  final(text: string): void;
  /** Zuhören beendet (auch nach Fehlern). */
  end(): void;
  error?(code: string): void;
}

/**
 * Warum die Spracheingabe nicht geht (für eine klare Meldung an den Spieler):
 * - unsupported: Der Browser hat keine Spracherkennung (z. B. Firefox, manche WebViews).
 * - insecure: Seite nicht über HTTPS geladen – Mikrofon gesperrt.
 * - denied: Mikrofon-Zugriff verweigert (Browser- oder System-Einstellung).
 * - service: Erkennungsdienst nicht erlaubt (iPhone: „Siri & Diktat“ aus, oder Web-App vom Home-Bildschirm).
 * - noMic: kein Mikrofon bzw. von einer anderen App belegt.
 * - network: Erkennung braucht eine Internetverbindung (Chrome, Safari schicken Audio an einen Dienst).
 * - language: Deutsch wird nicht unterstützt.
 * - failed: Start ging aus einem anderen Grund schief.
 */
export const MIC_ISSUES = ['unsupported', 'insecure', 'denied', 'service', 'noMic', 'network', 'language', 'failed'] as const;
export type MicIssue = (typeof MIC_ISSUES)[number];

/** Fehlercode der Web-Speech-API → Grund; null = harmlos (nichts gehört, abgebrochen). */
export function micIssueFor(code: string): MicIssue | null {
  switch (code) {
    case 'not-allowed':
      return 'denied';
    case 'service-not-allowed':
      return 'service';
    case 'audio-capture':
      return 'noMic';
    case 'network':
      return 'network';
    case 'language-not-supported':
      return 'language';
    case 'no-speech':
    case 'aborted':
      return null;
    default:
      return 'failed';
  }
}

function ctorOf(win: Window): RecognitionCtor | null {
  const w = win as Window & { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Spracheingabe der Spielerstimme (CAL-17, PLT-04): Halten zum Sprechen oder Sprachaktivierung
 * (hört nach dem Antippen zu, bis man eine Pause macht). Nur wo der Browser es kann.
 */
export class SpeechInput {
  private rec: Recognition | null = null;
  private handlers: SpeechHandlers | null = null;
  private finalText = '';
  private interimText = '';

  constructor(
    private readonly win: Window,
    private readonly lang: string,
  ) {}

  static supported(win: Window): boolean {
    return ctorOf(win) !== null;
  }

  /** Grund, warum es gar nicht erst geht (null = einen Versuch wert). */
  static diagnose(win: Window): MicIssue | null {
    if (win.isSecureContext === false) return 'insecure';
    if (!ctorOf(win)) return 'unsupported';
    return null;
  }

  get listening(): boolean {
    return this.rec !== null;
  }

  /**
   * Zuhören beginnen. Liefert false, wenn es nicht geht. Muss direkt aus einer Nutzer-Geste kommen
   * (Safari erlaubt das Mikrofon nur beim Loslassen bzw. Klick, nicht beim Aufsetzen des Fingers).
   * `ptt` hört durchgehend bis zum Loslassen, `auto` endet nach einer Sprechpause.
   */
  start(mode: MicMode, handlers: SpeechHandlers): boolean {
    const Ctor = ctorOf(this.win);
    if (!Ctor) return false;
    this.abort();
    let rec: Recognition;
    try {
      rec = new Ctor();
    } catch {
      return false;
    }
    rec.lang = this.lang;
    rec.continuous = mode === 'ptt';
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    this.finalText = '';
    this.interimText = '';
    this.handlers = handlers;
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]!;
        const text = r[0].transcript;
        if (r.isFinal) this.finalText = `${this.finalText} ${text}`.trim();
        else interim += text;
      }
      this.interimText = interim.trim();
      handlers.interim(`${this.finalText} ${this.interimText}`.trim());
    };
    rec.onerror = (e) => handlers.error?.(e.error);
    rec.onend = () => {
      if (this.rec !== rec) return;
      this.rec = null;
      // Was bis hierhin erkannt wurde, zählt (auch ein Zwischenergebnis beim Loslassen).
      const text = `${this.finalText} ${this.interimText}`.trim();
      this.handlers = null;
      if (text) handlers.final(text);
      handlers.end();
    };
    try {
      rec.start();
    } catch {
      return false;
    }
    this.rec = rec;
    return true;
  }

  /** Loslassen (Halten zum Sprechen): Erkennung abschließen, Ergebnis kommt über `final`. */
  stop(): void {
    try {
      this.rec?.stop();
    } catch {
      this.abort();
    }
  }

  /** Abbrechen ohne Ergebnis. */
  abort(): void {
    const rec = this.rec;
    const h = this.handlers;
    this.rec = null;
    this.handlers = null;
    if (rec) {
      try {
        rec.abort();
      } catch {
        // schon beendet
      }
      h?.end();
    }
  }
}

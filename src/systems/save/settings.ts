import { AI_PROVIDERS, type AiProviderId } from '../../data/aiProviders';
import { OS_THEME_IDS, WALLPAPERS, type OsThemeId, type Wallpaper } from '../../data/os/appearance';
import type { SafeStorage } from './storage';

/**
 * Spieler-Einstellungen. Neue Felder bekommen hier einen Standardwert; alte Spielstände werden
 * beim Laden mit den Standardwerten zusammengeführt (vorwärtskompatibel).
 */
export interface Settings {
  locale: string;
  masterVolume: number;
  uiVolume: number;
  vibration: boolean;
  /** Ausrichtungs-Hinweis wurde mit „Trotzdem hochkant spielen“ weggeklickt. */
  portraitAccepted: boolean;
  /** MogelOS: Hintergrundbild und Farbschema (Systemsteuerung). */
  osWallpaper: Wallpaper;
  osTheme: OsThemeId;
  /** Anruferstimmen: Sprachsynthese, Brabbeln oder stumm (nur Untertitel). */
  voiceMode: VoiceMode;
  /** Gewählte Systemstimme ('' = automatisch je Figur). */
  voiceName: string;
  voiceVolume: number;
  /** Spracheingabe (Mikrofon) erlaubt, wo der Browser sie kann. */
  speechInput: boolean;
  /** Mikrofon: Halten zum Sprechen oder Sprachaktivierung (hört nach dem Antippen zu, bis man schweigt). */
  micMode: MicMode;
  /** Handy: Texteingabe in der Telefon-App eingeblendet (sonst nur Karten). */
  phoneTyping: boolean;
  /** KI-Anrufer (Anbieter mit eigenem Schlüssel); ohne Schlüssel antwortet die lokale Engine. */
  aiCallers: boolean;
  /** Gewählter KI-Anbieter. */
  aiProvider: AiProviderId;
  /** Modell je Anbieter (fehlt = Standardmodell des Anbieters). */
  aiModels: Partial<Record<AiProviderId, string>>;
  /** Fallback-Kette: Ist der Anbieter am Limit, den nächsten mit eingetragenem Schlüssel nehmen. */
  aiChain: boolean;
}

export const VOICE_MODES = ['tts', 'babble', 'off'] as const;
export type VoiceMode = (typeof VOICE_MODES)[number];
export const MIC_MODES = ['ptt', 'auto'] as const;
export type MicMode = (typeof MIC_MODES)[number];

export const DEFAULT_SETTINGS: Settings = {
  locale: 'de',
  masterVolume: 0.8,
  uiVolume: 0.5,
  vibration: true,
  portraitAccepted: false,
  osWallpaper: 'mogel',
  osTheme: 'klassik',
  voiceMode: 'tts',
  voiceName: '',
  voiceVolume: 0.8,
  speechInput: true,
  micMode: 'ptt',
  phoneTyping: false,
  aiCallers: true,
  aiProvider: 'groq',
  aiModels: {},
  aiChain: true,
};

const KEY = 'settings.v1';

export class SettingsStore {
  private value: Settings;
  private readonly listeners = new Set<(s: Settings) => void>();

  constructor(private readonly storage: SafeStorage) {
    this.value = SettingsStore.sanitize(storage.read<Partial<Settings>>(KEY, {}));
  }

  get(): Readonly<Settings> {
    return this.value;
  }

  update(patch: Partial<Settings>): void {
    this.value = SettingsStore.sanitize({ ...this.value, ...patch });
    this.storage.write(KEY, this.value);
    for (const fn of this.listeners) fn(this.value);
  }

  onChange(fn: (s: Settings) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Nimmt nur gültige Felder aus einem (evtl. beschädigten) Spielstand. */
  static sanitize(raw: Partial<Record<keyof Settings, unknown>>): Settings {
    const s: Settings = { ...DEFAULT_SETTINGS };
    if (typeof raw.locale === 'string') s.locale = raw.locale;
    if (typeof raw.masterVolume === 'number' && raw.masterVolume >= 0 && raw.masterVolume <= 1) s.masterVolume = raw.masterVolume;
    if (typeof raw.uiVolume === 'number' && raw.uiVolume >= 0 && raw.uiVolume <= 1) s.uiVolume = raw.uiVolume;
    if (typeof raw.vibration === 'boolean') s.vibration = raw.vibration;
    if (typeof raw.portraitAccepted === 'boolean') s.portraitAccepted = raw.portraitAccepted;
    if ((WALLPAPERS as readonly unknown[]).includes(raw.osWallpaper)) s.osWallpaper = raw.osWallpaper as Wallpaper;
    if ((OS_THEME_IDS as readonly unknown[]).includes(raw.osTheme)) s.osTheme = raw.osTheme as OsThemeId;
    if ((VOICE_MODES as readonly unknown[]).includes(raw.voiceMode)) s.voiceMode = raw.voiceMode as VoiceMode;
    if (typeof raw.voiceName === 'string' && raw.voiceName.length <= 200) s.voiceName = raw.voiceName;
    if (typeof raw.voiceVolume === 'number' && raw.voiceVolume >= 0 && raw.voiceVolume <= 1) s.voiceVolume = raw.voiceVolume;
    if (typeof raw.speechInput === 'boolean') s.speechInput = raw.speechInput;
    if ((MIC_MODES as readonly unknown[]).includes(raw.micMode)) s.micMode = raw.micMode as MicMode;
    if (typeof raw.phoneTyping === 'boolean') s.phoneTyping = raw.phoneTyping;
    if (typeof raw.aiCallers === 'boolean') s.aiCallers = raw.aiCallers;
    if ((AI_PROVIDERS as readonly unknown[]).includes(raw.aiProvider)) s.aiProvider = raw.aiProvider as AiProviderId;
    if (typeof raw.aiModels === 'object' && raw.aiModels !== null) {
      const models: Partial<Record<AiProviderId, string>> = {};
      for (const id of AI_PROVIDERS) {
        const m = (raw.aiModels as Record<string, unknown>)[id];
        if (typeof m === 'string' && /^[\w.:/@-]{1,120}$/.test(m)) models[id] = m;
      }
      s.aiModels = models;
    }
    if (typeof raw.aiChain === 'boolean') s.aiChain = raw.aiChain;
    return s;
  }
}

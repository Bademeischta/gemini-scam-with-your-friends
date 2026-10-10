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
}

export const DEFAULT_SETTINGS: Settings = {
  locale: 'de',
  masterVolume: 0.8,
  uiVolume: 0.5,
  vibration: true,
  portraitAccepted: false,
  osWallpaper: 'mogel',
  osTheme: 'klassik',
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
    return s;
  }
}

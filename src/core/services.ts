import type { AudioEngine } from '../audio/AudioEngine';
import type { UiSfx } from '../audio/sfx';
import type { VoiceOut } from '../audio/voice';
import type { AiBrain } from '../systems/ai/brain';
import type { DeviceTracker } from '../systems/input/device';
import type { InputManager } from '../systems/input/InputManager';
import type { SaveManager } from '../systems/save/SaveManager';
import type { SettingsStore } from '../systems/save/settings';
import type { SafeStorage } from '../systems/save/storage';
import type { PauseController } from '../systems/time/PauseController';
import type { Viewport } from '../systems/viewport/Viewport';
import type { SpeechInput } from '../systems/voice/SpeechInput';

/** Gemeinsame Dienste aller Szenen. Wird einmal in main.ts erzeugt. */
export interface Services {
  viewport: Viewport;
  input: InputManager;
  device: DeviceTracker;
  pause: PauseController;
  storage: SafeStorage;
  settings: SettingsStore;
  audio: AudioEngine;
  sfx: UiSfx;
  /** Anruferstimmen (Sprachsynthese). */
  voice: VoiceOut;
  /** Spracheingabe des Spielers. */
  speech: SpeechInput;
  /** Spielstände, Statistik, Bestenliste (wird in der Boot-Szene geladen). */
  saves: SaveManager;
  /** KI-Anrufer (Schlüssel nur lokal beim Spieler). */
  ai: AiBrain;
}

let current: Services | null = null;

export function setServices(s: Services): void {
  current = s;
}

export function services(): Services {
  if (!current) throw new Error('Dienste wurden noch nicht initialisiert');
  return current;
}

let savesReady: Promise<void> = Promise.resolve();

/** Ladevorgang der Spielstände (main.ts setzt ihn, die Boot-Szene wartet darauf). */
export function setSavesReady(p: Promise<void>): void {
  savesReady = p;
}

export function whenSavesReady(): Promise<void> {
  return savesReady;
}

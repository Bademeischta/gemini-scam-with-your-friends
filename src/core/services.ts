import type { AudioEngine } from '../audio/AudioEngine';
import type { UiSfx } from '../audio/sfx';
import type { DeviceTracker } from '../systems/input/device';
import type { InputManager } from '../systems/input/InputManager';
import type { SettingsStore } from '../systems/save/settings';
import type { SafeStorage } from '../systems/save/storage';
import type { PauseController } from '../systems/time/PauseController';
import type { Viewport } from '../systems/viewport/Viewport';

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
}

let current: Services | null = null;

export function setServices(s: Services): void {
  current = s;
}

export function services(): Services {
  if (!current) throw new Error('Dienste wurden noch nicht initialisiert');
  return current;
}

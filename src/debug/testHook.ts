import type Phaser from 'phaser';
import type { Services } from '../core/services';
import { i18n } from '../i18n';
import { isFullscreen } from '../systems/platform/fullscreen';

/**
 * Nur im E2E-Build (VITE_E2E=1): liest Spielzustand für Playwright aus.
 * Kein Schreibzugriff – Tests steuern das Spiel ausschließlich über echte Eingaben.
 */
export interface TestHook {
  ready: boolean;
  scene(): string | undefined;
  titleState(): string | undefined;
  menuFocus(): string | undefined;
  /** Menü-Buttons in CSS-Pixeln (für gezieltes Antippen in Tests). */
  menuRects(): { id: string; x: number; y: number; w: number; h: number }[];
  hintMode(): string;
  inputKind(): string;
  formFactor(): string;
  viewport(): Services['viewport']['state'];
  canvas(): { width: number; height: number; cssWidth: string; cssHeight: string };
  paused(): boolean;
  pauseReasons(): string[];
  audioState(): string;
  fullscreen(): boolean;
  rotateHintVisible(): boolean;
  locale(): string;
  errors: string[];
}

declare global {
  interface Window {
    __MASCHE__?: TestHook;
  }
}

export function installTestHook(game: Phaser.Game, s: Services): void {
  const hook: TestHook = {
    ready: false,
    scene: () => game.scene.getScenes(true)[0]?.scene.key,
    titleState: () => game.registry.get('titleState') as string | undefined,
    menuFocus: () => game.registry.get('menuFocus') as string | undefined,
    menuRects: () => (game.registry.get('menuRects') as { id: string; x: number; y: number; w: number; h: number }[] | undefined) ?? [],
    hintMode: () => s.device.hintMode,
    inputKind: () => s.device.kind,
    formFactor: () => s.device.formFactor,
    viewport: () => s.viewport.state,
    canvas: () => ({ width: game.canvas.width, height: game.canvas.height, cssWidth: game.canvas.style.width, cssHeight: game.canvas.style.height }),
    paused: () => s.pause.paused,
    pauseReasons: () => [...s.pause.activeReasons],
    audioState: () => s.audio.state,
    fullscreen: () => isFullscreen(),
    rotateHintVisible: () => !(document.getElementById('rotate-hint')?.hidden ?? true),
    locale: () => i18n.locale,
    errors: [],
  };
  window.addEventListener('error', (e) => hook.errors.push(String(e.message)));
  window.__MASCHE__ = hook;
  const markReady = (): void => {
    if (game.scene.isActive('Title')) hook.ready = true;
    else requestAnimationFrame(markReady);
  };
  requestAnimationFrame(markReady);
}

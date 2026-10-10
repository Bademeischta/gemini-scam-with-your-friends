import { registerSW } from 'virtual:pwa-register';
import { AudioEngine } from './audio/AudioEngine';
import { createUiSfx } from './audio/sfx';
import { DEFAULT_BINDINGS } from './config/input-defaults';
import { TUNING } from './config/tuning';
import { createGame } from './core/createGame';
import { setServices, type Services } from './core/services';
import { installTestHook } from './debug/testHook';
import { applyDomTranslations, i18n } from './i18n';
import { AboutScene } from './scenes/AboutScene';
import { BootScene } from './scenes/BootScene';
import { OfficeHudScene } from './scenes/OfficeHudScene';
import { OfficeScene } from './scenes/OfficeScene';
import { PauseScene } from './scenes/PauseScene';
import { TitleScene } from './scenes/TitleScene';
import { DeviceTracker, detectFormFactor, detectInitialKind, readDeviceEnv } from './systems/input/device';
import { InputManager } from './systems/input/InputManager';
import { enterFullscreen, fullscreenSupported, isStandalone } from './systems/platform/fullscreen';
import { installBrowserGuards, isTextField } from './systems/platform/guards';
import { OrientationHint, shouldShowRotateHint } from './systems/platform/orientation';
import { SettingsStore } from './systems/save/settings';
import { SafeStorage } from './systems/save/storage';
import { PauseController } from './systems/time/PauseController';
import { Viewport } from './systems/viewport/Viewport';

function attachDomInput(win: Window, input: InputManager): void {
  win.addEventListener('keydown', (e) => {
    const bound = input.handleKeyDown(e.code, e.repeat, isTextField(e.target));
    // Spieltasten sollen nicht scrollen, den Fokus wechseln o. Ä. – Browser-Kürzel bleiben erhalten.
    if (bound && !e.ctrlKey && !e.metaKey && !e.altKey) e.preventDefault();
  });
  win.addEventListener('keyup', (e) => input.handleKeyUp(e.code));
  win.addEventListener(
    'pointerdown',
    (e) => input.handlePointer(e.pointerType, e.target instanceof HTMLCanvasElement),
    { capture: true },
  );
  win.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType === 'mouse' && (e.movementX !== 0 || e.movementY !== 0)) input.handlePointer('mouse', false);
    },
    { capture: true },
  );
  win.addEventListener('blur', () => input.releaseAll());
}

function boot(): void {
  const win = window;
  installBrowserGuards(win);

  const storage = SafeStorage.fromWindow(win);
  const settings = new SettingsStore(storage);
  i18n.setLocale(settings.get().locale);
  applyDomTranslations();

  const env = readDeviceEnv(win);
  const device = new DeviceTracker(detectInitialKind(env), detectFormFactor(env, TUNING.input.tabletMinShortSide));
  const root = document.documentElement;
  root.dataset['formFactor'] = device.formFactor;
  root.dataset['input'] = device.hintMode;
  device.onChange((mode) => {
    root.dataset['input'] = mode;
  });

  const input = new InputManager(
    DEFAULT_BINDINGS,
    { getGamepads: () => (typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : []) },
    { stickDeadzone: TUNING.input.stickDeadzone },
    device,
  );
  attachDomInput(win, input);

  const viewport = new Viewport(win, document.getElementById('safe-probe'), TUNING.display.maxDpr);
  const pause = new PauseController();
  const audio = new AudioEngine(settings.get().masterVolume, settings.get().uiVolume);
  const s: Services = { viewport, input, device, pause, storage, settings, audio, sfx: createUiSfx(audio) };
  setServices(s);

  // Auto-Pause im Hintergrund: Logik einfrieren, Ton anhalten, gedrückte Tasten lösen.
  const onVisibility = (): void => {
    if (document.visibilityState === 'hidden') {
      pause.add('background');
      audio.suspend();
      input.releaseAll();
    } else {
      pause.remove('background');
      audio.resume();
    }
  };
  document.addEventListener('visibilitychange', onVisibility);
  win.addEventListener('blur', () => pause.add('blur'));
  win.addEventListener('focus', () => pause.remove('blur'));
  win.addEventListener('pagehide', () => audio.suspend());

  // Erste Nutzer-Geste: Ton freischalten; auf dem Handy automatisch Vollbild.
  let firstGesture = true;
  const onGesture = (): void => {
    audio.unlock();
    if (firstGesture) {
      firstGesture = false;
      if (device.formFactor === 'phone' && fullscreenSupported() && !isStandalone()) void enterFullscreen();
    }
  };
  win.addEventListener('pointerdown', onGesture, { capture: true });
  win.addEventListener('keydown', onGesture, { capture: true });

  // Ausrichtungs-Hinweis (nur Handy im Hochformat, abschaltbar).
  const hintEl = document.getElementById('rotate-hint');
  const hintBtn = document.getElementById('rotate-continue');
  if (hintEl && hintBtn) {
    const hint = new OrientationHint(
      hintEl,
      hintBtn,
      () => {
        settings.update({ portraitAccepted: true });
        update();
      },
      (visible) => (visible ? pause.add('orientation') : pause.remove('orientation')),
    );
    const update = (): void =>
      hint.set(shouldShowRotateHint(device.formFactor, viewport.state.orientation, settings.get().portraitAccepted));
    viewport.onChange(update);
    update();
  }

  const game = createGame(s, [BootScene, TitleScene, AboutScene, OfficeScene, OfficeHudScene, PauseScene]);
  if (import.meta.env.VITE_E2E === '1') installTestHook(game, s);

  registerSW({ immediate: true });
}

boot();

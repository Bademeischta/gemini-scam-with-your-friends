import { registerSW } from 'virtual:pwa-register';
import { AudioEngine } from './audio/AudioEngine';
import { createUiSfx } from './audio/sfx';
import { VoiceOut } from './audio/voice';
import { DEFAULT_BINDINGS } from './config/input-defaults';
import { TUNING } from './config/tuning';
import { createGame } from './core/createGame';
import { setRunPersistence } from './core/run';
import { setSavesReady, setServices, type Services } from './core/services';
import { installTestHook } from './debug/testHook';
import { applyDomTranslations, i18n } from './i18n';
import { AboutScene } from './scenes/AboutScene';
import { BootScene } from './scenes/BootScene';
import { DesktopScene } from './scenes/DesktopScene';
import { OfficeHudScene } from './scenes/OfficeHudScene';
import { OfficeScene } from './scenes/OfficeScene';
import { PauseScene } from './scenes/PauseScene';
import { ReportScene } from './scenes/ReportScene';
import { ReviewScene } from './scenes/ReviewScene';
import { StatsScene } from './scenes/StatsScene';
import { TitleScene } from './scenes/TitleScene';
import { DeviceTracker, detectFormFactor, detectInitialKind, readDeviceEnv } from './systems/input/device';
import { InputManager } from './systems/input/InputManager';
import { enterFullscreen, fullscreenSupported, isStandalone } from './systems/platform/fullscreen';
import { installBrowserGuards, isTextField } from './systems/platform/guards';
import { OrientationHint, shouldShowRotateHint } from './systems/platform/orientation';
import { MemoryKv, openBestKv } from './systems/save/kv';
import { SaveManager } from './systems/save/SaveManager';
import { SettingsStore } from './systems/save/settings';
import { SafeStorage } from './systems/save/storage';
import { PauseController } from './systems/time/PauseController';
import { Viewport } from './systems/viewport/Viewport';
import { SpeechInput } from './systems/voice/SpeechInput';

function attachDomInput(win: Window, input: InputManager): void {
  win.addEventListener('keydown', (e) => {
    const modifier = e.ctrlKey || e.metaKey || e.altKey;
    const bound = input.handleKeyDown(e.code, e.repeat, isTextField(e.target), e.key, modifier);
    // Spieltasten sollen nicht scrollen, den Fokus wechseln o. Ä. – Browser-Kürzel bleiben erhalten.
    if (bound && !modifier) e.preventDefault();
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
  const audio = new AudioEngine(settings.get().masterVolume, settings.get().uiVolume, settings.get().voiceVolume);
  settings.onChange((v) => audio.setVolumes(v.masterVolume, v.uiVolume, v.voiceVolume));
  const voice = new VoiceOut(win);
  const speech = new SpeechInput(win, 'de-DE');
  // Spielstände: IndexedDB (sonst localStorage); die Boot-Szene wartet, bis sie geladen sind.
  const saves = new SaveManager(new MemoryKv());
  const s: Services = { viewport, input, device, pause, storage, settings, audio, sfx: createUiSfx(audio), voice, speech, saves };
  setServices(s);
  setSavesReady(
    openBestKv(win, storage)
      .then(async (kv) => {
        const m = new SaveManager(kv);
        await m.init();
        s.saves = m;
        setRunPersistence(m);
      })
      .catch(() => setRunPersistence(s.saves)),
  );
  // In der Pause verstummen die Anrufer, das Mikrofon geht aus.
  // (Chrome setzt pausierte Sprachausgabe unzuverlässig fort, deshalb abbrechen; die Untertitel bleiben.)
  pause.onChange((paused) => {
    if (!paused) return;
    voice.cancel();
    speech.abort();
  });

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

  // Reihenfolge = Zeichenreihenfolge: Desktop über dem Büro, Pause über allem.
  const game = createGame(s, [BootScene, TitleScene, AboutScene, StatsScene, OfficeScene, OfficeHudScene, DesktopScene, ReviewScene, ReportScene, PauseScene]);
  if (import.meta.env.VITE_E2E === '1') installTestHook(game, s);
  // Debug-Menü (F9) nur im Dev- und Test-Build; im Produktions-Build fällt der Import weg.
  if (import.meta.env.DEV || import.meta.env.VITE_E2E === '1') void import('./debug/DebugMenu').then((m) => m.installDebugMenu(game));

  registerSW({ immediate: true });
}

boot();

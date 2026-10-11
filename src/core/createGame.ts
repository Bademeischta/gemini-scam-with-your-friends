import Phaser from 'phaser';
import { PALETTE } from '../config/palette';
import type { ViewportState } from '../systems/viewport/viewportMath';
import type { Services } from './services';

/**
 * Erzeugt das Phaser-Spiel. Der Canvas hat die physische Auflösung (CSS-Größe × devicePixelRatio)
 * und wird per CSS auf die Fenstergröße gebracht → gestochen scharf auf Retina.
 */
export function createGame(s: Services, scenes: Phaser.Types.Scenes.SceneType[]): Phaser.Game {
  const vp = s.viewport.state;
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: PALETTE.ink0,
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    banner: false,
    disableContextMenu: true,
    audio: { noAudio: true },
    input: { keyboard: false, gamepad: false, activePointers: 4, touch: { capture: true } },
    scale: { mode: Phaser.Scale.NONE, width: vp.width, height: vp.height, zoom: 1 / vp.dpr, autoRound: false },
    render: { powerPreference: 'high-performance', antialiasGL: false },
    fps: { target: 60, smoothStep: true },
    scene: scenes,
  });

  game.events.once(Phaser.Core.Events.READY, () => applyViewport(game, s.viewport.state));
  s.viewport.onChange((state) => applyViewport(game, state));

  // Eingabe-Frames: vor der Szenen-Logik Gamepads abfragen, danach Flanken löschen.
  game.events.on(Phaser.Core.Events.PRE_STEP, () => s.input.beginFrame());
  game.events.on(Phaser.Core.Events.POST_STEP, () => s.input.endFrame());
  return game;
}

export function applyViewport(game: Phaser.Game, vp: ViewportState): void {
  game.scale.setZoom(1 / vp.dpr);
  game.scale.resize(vp.width, vp.height);
  const canvas = game.canvas;
  canvas.style.width = `${vp.cssWidth}px`;
  canvas.style.height = `${vp.cssHeight}px`;
  game.scale.updateBounds();
  // Kameras aller laufenden Szenen an die neue Größe anpassen.
  for (const scene of game.scene.getScenes(true)) scene.cameras.main.setSize(vp.width, vp.height);
}

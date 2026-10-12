import Phaser from 'phaser';
import { TUNING } from '../../config/tuning';

export interface PressHandlers {
  /** Klick bzw. Tippen; `double` = zweiter Klick kurz nach dem ersten (Maus). */
  onTap?(p: Phaser.Input.Pointer, double: boolean): void;
  /** Rechtsklick (Maus) oder langes Drücken (Touch) → Kontextmenü. */
  onContext?(p: Phaser.Input.Pointer): void;
}

/**
 * Einheitliche Zeiger-Gesten für MogelOS: Tippen/Klicken, Doppelklick, Rechtsklick und
 * langes Drücken (ersetzt auf Touch den Rechtsklick, CTL-10). Wer den Finger bewegt, zieht –
 * dann wird weder getippt noch das Kontextmenü geöffnet.
 */
export function attachPress(scene: Phaser.Scene, zone: Phaser.GameObjects.Zone, h: PressHandlers, moveTolerance: () => number): () => void {
  let timer: Phaser.Time.TimerEvent | null = null;
  let start: { x: number; y: number } | null = null;
  let longFired = false;
  let lastTap = -Infinity;

  const cancel = (): void => {
    timer?.remove(false);
    timer = null;
    start = null;
  };

  zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (p: Phaser.Input.Pointer) => {
    cancel();
    if (p.rightButtonDown()) {
      h.onContext?.(p);
      return;
    }
    start = { x: p.x, y: p.y };
    longFired = false;
    if (h.onContext && p.wasTouch) {
      timer = scene.time.delayedCall(TUNING.os.longPressSeconds * 1000, () => {
        timer = null;
        if (!start) return;
        longFired = true;
        h.onContext?.(p);
      });
    }
  });
  zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_MOVE, (p: Phaser.Input.Pointer) => {
    if (start && Math.hypot(p.x - start.x, p.y - start.y) > moveTolerance()) cancel();
  });
  zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, (p: Phaser.Input.Pointer) => {
    const wasPressed = start !== null && !longFired;
    cancel();
    if (!wasPressed || p.button !== 0) return;
    const now = p.upTime;
    const double = now - lastTap < TUNING.os.doubleClickSeconds * 1000;
    lastTap = double ? -Infinity : now;
    h.onTap?.(p, double);
  });
  zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, cancel);
  return cancel;
}

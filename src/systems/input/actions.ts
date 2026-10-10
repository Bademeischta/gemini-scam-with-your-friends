/**
 * Alle Spieler-Aktionen. Jedes Eingabegerät (Tastatur, Gamepad, Touch) erzeugt diese Aktionen;
 * Spiellogik und UI fragen nur Aktionen ab, nie Tasten oder Buttons.
 */
export const ACTIONS = [
  // Laufen im Büro
  'moveUp',
  'moveDown',
  'moveLeft',
  'moveRight',
  // Büro-Aktionen
  'interact',
  'use',
  'drop',
  'emote',
  'leave',
  'talk',
  'bossKey',
  // Telefon
  'hold',
  'hangup',
  'card1',
  'card2',
  'card3',
  'card4',
  // Desktop
  'nextApp',
  'prevApp',
  // Menüs und UI
  'uiUp',
  'uiDown',
  'uiLeft',
  'uiRight',
  'uiConfirm',
  'uiBack',
  'pause',
] as const;

export type Action = (typeof ACTIONS)[number];

export type PadBinding = { button: number } | { axis: number; dir: 1 | -1 };

export interface Bindings {
  /** KeyboardEvent.code-Werte je Aktion. */
  keys: Record<Action, string[]>;
  /** Gamepad-Buttons bzw. Achsenrichtungen je Aktion (Standard-Mapping). */
  pad: Record<Action, PadBinding[]>;
}

export function isAction(value: string): value is Action {
  return (ACTIONS as readonly string[]).includes(value);
}

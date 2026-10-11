import type { Action, Bindings, PadBinding } from '../systems/input/actions';
import type { HintMode } from '../systems/input/device';
import { i18n, t } from './index';

/** Anzeigename einer Taste (KeyboardEvent.code), z. B. 'KeyE' → 'E', 'Escape' → 'Esc'. */
export function keyLabel(code: string): string {
  const key = `keys.${code}`;
  if (i18n.has(key)) return t(key);
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  return code;
}

/** Anzeigename eines Gamepad-Buttons bzw. einer Stick-Richtung. */
export function padLabel(b: PadBinding): string {
  if ('button' in b) {
    const key = `padButtons.${b.button}`;
    return i18n.has(key) ? t(key) : `#${b.button}`;
  }
  return `Stick ${b.axis}${b.dir > 0 ? '+' : '-'}`;
}

/** Taste bzw. Button für eine Aktion im aktuellen Hinweis-Modus (Touch: leer, dort zeigt der Button das Symbol). */
export function actionKey(action: Action, mode: HintMode, bindings: Bindings): string {
  if (mode === 'touch') return '';
  if (mode === 'gamepad') {
    const b = bindings.pad[action][0];
    return b ? padLabel(b) : '';
  }
  const code = bindings.keys[action][0];
  return code ? keyLabel(code) : '';
}

/** „E: Hinsetzen“ bzw. nur „Hinsetzen“ auf Touch-Geräten. */
export function actionHint(action: Action, label: string, mode: HintMode, bindings: Bindings): string {
  const key = actionKey(action, mode, bindings);
  return key ? t('office.keyHint', { key, action: label }) : label;
}

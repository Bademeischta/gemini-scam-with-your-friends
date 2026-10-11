import type { FormFactor } from '../input/device';

/**
 * Hinweis „Handy quer halten“: nur auf Handys im Hochformat, bis der Spieler ihn wegklickt.
 * Hochformat wird vollständig unterstützt – der Hinweis ist eine Empfehlung, keine Sperre.
 */
export function shouldShowRotateHint(formFactor: FormFactor, orientation: 'landscape' | 'portrait', accepted: boolean): boolean {
  return formFactor === 'phone' && orientation === 'portrait' && !accepted;
}

export class OrientationHint {
  private shown = false;

  constructor(
    private readonly el: HTMLElement,
    button: HTMLElement,
    onAccept: () => void,
    private readonly onVisibility: (visible: boolean) => void,
  ) {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      onAccept();
    });
  }

  get visible(): boolean {
    return this.shown;
  }

  set(show: boolean): void {
    if (show === this.shown) return;
    this.shown = show;
    this.el.hidden = !show;
    this.onVisibility(show);
  }
}

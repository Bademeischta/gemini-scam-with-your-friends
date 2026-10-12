import { PALETTE } from '../../config/palette';
import type { Rect } from './focusNav';

export interface TextInputOptions {
  placeholder: string;
  maxLength?: number;
  onSubmit(text: string): void;
  /** Taste bei leerem Feld (z. B. 1–4 für Karten); true = verbraucht. */
  onEmptyKey?(key: string): boolean;
  onChange?(text: string): void;
  /** Verdeckte Eingabe (API-Schlüssel). */
  secret?: boolean;
}

/**
 * Echte Texteingabe für MogelOS: ein natives <input> über dem Canvas (Bildschirmtastatur auf Handys,
 * Autokorrektur aus, Enter sendet). Es gibt genau eines; wer es braucht, „besitzt“ es, bis er es freigibt.
 * Tastendrücke im Feld lösen keine Spiel-Aktionen aus (siehe InputManager, fromTextField).
 */
export class TextInputBridge {
  private static inst: TextInputBridge | null = null;
  private readonly el: HTMLInputElement;
  private owner: object | null = null;
  private opts: TextInputOptions | null = null;
  /** Pause, Bildschirm-Übergang: Feld unsichtbar, egal was der Besitzer will. */
  private suspended = false;
  private wanted: { rect: Rect; dpr: number } | null = null;

  static get(): TextInputBridge {
    if (!TextInputBridge.inst) TextInputBridge.inst = new TextInputBridge();
    return TextInputBridge.inst;
  }

  private constructor() {
    const el = document.createElement('input');
    el.type = 'text';
    el.id = 'os-text-input';
    el.autocomplete = 'off';
    el.spellcheck = false;
    el.setAttribute('autocorrect', 'off');
    el.setAttribute('autocapitalize', 'sentences');
    el.setAttribute('enterkeyhint', 'send');
    Object.assign(el.style, {
      position: 'fixed',
      left: '0px',
      top: '0px',
      width: '10px',
      height: '10px',
      display: 'none',
      zIndex: '5',
      border: 'none',
      outline: 'none',
      padding: '0 8px',
      margin: '0',
      boxSizing: 'border-box',
      background: 'transparent',
      color: PALETTE.paper,
      caretColor: PALETTE.mustard,
      // Mindestens 16 px, sonst zoomt iOS beim Fokussieren.
      fontSize: '16px',
      fontFamily: 'ui-monospace, "Cascadia Mono", "DejaVu Sans Mono", monospace',
      touchAction: 'manipulation',
      userSelect: 'text',
      webkitUserSelect: 'text',
    } satisfies Partial<CSSStyleDeclaration>);
    el.addEventListener('keydown', (e) => {
      if (!this.opts) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        const text = el.value.trim();
        if (text) {
          el.value = '';
          this.opts.onChange?.('');
          this.opts.onSubmit(text);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        el.blur();
        return;
      }
      if (el.value === '' && this.opts.onEmptyKey?.(e.key)) e.preventDefault();
    });
    el.addEventListener('input', () => this.opts?.onChange?.(el.value));
    document.body.appendChild(el);
    this.el = el;
  }

  get value(): string {
    return this.el.value;
  }

  get focused(): boolean {
    return document.activeElement === this.el;
  }

  get ownedBy(): object | null {
    return this.owner;
  }

  /** Feld übernehmen (vorheriger Besitzer verliert es). */
  attach(owner: object, opts: TextInputOptions): void {
    if (this.owner !== owner) this.el.value = '';
    this.owner = owner;
    this.opts = opts;
    this.el.placeholder = opts.placeholder;
    this.el.type = opts.secret ? 'password' : 'text';
    this.el.autocomplete = opts.secret ? 'new-password' : 'off';
    this.el.maxLength = opts.maxLength ?? 200;
  }

  detach(owner: object): void {
    if (this.owner !== owner) return;
    this.el.blur();
    this.el.style.display = 'none';
    this.el.type = 'text';
    this.el.value = '';
    this.owner = null;
    this.opts = null;
    this.wanted = null;
  }

  /** Position in physischen Canvas-Pixeln; `dpr` rechnet in CSS-Pixel um. Null = ausblenden. */
  place(owner: object, rect: Rect | null, dpr: number): void {
    if (this.owner !== owner) return;
    this.wanted = rect && rect.w > 0 ? { rect, dpr } : null;
    this.apply();
  }

  /** Während Pause und Übergängen ausblenden (das Feld liegt sonst über dem Pausenmenü). */
  setSuspended(on: boolean): void {
    if (on === this.suspended) return;
    this.suspended = on;
    this.apply();
  }

  get visible(): boolean {
    return this.el.style.display !== 'none';
  }

  private apply(): void {
    const w = this.wanted;
    if (!w || this.suspended || !this.owner) {
      if (this.focused) this.el.blur();
      this.el.style.display = 'none';
      return;
    }
    const { rect, dpr } = w;
    const s = this.el.style;
    s.display = 'block';
    s.left = `${rect.x / dpr}px`;
    s.top = `${rect.y / dpr}px`;
    s.width = `${rect.w / dpr}px`;
    s.height = `${rect.h / dpr}px`;
  }

  focus(owner: object): void {
    if (this.owner === owner && this.el.style.display !== 'none') this.el.focus({ preventScroll: true });
  }

  blur(): void {
    this.el.blur();
  }

  /** Text programmatisch setzen (z. B. Spracheingabe als Entwurf). */
  setValue(owner: object, text: string): void {
    if (this.owner === owner) this.el.value = text;
  }
}

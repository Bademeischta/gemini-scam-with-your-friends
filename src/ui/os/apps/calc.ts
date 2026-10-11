import Phaser from 'phaser';
import { hex } from '../../../config/palette';
import { t } from '../../../i18n';
import { Calculator, calcKeyFor, type CalcKey } from '../../../systems/os/calculator';
import { PixelLabel } from '../../PixelLabel';
import { drawBevel, OsButton } from '../widgets';
import type { AppContext, AppDef, AppView } from './types';

/** Tastenfeld: 4 Spalten, die Null ist doppelt breit. */
const KEYPAD: readonly (readonly CalcKey[])[] = [
  ['C', '±', '⌫', '÷'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '-'],
  ['1', '2', '3', '+'],
  ['0', ',', '='],
];

/** Rechner (APP-49): Maus/Touch auf dem Tastenfeld, Tastatur direkt, Gamepad über den Fokus. */
class CalcView implements AppView {
  private readonly calc = new Calculator(t('os.calc.error'));
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly display: PixelLabel;
  private readonly keys = new Map<CalcKey, OsButton>();
  private flash: { btn: OsButton; time: number } | null = null;
  private displayRect = { x: 0, y: 0, w: 0, h: 0 };

  constructor(private readonly ctx: AppContext) {
    const { host } = ctx;
    this.g = host.scene.add.graphics();
    host.container.add(this.g);
    this.display = new PixelLabel(host.scene, '0', { scale: host.u(), color: 'ink0', shadow: null, originX: 1, originY: 0.5, container: host.container });
    for (const row of KEYPAD)
      for (const k of row) {
        const variant = k === '=' ? 'primary' : 'normal';
        this.keys.set(k, new OsButton(host, `${ctx.win.id}:key:${k}`, { label: k, variant, onClick: () => this.press(k) }));
      }
    this.refresh();
  }

  layout(w: number, h: number): void {
    const u = this.ctx.host.u();
    const gap = 2 * u;
    // Nicht breiter als ein echter Taschenrechner (Handy quer): mittig mit Rand.
    const cw = Math.min(w, Math.max(110 * u, Math.round(h * 0.9)));
    const x0 = Math.round((w - cw) / 2);
    const dispH = Math.max(18 * u, Math.round(h * 0.18));
    this.displayRect = { x: x0, y: 0, w: cw, h: dispH };
    const rows = KEYPAD.length;
    const cellW = (cw - gap * 3) / 4;
    const cellH = (h - dispH - gap * rows) / rows;
    KEYPAD.forEach((row, r) => {
      let col = 0;
      for (const k of row) {
        const span = k === '0' ? 2 : 1;
        const bw = cellW * span + gap * (span - 1);
        this.keys.get(k)?.layout(x0 + col * (cellW + gap), dispH + gap + r * (cellH + gap), bw, cellH);
        col += span;
      }
    });
    this.refresh();
  }

  update(dt: number): void {
    if (!this.flash) return;
    this.flash.time -= dt;
    if (this.flash.time <= 0) {
      this.flash.btn.setActive(false);
      this.flash = null;
    }
  }

  onTyped(keys: readonly string[]): boolean {
    let used = false;
    for (const key of keys) {
      const k = calcKeyFor(key);
      if (!k) continue;
      used = true;
      this.press(k);
      // Kurz aufleuchten lassen, welche Taste gedrückt wurde.
      const btn = this.keys.get(k);
      if (btn) {
        this.flash?.btn.setActive(false);
        btn.setActive(true);
        this.flash = { btn, time: 0.12 };
        this.ctx.host.s.sfx.move();
      }
    }
    return used;
  }

  firstFocus(): string | undefined {
    return `${this.ctx.win.id}:key:7`;
  }

  state(): unknown {
    return { display: this.calc.display };
  }

  destroy(): void {
    for (const b of this.keys.values()) b.destroy();
    this.display.destroy();
    this.g.destroy();
  }

  private press(k: CalcKey): void {
    this.calc.press(k);
    this.refresh();
  }

  private refresh(): void {
    const u = this.ctx.host.u();
    const th = this.ctx.host.theme();
    const { x, y, w, h } = this.displayRect;
    this.g.clear();
    if (w <= 0) return;
    drawBevel(this.g, x, y, w, h, u, 'mint', 'teal', 'leaf', true);
    this.g.fillStyle(hex('teal'), 0.25).fillRect(x + 2 * u, y + 2 * u, w - 4 * u, Math.round(h / 3));
    const text = this.calc.display.replace(',', t('os.calc.decimal'));
    // So groß wie möglich, aber immer ganzzahlig skaliert.
    let scale = Math.max(u, Math.floor((h * 0.55) / 7));
    this.display.setText(text);
    while (scale > 1) {
      this.display.setScale(scale);
      if (this.display.width <= w - 8 * u) break;
      scale--;
    }
    this.display.setScale(scale).setColor(th.id === 'klassik' ? 'ink0' : 'ink1').setPosition(x + w - 4 * u, Math.round(y + h / 2));
  }
}

export const calcApp: AppDef = {
  id: 'calc',
  icon: 'calc',
  titleKey: 'os.apps.calc.title',
  shortKey: 'os.apps.calc.short',
  size: { w: 120, h: 160 },
  onDesktop: true,
  inStartMenu: true,
  create: (ctx) => new CalcView(ctx),
};

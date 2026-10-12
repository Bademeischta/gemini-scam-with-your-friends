import Phaser from 'phaser';
import { hex } from '../../config/palette';
import { TUNING } from '../../config/tuning';
import { portraitTexture } from '../../gfx/phaserTextures';
import { t } from '../../i18n';
import type { CallerDef } from '../../systems/conversation/caller';
import { PixelLabel } from '../PixelLabel';
import type { Rect } from './focusNav';
import { rootHost, type HostBase } from './host';
import { controlHeight, drawBevel, fitLabel, OsButton } from './widgets';

export interface CallPopupOptions {
  onAnswer(): void;
  onDecline(): void;
}

/**
 * Eingehender Anruf am eigenen Platz (OS-08): Porträt, Name, verbleibende Zeit, Annehmen/Ablehnen.
 * Auf Touch auch per Wischen nach oben annehmbar (CTL-11); E/A nimmt an, Entf/LT lehnt ab.
 */
export class CallPopup {
  private readonly c: Phaser.GameObjects.Container;
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly portrait: Phaser.GameObjects.Image;
  private readonly title: PixelLabel;
  private readonly name: PixelLabel;
  private readonly hint: PixelLabel;
  private readonly answer: OsButton;
  private readonly decline: OsButton;
  private readonly zone: Phaser.GameObjects.Zone;
  private readonly host: ReturnType<typeof rootHost>;
  private caller: CallerDef | null = null;
  private callId = -1;
  private left = 1;
  private age = 0;
  private w = 0;
  private h = 0;
  private area: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private swipe: { y: number; time: number } | null = null;

  constructor(
    private readonly base: HostBase,
    depth: number,
    private readonly o: CallPopupOptions,
  ) {
    const sc = base.scene;
    this.c = sc.add.container(0, 0).setDepth(depth).setVisible(false);
    this.host = rootHost(base, this.c, 'call');
    this.g = sc.add.graphics();
    this.zone = sc.add.zone(0, 0, 1, 1).setOrigin(0, 0).setInteractive();
    this.portrait = sc.add.image(0, 0, '__DEFAULT').setOrigin(0, 0);
    this.c.add([this.g, this.zone, this.portrait]);
    const u = base.u();
    this.title = new PixelLabel(sc, t('calls.popup.title'), { scale: u, color: 'mustard', shadow: null, container: this.c });
    this.name = new PixelLabel(sc, '', { scale: u, color: 'white', shadow: null, container: this.c });
    this.hint = new PixelLabel(sc, '', { scale: u, color: 'fog', shadow: null, container: this.c });
    this.answer = new OsButton(this.host, 'call:answer', { label: t('calls.popup.answer'), icon: 'os-icon-answer', variant: 'primary', onClick: () => this.o.onAnswer() });
    this.decline = new OsButton(this.host, 'call:decline', { label: t('calls.popup.decline'), icon: 'os-icon-hangup', onClick: () => this.o.onDecline() });
    // Wischen nach oben nimmt an (Handy).
    this.zone.on('pointerdown', (p: Phaser.Input.Pointer) => (this.swipe = { y: p.y, time: p.downTime }));
    this.zone.on('pointerup', (p: Phaser.Input.Pointer) => {
      const sw = this.swipe;
      this.swipe = null;
      if (!sw) return;
      const dy = p.y - sw.y;
      if (-dy >= TUNING.os.swipeMinDistance * 0.6 * base.dpr() && (p.upTime - sw.time) / 1000 <= TUNING.os.swipeMaxSeconds) this.o.onAnswer();
    });
  }

  get visible(): boolean {
    return this.caller !== null;
  }

  get shownCallId(): number {
    return this.callId;
  }

  show(caller: CallerDef, callId: number): void {
    if (this.callId === callId && this.caller) return;
    this.caller = caller;
    this.callId = callId;
    this.age = 0;
    this.portrait.setTexture(portraitTexture(this.base.scene, caller, 'neutral'));
    this.c.setVisible(true);
    this.measure();
  }

  hide(): void {
    if (!this.caller) return;
    this.caller = null;
    this.callId = -1;
    this.c.setVisible(false);
    this.answer.setVisible(false);
    this.decline.setVisible(false);
  }

  /** `left` = verbleibender Anteil des Abnehm-Fensters (0–1). */
  update(dt: number, left: number): void {
    if (!this.caller) return;
    this.age += dt;
    this.left = left;
    // Hereingleiten und leichtes Wackeln im Klingel-Takt.
    const u = this.base.u();
    const slide = 1 - (1 - Math.min(1, this.age / 0.25)) ** 3;
    const t = this.age % 1.6;
    const shake = t < 0.9 ? Math.round(Math.sin(this.age * 60) * u) : 0;
    this.c.setPosition(Math.round(this.area.x + (this.area.w - this.w) / 2) + shake, Math.round(this.area.y + 4 * u - (1 - slide) * (this.h + 8 * u)));
    this.host.moved();
    this.drawPanel();
  }

  layout(area: Rect): void {
    this.area = area;
    if (this.caller) this.measure();
  }

  redraw(): void {
    if (this.caller) this.measure();
  }

  snapshot(): unknown {
    if (!this.caller) return null;
    const d = this.base.dpr();
    return { callerId: this.caller.id, callId: this.callId, left: this.left, rect: { x: this.c.x / d, y: this.c.y / d, w: this.w / d, h: this.h / d } };
  }

  destroy(): void {
    this.answer.destroy();
    this.decline.destroy();
    this.title.destroy();
    this.name.destroy();
    this.hint.destroy();
    this.c.destroy(true);
  }

  private measure(): void {
    const caller = this.caller;
    if (!caller) return;
    const u = this.base.u();
    const th = this.base.theme();
    const ch = controlHeight(this.base);
    const ps = Math.max(1, Math.round(u * 1.5));
    const pw = 32 * ps;
    const pad = 5 * u;
    const textX = pad + pw + 5 * u;
    // So breit, dass Name und Hinweis ganz hineinpassen (höchstens so breit wie der Desktop).
    const mode = this.base.s.device.hintMode;
    const fullName = t(`callers.${caller.id}.name`);
    const fullHint = t(`calls.popup.hint.${mode}`);
    this.name.setScale(u).setText(fullName);
    this.hint.setScale(u).setText(fullHint);
    const want = textX + Math.max(this.name.width, this.hint.width, this.title.width) + pad;
    const w = Math.round(Math.min(this.area.w - 8 * u, Math.max(160 * u, 300 * this.base.dpr(), want)));
    const textW = w - textX - pad;
    this.portrait.setScale(ps).setPosition(pad, pad);
    this.title.setScale(u).setColor(th.accent).setPosition(textX, pad);
    fitLabel(this.name, fullName, textW);
    this.name.setScale(u).setColor(th.text).setPosition(textX, pad + this.title.height + 3 * u);
    fitLabel(this.hint, fullHint, textW);
    this.hint.setScale(u).setColor(th.textDim).setPosition(textX, pad + this.title.height + this.name.height + 6 * u);
    const barY = pad + pw + 4 * u;
    const btnY = barY + 6 * u;
    const bw = (w - 2 * pad - 3 * u) / 2;
    this.answer.setVisible(true).setIconScale(u).layout(pad, btnY, bw, ch);
    this.decline.setVisible(true).setIconScale(u).layout(pad + bw + 3 * u, btnY, bw, ch);
    this.w = w;
    this.h = Math.round(btnY + ch + pad);
    this.zone.setSize(this.w, this.h);
    this.zone.input?.hitArea.setTo(0, 0, this.w, this.h);
    this.drawPanel();
  }

  private drawPanel(): void {
    const u = this.base.u();
    const th = this.base.theme();
    const g = this.g;
    const { w, h } = this;
    g.clear();
    g.fillStyle(hex('ink0'), 0.5).fillRect(3 * u, 3 * u, w, h);
    drawBevel(g, 0, 0, w, h, u, th.window, th.frameLight, th.frame);
    // Klingel-Leiste oben und Restzeit.
    const pad = 5 * u;
    const ps = Math.max(1, Math.round(u * 1.5));
    const barY = pad + 32 * ps + 4 * u;
    const bw = w - 2 * pad;
    g.fillStyle(hex(th.windowDark), 1).fillRect(pad, barY, bw, 2 * u);
    g.fillStyle(hex(this.left < 0.3 ? 'red' : th.accent), 1).fillRect(pad, barY, Math.round(bw * Math.max(0, this.left)), 2 * u);
    // Rahmen ums Porträt.
    g.fillStyle(hex('ink0'), 1).fillRect(pad - u, pad - u, 32 * ps + 2 * u, 32 * ps + 2 * u);
    g.fillStyle(hex('ink2'), 1).fillRect(pad, pad, 32 * ps, 32 * ps);
  }
}

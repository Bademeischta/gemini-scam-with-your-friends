import Phaser from 'phaser';
import { hex, PALETTE } from '../../config/palette';
import type { TranscriptLine } from '../../systems/calls/PhoneHub';
import { PixelLabel } from '../PixelLabel';
import type { NavDir } from './focusNav';
import { BODY_FONT, drawBevel, Widget, type Host } from './widgets';

/** Schriftgrößen (CSS-px), die eine Karte nacheinander probiert, bis der Satz hineinpasst. */
const CARD_FONT_SIZES = [15, 14, 13, 12, 11, 10];

/**
 * Schnellantwort-Karte (CAL-06): ein ganzer Satz in Systemschrift mit Nummer (1–4).
 * Antippen, Klick, Fokus + A/Enter oder die Zifferntaste sagt den Satz.
 */
export class OsCard extends Widget {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly badge: PixelLabel;
  private readonly text: Phaser.GameObjects.Text;
  private readonly zone: Phaser.GameObjects.Zone;
  private content = '';
  private pressed = false;
  private hover = false;
  private enabled = true;
  private flash = 0;

  constructor(
    host: Host,
    id: string,
    badge: string,
    private readonly onClick: () => void,
  ) {
    super(host, id);
    const sc = host.scene;
    this.g = sc.add.graphics();
    this.text = sc.add.text(0, 0, '', { fontFamily: BODY_FONT, color: PALETTE.white, fontSize: '14px' });
    this.badge = new PixelLabel(sc, badge, { scale: host.u(), color: 'ink0', shadow: null, originX: 0.5, originY: 0.5, container: host.container });
    this.zone = sc.add.zone(0, 0, 1, 1).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    host.container.add([this.g, this.text]);
    host.container.bringToTop(this.badge.main);
    host.container.add(this.zone);
    this.zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.enabled || p.button !== 0) return;
      this.pressed = true;
      this.draw();
    });
    this.zone.on('pointerup', () => {
      if (!this.enabled || !this.pressed) return;
      this.pressed = false;
      this.click();
    });
    this.zone.on('pointerout', () => {
      this.pressed = false;
      this.hover = false;
      this.draw();
    });
    this.zone.on('pointerover', (p: Phaser.Input.Pointer) => {
      this.hover = !p.wasTouch;
      this.draw();
    });
    this.unregister = host.focus.register({
      id,
      scope: host.scope,
      rect: () => this.screenRect(),
      activate: () => this.click(),
      enabled: () => this.enabled && this.visible && this.rect.w > 0 && this.content !== '',
    });
  }

  get label(): string {
    return this.content;
  }

  click(): void {
    if (!this.enabled || this.content === '') return;
    this.flash = 0.15;
    this.draw();
    this.onClick();
  }

  setCard(text: string): this {
    if (text === this.content) return this;
    this.content = text;
    this.fit();
    this.draw();
    return this;
  }

  setEnabled(on: boolean): this {
    if (on === this.enabled) return this;
    this.enabled = on;
    this.draw();
    return this;
  }

  setVisible(on: boolean): this {
    this.visible = on;
    this.g.setVisible(on);
    this.text.setVisible(on);
    this.badge.setVisible(on);
    if (on) this.zone.setInteractive();
    else this.zone.disableInteractive();
    return this;
  }

  layout(x: number, y: number, w: number, h: number): this {
    this.rect = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
    this.zone.setPosition(this.rect.x, this.rect.y).setSize(this.rect.w, this.rect.h);
    this.zone.input?.hitArea.setTo(0, 0, this.rect.w, this.rect.h);
    this.fit();
    this.draw();
    return this;
  }

  update(dt: number): void {
    if (this.flash <= 0) return;
    this.flash -= dt;
    if (this.flash <= 0) this.draw();
  }

  draw(): void {
    const g = this.g;
    g.clear();
    if (!this.visible || this.rect.w === 0) return;
    const t = this.host.theme();
    const u = this.host.u();
    const { x, y, w, h } = this.rect;
    const lit = this.flash > 0;
    drawBevel(g, x, y, w, h, u, lit ? t.accent : this.hover ? t.buttonLight : t.button, t.buttonLight, t.buttonDark, this.pressed || lit);
    // Nummern-Plakette links oben.
    const bs = this.badgeSize();
    g.fillStyle(hex(t.accent), 1).fillRect(x + 2 * u, y + 2 * u, bs, bs);
    const alpha = this.enabled && this.content ? 1 : 0.4;
    this.text.setAlpha(alpha).setColor(PALETTE[lit ? 'ink0' : t.text]);
    this.badge.setAlpha(alpha);
  }

  destroy(): void {
    this.unregister?.();
    this.g.destroy();
    this.text.destroy();
    this.badge.destroy();
    this.zone.destroy();
  }

  private badgeSize(): number {
    return 9 * this.host.u();
  }

  /** Größte Schrift, bei der der Satz vollständig in die Karte passt. */
  private fit(): void {
    const { x, y, w, h } = this.rect;
    if (w <= 0) return;
    const u = this.host.u();
    const d = this.host.dpr();
    const bs = this.badgeSize();
    this.badge.setScale(u).setPosition(Math.round(x + 2 * u + bs / 2), Math.round(y + 2 * u + bs / 2));
    const left = x + bs + 5 * u;
    const availW = Math.max(10, x + w - 4 * u - left);
    const availH = Math.max(10, h - 6 * u);
    // Längstes Wort darf nicht umbrochen werden müssen („Bürgernummer-Kärtchen“).
    const longest = this.content.split(/\s+/).reduce((a, b) => (b.length > a.length ? b : a), '');
    for (const s of CARD_FONT_SIZES) {
      this.text.setStyle({ fontSize: `${Math.round(s * d)}px`, wordWrap: { width: null } });
      this.text.setText(longest);
      const wordFits = this.text.width <= availW;
      this.text.setStyle({ wordWrap: { width: availW, useAdvancedWrap: true } });
      this.text.setLineSpacing(Math.round(1 * d));
      this.text.setText(this.content);
      if (wordFits && this.text.height <= availH) break;
    }
    this.text.setPosition(Math.round(left), Math.round(y + Math.max(3 * u, (h - this.text.height) / 2)));
  }
}

interface ChatRow {
  line: TranscriptLine;
  text: Phaser.GameObjects.Text;
  /** Fertig umbrochener Volltext (damit Wörter beim Tippen nicht springen). */
  wrapped: string;
  shown: number;
  /** Maße des Volltexts. */
  w: number;
  h: number;
}

/**
 * Gesprächsverlauf mit Sprechblasen (CAL-18): Anrufer links, Spieler rechts, neue Zeilen erscheinen
 * mit Schreibmaschinen-Effekt. Scrollbar per Ziehen, Mausrad und Tastatur/Gamepad.
 */
export class ChatLog extends Widget {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly inner: Phaser.GameObjects.Container;
  private readonly maskShape: Phaser.GameObjects.Graphics;
  private readonly zone: Phaser.GameObjects.Zone;
  private rows: ChatRow[] = [];
  private scroll = 0;
  private stick = true;
  private drag: { y: number; scroll: number } | null = null;
  private contentH = 0;
  /** Platzhalter, wenn noch nichts gesagt wurde. */
  private readonly empty: Phaser.GameObjects.Text;

  constructor(host: Host, id: string) {
    super(host, id);
    const sc = host.scene;
    this.g = sc.add.graphics();
    this.inner = sc.add.container(0, 0);
    this.maskShape = sc.make.graphics({}, false);
    this.inner.setMask(this.maskShape.createGeometryMask());
    this.zone = sc.add.zone(0, 0, 1, 1).setOrigin(0, 0).setInteractive();
    this.empty = sc.add.text(0, 0, '', { fontFamily: BODY_FONT, color: PALETTE.fog, fontSize: '13px', align: 'center' }).setOrigin(0.5, 0.5);
    host.container.add([this.g, this.inner, this.empty, this.zone]);
    this.zone.on('pointerdown', (p: Phaser.Input.Pointer) => (this.drag = { y: p.y, scroll: this.scroll }));
    this.zone.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.drag && p.isDown) this.setScroll(this.drag.scroll - (p.y - this.drag.y));
    });
    this.zone.on('pointerup', () => (this.drag = null));
    this.zone.on('wheel', (_p: Phaser.Input.Pointer, _dx: number, dy: number) => this.setScroll(this.scroll + dy));
    host.onMove(() => this.updateMask());
    this.unregister = host.focus.register({
      id,
      scope: host.scope,
      rect: () => this.screenRect(),
      activate: () => undefined,
      enabled: () => this.visible && this.rect.w > 0 && this.contentH > this.rect.h,
      navigate: (dir: NavDir) => {
        const step = 40 * this.host.dpr();
        if (dir === 'down' && this.scroll < this.maxScroll()) {
          this.setScroll(this.scroll + step);
          return true;
        }
        if (dir === 'up' && this.scroll > 0) {
          this.setScroll(this.scroll - step);
          return true;
        }
        return false;
      },
    });
  }

  setEmptyText(text: string): this {
    this.empty.setText(text);
    return this;
  }

  setVisible(on: boolean): this {
    this.visible = on;
    this.g.setVisible(on);
    this.inner.setVisible(on);
    this.empty.setVisible(on && this.rows.length === 0);
    if (on) this.zone.setInteractive();
    else this.zone.disableInteractive();
    return this;
  }

  layout(x: number, y: number, w: number, h: number): this {
    const widthChanged = Math.round(w) !== this.rect.w;
    this.rect = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
    this.zone.setPosition(this.rect.x, this.rect.y).setSize(this.rect.w, this.rect.h);
    this.zone.input?.hitArea.setTo(0, 0, this.rect.w, this.rect.h);
    this.empty.setStyle({ fontSize: `${Math.round(13 * this.host.dpr())}px`, color: PALETTE[this.host.theme().textDim], wordWrap: { width: this.rect.w - 16 * this.host.u() } });
    this.empty.setPosition(Math.round(this.rect.x + this.rect.w / 2), Math.round(this.rect.y + this.rect.h / 2));
    if (widthChanged) for (const r of this.rows) this.wrap(r);
    this.relayout();
    this.updateMask();
    return this;
  }

  /** Verlauf abgleichen (neue Zeilen anlegen, sichtbare Zeichen nachziehen). */
  sync(lines: readonly TranscriptLine[]): void {
    if (lines.length < this.rows.length || (lines.length > 0 && this.rows.length > 0 && this.rows[0]!.line !== lines[0])) this.clear();
    let changed = false;
    for (let i = this.rows.length; i < lines.length; i++) {
      const line = lines[i]!;
      const text = this.host.scene.add.text(0, 0, '', { fontFamily: BODY_FONT, color: PALETTE.white, fontSize: '14px' });
      this.inner.add(text);
      const row: ChatRow = { line, text, wrapped: '', shown: -1, w: 0, h: 0 };
      this.rows.push(row);
      this.wrap(row);
      changed = true;
    }
    for (const r of this.rows) {
      if (r.shown === r.line.shown) continue;
      // Eine wartende Zeile beginnt: erst jetzt bekommt sie Platz im Verlauf.
      if (r.shown <= 0 && r.line.shown > 0) changed = true;
      r.shown = r.line.shown;
      const frac = r.line.text.length > 0 ? r.shown / r.line.text.length : 1;
      r.text.setText(r.wrapped.slice(0, Math.round(frac * r.wrapped.length)));
    }
    this.empty.setVisible(this.visible && this.rows.length === 0);
    if (changed) this.relayout();
  }

  clear(): void {
    for (const r of this.rows) r.text.destroy();
    this.rows = [];
    this.scroll = 0;
    this.stick = true;
    this.relayout();
  }

  destroy(): void {
    this.unregister?.();
    this.g.destroy();
    this.inner.destroy(true);
    this.maskShape.destroy();
    this.empty.destroy();
    this.zone.destroy();
  }

  private bubbleW(): number {
    return Math.round(this.rect.w * 0.8);
  }

  private wrap(r: ChatRow): void {
    const d = this.host.dpr();
    const u = this.host.u();
    const t = this.host.theme();
    const player = r.line.who === 'player';
    r.text.setStyle({
      fontSize: `${Math.round(14 * d)}px`,
      color: PALETTE[player ? 'ink0' : t.text],
      wordWrap: { width: Math.max(20, this.bubbleW() - 8 * u), useAdvancedWrap: true },
    });
    r.text.setLineSpacing(Math.round(2 * d));
    r.wrapped = r.text.getWrappedText(r.line.text).join('\n');
    r.text.setText(r.wrapped);
    r.w = r.text.width;
    r.h = r.text.height;
    r.shown = -1;
    const frac = r.line.text.length > 0 ? r.line.shown / r.line.text.length : 1;
    r.text.setText(r.wrapped.slice(0, Math.round(frac * r.wrapped.length)));
    r.shown = r.line.shown;
  }

  private relayout(): void {
    const u = this.host.u();
    const { x, w } = this.rect;
    let cy = 4 * u;
    const pad = 4 * u;
    for (const r of this.rows) {
      const player = r.line.who === 'player';
      const tw = Math.min(this.bubbleW(), Math.ceil(r.w) + 2 * pad);
      const waiting = r.line.shown <= 0;
      r.text.setData('cy', cy);
      r.text.setData('bw', tw);
      r.text.setData('hidden', waiting);
      r.text.setVisible(!waiting);
      r.text.setPosition(player ? x + w - 4 * u - tw + pad : x + 4 * u + pad, 0);
      if (!waiting) cy += r.h + 2 * pad + 3 * u;
    }
    this.contentH = cy + u;
    if (this.stick) this.scroll = this.maxScroll();
    this.setScroll(this.scroll);
  }

  private maxScroll(): number {
    return Math.max(0, this.contentH - this.rect.h);
  }

  private setScroll(v: number): void {
    this.scroll = Phaser.Math.Clamp(v, 0, this.maxScroll());
    this.stick = this.scroll >= this.maxScroll() - 2;
    this.drawBubbles();
  }

  /** Blasen und Textposition für die aktuelle Scrollposition. */
  private drawBubbles(): void {
    const g = this.g;
    const t = this.host.theme();
    const u = this.host.u();
    const { x, y, w, h } = this.rect;
    g.clear();
    if (w <= 0) return;
    g.fillStyle(hex(t.windowDark), 1).fillRect(x, y, w, h);
    const pad = 4 * u;
    for (const r of this.rows) {
      const player = r.line.who === 'player';
      const cy = (r.text.getData('cy') as number) - this.scroll;
      const bw = r.text.getData('bw') as number;
      const bh = r.h + 2 * pad;
      const bx = player ? x + w - 4 * u - bw : x + 4 * u;
      const by = y + cy;
      r.text.setY(Math.round(by + pad));
      if (r.text.getData('hidden') || by > y + h || by + bh < y) continue;
      const fill = player ? t.accent : t.window;
      // Auf den sichtbaren Bereich zuschneiden (die Texte maskiert der Container).
      const clip = (ry: number, rh: number): [number, number] => {
        const top = Math.max(y, ry);
        return [top, Math.max(0, Math.min(y + h, ry + rh) - top)];
      };
      const [oy, oh] = clip(by, bh);
      g.fillStyle(hex('ink0'), 1).fillRect(bx, oy, bw, oh);
      const [iy, ih] = clip(by + u, bh - 2 * u);
      g.fillStyle(hex(fill), 1).fillRect(bx + u, iy, bw - 2 * u, ih);
      // Kleiner Zipfel zur Seite des Sprechers.
      const tx = player ? bx + bw - 3 * u : bx + u;
      const [ty, th2] = clip(by + bh - u, 2 * u);
      g.fillStyle(hex(fill), 1).fillRect(tx, ty, 2 * u, th2);
    }
    if (this.contentH > h) {
      const barH = Math.max(6 * u, (h * h) / this.contentH);
      const barY = y + ((h - barH) * this.scroll) / (this.contentH - h);
      g.fillStyle(hex(t.buttonLight), 1).fillRect(x + w - 2 * u, barY, 2 * u, barH);
    }
  }

  private updateMask(): void {
    const r = this.screenRect();
    this.maskShape.clear().fillStyle(0xffffff, 1).fillRect(r.x, r.y, r.w, r.h);
  }
}

import type Phaser from 'phaser';
import { hex, PALETTE } from '../../../config/palette';
import type { SchemeInput } from '../../../data/schemes';
import { i18n, t } from '../../../i18n';
import type { LootItem, SubmitResult } from '../../../systems/calls/ledger';
import type { Rect } from '../focusNav';
import { TextInputBridge, type TextInputOptions } from '../TextInputBridge';
import { BODY_FONT, controlHeight, OsButton, OsList } from '../widgets';
import type { AppContext } from './types';

/** App, in die Beute einer Masche eingegeben wird (null = wird von selbst verbucht). */
export function lootTarget(input: SchemeInput, schemeId: string): { app: string; args?: unknown } | null {
  switch (input) {
    case 'identomat':
      return { app: 'identomat' };
    case 'gutschein':
      return { app: 'voucher' };
    case 'ferngucker':
      return { app: 'ferngucker' };
    case 'plauderbude':
      return { app: 'plauder' };
    case 'script':
      return { app: 'script', args: schemeId };
    case 'auto':
      return null;
  }
}

/** Anzeigename der Ziel-App („Ident-o-Mat“, „Mondmakler 3000“ …). */
export function lootTargetName(input: SchemeInput, schemeId: string): string {
  const tg = lootTarget(input, schemeId);
  if (!tg) return '';
  return tg.app === 'script' ? t(`schemes.${schemeId}.app`) : t(`os.apps.${tg.app}.title`);
}

/** Rückmeldung auf eine Eingabe. */
export function resultText(r: SubmitResult): { text: string; good: boolean } {
  if (r.ok) {
    if (r.item.input === 'ferngucker') return { text: t('os.loot.okFern', { name: t(`callers.${r.item.callerId}.short`) }), good: true };
    return { text: t('os.loot.ok', { amount: i18n.formatMoney(r.item.amount) }), good: true };
  }
  const name = r.item ? t(`callers.${r.item.callerId}.short`) : '';
  switch (r.reason) {
    case 'empty':
      return { text: t('os.loot.empty'), good: false };
    case 'bait':
      return { text: t('os.loot.bait', { name }), good: false };
    case 'locked':
      return { text: t('os.loot.locked', { name }), good: false };
    case 'unknown':
      return r.attemptsLeft !== undefined ? { text: t('os.loot.unknown', { count: r.attemptsLeft }), good: false } : { text: t('os.loot.unknownNone'), good: false };
  }
}

export interface LootEntryOptions {
  input: SchemeInput;
  /** Nur Beute dieser Masche (Skript-Apps). */
  schemeId?: string;
  placeholder: string;
  submitLabel: string;
  /** Verlauf der Beute dieser App anzeigen. */
  history: boolean;
  /** Nach dem Prüfen (z. B. FernGucker: Verbindung aufbauen). */
  onResult?: (r: SubmitResult) => void;
}

/**
 * Eingabezeile für Beute (SCH-19/20): Textfeld, Knopf, Rückmeldung und Verlauf. Was Anrufer verraten
 * haben, wird hier eingetippt – richtig: Auszahlung, dreimal falsch: futsch. Werte wartender Beute
 * zeigt der Verlauf nicht (mitschreiben muss man selbst).
 */
export class LootEntry {
  private readonly btn: OsButton;
  private readonly status: Phaser.GameObjects.Text;
  private readonly empty: Phaser.GameObjects.Text;
  private readonly list: OsList | null;
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly bridge = TextInputBridge.get();
  private readonly off: () => void;
  private readonly inputOpts: TextInputOptions;
  private inputRect: Rect | null = null;
  private visible = true;
  private result: { text: string; good: boolean } | null = null;

  constructor(
    private readonly ctx: AppContext,
    id: string,
    private readonly opts: LootEntryOptions,
  ) {
    const { host } = ctx;
    const sc = host.scene;
    this.g = sc.add.graphics();
    this.status = sc.add.text(0, 0, '', { fontFamily: BODY_FONT, color: PALETTE.paper, fontSize: '13px' });
    this.empty = sc.add.text(0, 0, t('os.loot.historyEmpty'), { fontFamily: BODY_FONT, color: PALETTE.fog, fontSize: '13px' }).setVisible(false);
    host.container.add([this.g, this.status, this.empty]);
    this.btn = new OsButton(host, `${id}:submit`, { label: opts.submitLabel, variant: 'primary', onClick: () => this.submit() });
    this.list = opts.history ? new OsList(host, `${id}:history`) : null;
    this.inputOpts = { placeholder: opts.placeholder, maxLength: 40, onSubmit: (text) => this.check(text) };
    this.off = ctx.os.env.ledger.onChange(() => this.refresh());
    this.refresh();
  }

  /** Bereich der Eingabe (lokale Fensterkoordinaten). Liefert die belegte Höhe. */
  layout(x: number, y: number, w: number, h: number): number {
    const host = this.ctx.host;
    const u = host.u();
    const d = host.dpr();
    const ch = controlHeight(host);
    const gap = 3 * u;
    const bw = Math.min(Math.round(w * 0.4), this.btn.preferredWidth() + 10 * u);
    this.btn.layout(x + w - bw, y, bw, ch);
    this.inputRect = { x, y, w: w - bw - gap, h: ch };
    this.status.setStyle({ fontSize: `${Math.round(13 * d)}px`, wordWrap: { width: w, useAdvancedWrap: true } });
    this.status.setPosition(Math.round(x), Math.round(y + ch + gap));
    const statusH = Math.round(2 * 17 * d);
    const ly = y + ch + gap + statusH + gap;
    if (this.list) this.list.layout(x, ly, w, Math.max(ch, y + h - ly));
    this.empty.setStyle({ fontSize: `${Math.round(13 * d)}px`, color: PALETTE[host.theme().textDim], wordWrap: { width: w - 8 * u, useAdvancedWrap: true } });
    this.empty.setPosition(Math.round(x + 4 * u), Math.round(ly + 4 * u));
    this.draw();
    return this.list ? h : ch + gap + statusH;
  }

  update(): void {
    const win = this.ctx.win;
    const r = this.inputRect;
    const dpr = this.ctx.host.dpr();
    if (!r || !this.visible || !win.active || win.minimized || this.ctx.os.overlayOpen) {
      this.bridge.place(this, null, dpr);
      return;
    }
    if (this.bridge.ownedBy !== this) this.bridge.attach(this, this.inputOpts);
    const o = this.ctx.host.origin();
    const u = this.ctx.host.u();
    this.bridge.place(this, { x: o.x + r.x + u, y: o.y + r.y + u, w: r.w - 2 * u, h: r.h - 2 * u }, dpr);
  }

  setVisible(on: boolean): void {
    this.visible = on;
    this.btn.setVisible(on);
    this.status.setVisible(on);
    this.list?.setVisible(on);
    this.g.setVisible(on);
    this.syncEmpty();
    if (!on) this.bridge.place(this, null, this.ctx.host.dpr());
  }

  /** Rückmeldung von außen setzen (FernGucker: Verbindung, Überweisung). */
  say(text: string, good: boolean): void {
    this.result = { text, good };
    this.syncStatus();
  }

  state(): unknown {
    return { status: this.result?.text ?? '', good: this.result?.good ?? null, history: this.list?.entries.map((e) => `${e.label}|${e.right ?? ''}`) ?? [] };
  }

  destroy(): void {
    this.off();
    this.bridge.detach(this);
    this.btn.destroy();
    this.list?.destroy();
    this.status.destroy();
    this.empty.destroy();
    this.g.destroy();
  }

  private submit(): void {
    const text = this.bridge.value;
    if (!text.trim()) {
      this.say(t('os.loot.empty'), false);
      this.bridge.focus(this);
      return;
    }
    this.check(text);
  }

  private check(text: string): void {
    const r = this.ctx.os.env.ledger.submit(this.opts.input, text, this.opts.schemeId);
    if (r.ok || r.reason !== 'empty') this.bridge.setValue(this, '');
    const s = this.ctx.host.s.sfx;
    if (r.ok) {
      if (r.item.input === 'ferngucker') s.confirm();
    } else s.deny();
    this.result = resultText(r);
    this.syncStatus();
    this.opts.onResult?.(r);
  }

  private syncStatus(): void {
    const r = this.result;
    this.status.setText(r?.text ?? '').setColor(PALETTE[r ? (r.good ? 'mint' : 'red') : this.ctx.host.theme().textDim]);
  }

  private refresh(): void {
    if (!this.list) {
      this.syncEmpty();
      return;
    }
    const items = this.ctx.os.env.ledger.items.filter((i) => i.input === this.opts.input && (this.opts.schemeId === undefined || i.schemeId === this.opts.schemeId));
    const rows = [...items].reverse().map((i) => ({
      id: `loot-${i.id}`,
      label: rowLabel(i),
      right: i.status === 'paid' ? (i.input === 'ferngucker' && i.amount === 0 ? t('os.loot.failed') : `+${i18n.formatMoney(i.amount)}`) : i.status === 'failed' ? t('os.loot.failed') : t('os.loot.waiting'),
      icon: i.status === 'paid' ? 'os-icon-coin' : i.status === 'failed' ? 'os-icon-trash' : 'os-icon-notes',
      dim: i.status !== 'pending',
    }));
    this.list.setItems(rows);
    this.syncEmpty();
  }

  private syncEmpty(): void {
    this.empty.setVisible(this.visible && !!this.list && this.list.entries.length === 0);
  }

  private draw(): void {
    const g = this.g;
    const u = this.ctx.host.u();
    g.clear();
    const r = this.inputRect;
    if (!r) return;
    g.fillStyle(hex('ink0'), 1).fillRect(r.x, r.y, r.w, r.h);
    g.fillStyle(hex(this.ctx.host.theme().windowDark), 1).fillRect(r.x + u, r.y + u, r.w - 2 * u, r.h - 2 * u);
  }
}

/** Zeile im Verlauf: Wartende Beute ohne Wert, verbuchte mit. */
function rowLabel(i: LootItem): string {
  const name = t(`callers.${i.callerId}.short`);
  return i.status === 'pending' ? name : `${name} · ${i.value}`;
}

import type Phaser from 'phaser';
import { hex, PALETTE } from '../../../config/palette';
import { TUNING } from '../../../config/tuning';
import { callerById } from '../../../data/callers';
import { i18n, t } from '../../../i18n';
import type { LootItem } from '../../../systems/calls/ledger';
import { Rng } from '../../../systems/rng/rng';
import { PixelLabel } from '../../PixelLabel';
import type { Rect } from '../focusNav';
import { BODY_FONT, controlHeight, fitLabel, OsButton } from '../widgets';
import { LootEntry } from './loot';
import type { AppContext, AppDef, AppView } from './types';

type Mode = 'entry' | 'pc' | 'bank';
type PcKind = 'my' | 'trash' | 'bank' | 'folder' | 'file';

interface PcIcon {
  id: string;
  kind: PcKind;
  button: OsButton;
  label: string;
}

/** Empfänger im Online-Banking; nur einer davon ist „unser“ Konto. */
const RECIPIENTS = ['erna', 'verein', 'masche'] as const;

/** Systemsymbole plus Ordner und Dateien (Anzahl aus dem Tuning). */
const PC_SLOTS: readonly { id: string; kind: PcKind }[] = [
  { id: 'my', kind: 'my' },
  { id: 'trash', kind: 'trash' },
  { id: 'bank', kind: 'bank' },
  ...Array.from({ length: TUNING.remote.folders }, (_, i) => ({ id: `folder${i}`, kind: 'folder' as const })),
  ...Array.from({ length: TUNING.remote.files }, (_, i) => ({ id: `file${i}`, kind: 'file' as const })),
];

/**
 * FernGucker (APP-04, SCH-02/09/22): Guck-Code eingeben und den PC des Anrufers fernsteuern – solange
 * er am Telefon ist. Dort liegen Ordner, private Dateien (Klicks darauf machen misstrauisch) und das
 * Online-Banking „Spargroschen“, in dem man den Betrag und den richtigen Empfänger wählt.
 */
class FernguckerView implements AppView {
  private mode: Mode = 'entry';
  private readonly intro: Phaser.GameObjects.Text;
  private readonly entry: LootEntry;
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly title: PixelLabel;
  private readonly disconnect: OsButton;
  private readonly says: Phaser.GameObjects.Text;
  private readonly icons: PcIcon[];
  private readonly bankTitle: PixelLabel;
  private readonly bankText: Phaser.GameObjects.Text;
  private readonly recipientBtn: OsButton;
  private readonly lessBtn: OsButton;
  private readonly moreBtn: OsButton;
  private readonly amountLabel: PixelLabel;
  private readonly transferBtn: OsButton;
  private readonly backBtn: OsButton;
  private item: LootItem | null = null;
  private touched = new Set<string>();
  private status = '';
  private bankStatus = '';
  private startBalance = 0;
  private balance = 0;
  private amount = 0;
  private recipient = 0;
  private size = { w: 0, h: 0 };
  private screen: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private lastSaid = '';

  constructor(private readonly ctx: AppContext) {
    const { host } = ctx;
    const sc = host.scene;
    const u = host.u();
    const id = ctx.win.id;
    this.g = sc.add.graphics();
    host.container.add(this.g);
    this.intro = sc.add.text(0, 0, t('os.fern.intro'), { fontFamily: BODY_FONT, color: PALETTE.paper, fontSize: '13px' });
    host.container.add(this.intro);
    this.entry = new LootEntry(ctx, id, {
      input: 'ferngucker',
      placeholder: t('os.fern.placeholder'),
      submitLabel: t('os.fern.submit'),
      history: true,
      onResult: (r) => {
        if (r.ok) this.connect(r.item);
      },
    });
    this.title = new PixelLabel(sc, '', { scale: u, color: 'mustard', shadow: null, originY: 0.5, container: host.container });
    this.disconnect = new OsButton(host, `${id}:disconnect`, { label: t('os.fern.disconnect'), icon: 'os-icon-hangup', onClick: () => this.leave() });
    this.says = sc.add.text(0, 0, '', { fontFamily: BODY_FONT, color: PALETTE.paper, fontSize: '13px' });
    host.container.add(this.says);
    this.icons = PC_SLOTS.map((slot) => {
      const ic: PcIcon = { id: slot.id, kind: slot.kind, label: '', button: null as unknown as OsButton };
      ic.button = new OsButton(host, `${id}:pc:${slot.id}`, { label: '', icon: 'os-icon-folder', variant: 'flat', align: 'left', onClick: () => this.clickIcon(ic) });
      return ic;
    });
    this.bankTitle = new PixelLabel(sc, t('os.fern.bank'), { scale: u, color: 'ink0', shadow: null, originY: 0.5, container: host.container });
    this.bankText = sc.add.text(0, 0, '', { fontFamily: BODY_FONT, color: PALETTE.ink0, fontSize: '13px' });
    host.container.add(this.bankText);
    this.recipientBtn = new OsButton(host, `${id}:bank:recipient`, { label: '', onClick: () => this.nextRecipient() });
    this.lessBtn = new OsButton(host, `${id}:bank:less`, { label: t('os.fern.less'), onClick: () => this.changeAmount(-1) });
    this.moreBtn = new OsButton(host, `${id}:bank:more`, { label: t('os.fern.more'), onClick: () => this.changeAmount(1) });
    this.amountLabel = new PixelLabel(sc, '', { scale: u, color: 'ink0', shadow: null, originX: 0.5, originY: 0.5, container: host.container });
    this.transferBtn = new OsButton(host, `${id}:bank:transfer`, { label: t('os.fern.transfer'), icon: 'os-icon-coin', variant: 'primary', onClick: () => this.transfer() });
    this.backBtn = new OsButton(host, `${id}:bank:back`, { label: t('os.fern.back'), onClick: () => this.setMode('pc') });
    this.setMode('entry');
  }

  layout(w: number, h: number): void {
    this.size = { w, h };
    const host = this.ctx.host;
    const u = host.u();
    const d = host.dpr();
    const ch = controlHeight(host);
    const gap = 3 * u;
    const th = host.theme();
    // Eingabe.
    this.intro.setStyle({ fontSize: `${Math.round(13 * d)}px`, color: PALETTE[th.textDim], wordWrap: { width: w, useAdvancedWrap: true } });
    const iy = Math.round(this.intro.height + 4 * u);
    this.entry.layout(0, iy, w, h - iy);
    // Fernzugriff: Titelzeile, „Bildschirm“, Kommentare des Anrufers.
    const dw = Math.min(Math.round(w * 0.45), this.disconnect.setIconScale(u).preferredWidth() + 6 * u);
    this.disconnect.layout(w - dw, 0, dw, ch);
    const name = this.item ? t(`callers.${this.item.callerId}.short`) : '';
    fitLabel(this.title, t('os.fern.title', { name }), w - dw - 8 * u);
    this.title.setScale(u).setColor(th.accent).setPosition(2 * u, Math.round(ch / 2));
    const saysH = Math.round(3 * 17 * d);
    this.says.setStyle({ fontSize: `${Math.round(13 * d)}px`, color: PALETTE[th.text], wordWrap: { width: w, useAdvancedWrap: true } });
    this.says.setPosition(0, h - saysH);
    this.screen = { x: 0, y: ch + gap, w, h: Math.max(ch * 2, h - saysH - gap - ch - gap) };
    this.layoutPc();
    this.layoutBank();
    this.draw();
  }

  update(): void {
    this.entry.update();
    if (this.mode === 'entry') return;
    const it = this.item;
    const s = it ? this.ctx.os.env.phone.session(it.desk) : null;
    if (!it || !s || !s.active || s.callId !== it.callId) {
      // Aufgelegt: Verbindung weg, die Beute ist futsch.
      if (it) this.ctx.os.env.ledger.fail(it);
      this.close(t('os.fern.ended', { name: it ? t(`callers.${it.callerId}.short`) : '' }), false);
      return;
    }
    // Was der Anrufer gerade sagt (Schreibmaschine wie im Telefon).
    const line = [...s.transcript].reverse().find((l) => l.who === 'caller' && l.shown > 0);
    const said = line ? t('os.fern.says', { name: t(`callers.${it.callerId}.short`), text: line.text.slice(0, line.shown) }) : '';
    const text = [this.mode === 'bank' ? this.bankStatus : this.status, said].filter(Boolean).join('\n');
    if (text !== this.lastSaid) {
      this.lastSaid = text;
      this.says.setText(text);
    }
  }

  firstFocus(): string | undefined {
    const id = this.ctx.win.id;
    if (this.mode === 'pc') return `${id}:pc:bank`;
    if (this.mode === 'bank') return `${id}:bank:transfer`;
    return `${id}:submit`;
  }

  state(): unknown {
    return {
      mode: this.mode,
      callerId: this.item?.callerId ?? null,
      balance: this.balance,
      amount: this.amount,
      recipient: RECIPIENTS[this.recipient],
      icons: this.icons.map((i) => ({ id: i.id, kind: i.kind, label: i.label })),
      status: this.mode === 'bank' ? this.bankStatus : this.status,
      entry: this.entry.state(),
    };
  }

  destroy(): void {
    this.entry.destroy();
    this.disconnect.destroy();
    for (const i of this.icons) i.button.destroy();
    for (const b of [this.recipientBtn, this.lessBtn, this.moreBtn, this.transferBtn, this.backBtn]) b.destroy();
    this.title.destroy();
    this.bankTitle.destroy();
    this.amountLabel.destroy();
    this.bankText.destroy();
    this.says.destroy();
    this.intro.destroy();
    this.g.destroy();
  }

  // ------------------------------------------------------------------ Ablauf

  private get hub() {
    return this.ctx.os.env.phone;
  }

  private connect(item: LootItem): void {
    const s = this.hub.session(item.desk);
    const name = t(`callers.${item.callerId}.short`);
    if (!s || !s.active || s.callId !== item.callId) {
      this.ctx.os.env.ledger.fail(item);
      this.entry.say(t('os.fern.noCall', { name }), false);
      return;
    }
    this.item = item;
    this.buildPc(item);
    this.touched.clear();
    this.status = '';
    this.bankStatus = t('os.fern.greedy', { name });
    this.lastSaid = '';
    this.hub.remote(item.desk, 'start');
    this.setMode('pc');
  }

  /** Desktop des Anrufers: Ordner und Dateien passend zu seinen Vorlieben, Kontostand zufällig. */
  private buildPc(item: LootItem): void {
    const rng = new Rng(item.callId * 4099 + 7);
    const def = callerById(item.callerId);
    const folders = shuffle(i18n.list('apps.victim.folders'), rng);
    const files = shuffle((def?.likes ?? []).flatMap((topic) => i18n.list(`apps.victim.files.${topic}`)), rng);
    let fi = 0;
    let fo = 0;
    for (const ic of this.icons) {
      switch (ic.kind) {
        case 'my':
          this.setIcon(ic, t('os.fern.myPc'), 'files');
          break;
        case 'trash':
          this.setIcon(ic, t('os.fern.recycle'), 'trash');
          break;
        case 'bank':
          this.setIcon(ic, t('os.fern.bankShort'), 'bank');
          break;
        case 'folder':
          this.setIcon(ic, folders[fo++ % Math.max(1, folders.length)] ?? '', 'folder');
          break;
        case 'file': {
          const name = files[fi++ % Math.max(1, files.length)] ?? '';
          this.setIcon(ic, name, /\.jpg$/i.test(name) ? 'photo' : /\.mp3$/i.test(name) ? 'music' : 'textfile');
          break;
        }
      }
    }
    const [lo, hi] = TUNING.payout.victimBalance;
    this.startBalance = rng.int(lo / 10, hi / 10) * 10;
    this.balance = this.startBalance;
    this.amount = Math.min(this.balance, TUNING.remote.startAmount);
    this.recipient = 0;
  }

  private setIcon(ic: PcIcon, label: string, icon: string): void {
    ic.label = label;
    ic.button.setLabel(label).setIcon(`os-icon-${icon}`);
  }

  private clickIcon(ic: PcIcon): void {
    const it = this.item;
    if (!it) return;
    this.ctx.host.s.sfx.click();
    if (ic.kind === 'bank') {
      if (!this.touched.has('bank')) this.hub.remote(it.desk, 'bank');
      this.touched.add('bank');
      this.setMode('bank');
      return;
    }
    this.status = t('os.fern.opened', { file: ic.label });
    if (ic.kind === 'file') {
      // Private Dateien: „Was machen Sie mit meiner Maus?!“
      this.hub.remote(it.desk, 'suspicious');
    } else if (!this.touched.has(ic.id)) {
      this.touched.add(ic.id);
      this.hub.remote(it.desk, 'ok');
    }
  }

  private nextRecipient(): void {
    this.recipient = (this.recipient + 1) % RECIPIENTS.length;
    this.syncBank();
  }

  private changeAmount(dir: number): void {
    const step = TUNING.remote.amountStep;
    this.amount = Math.max(step, Math.min(this.balance, this.amount + dir * step));
    this.syncBank();
  }

  private transfer(): void {
    const it = this.item;
    if (!it || this.balance <= 0) return;
    const amount = Math.min(this.amount, this.balance);
    const key = RECIPIENTS[this.recipient]!;
    const recipient = t(`os.fern.recipients.${key}`);
    this.balance -= amount;
    if (key !== 'masche') {
      // Falscher Empfänger: Das Geld ist weg, der Anrufer wundert sich.
      this.ctx.host.s.sfx.deny();
      this.bankStatus = t('os.fern.lost', { amount: i18n.formatMoney(amount), recipient });
      this.amount = Math.max(0, Math.min(this.amount, this.balance));
      this.syncBank();
      this.hub.remote(it.desk, 'wrongRecipient');
      return;
    }
    const greedy = amount > this.startBalance * TUNING.payout.victimGreedyShare;
    this.ctx.os.env.ledger.pay(it, Math.min(amount, TUNING.payout.victimMax));
    const msg = t('os.fern.sent', { amount: i18n.formatMoney(amount), recipient });
    this.close(msg, true);
    this.hub.remote(it.desk, greedy ? 'transferBig' : 'transferOk', amount);
  }

  /** Spieler trennt selbst: Die Beute bleibt offen (Guck-Code gilt weiter, solange der Anruf läuft). */
  private leave(): void {
    const it = this.item;
    this.close('', true);
    if (it) this.hub.remote(it.desk, 'end');
  }

  private close(message: string, good: boolean): void {
    this.item = null;
    this.setMode('entry');
    if (message) this.entry.say(message, good);
  }

  // ------------------------------------------------------------------ Darstellung

  private setMode(mode: Mode): void {
    this.mode = mode;
    const pc = mode === 'pc';
    const bank = mode === 'bank';
    const remote = pc || bank;
    this.intro.setVisible(mode === 'entry');
    this.entry.setVisible(mode === 'entry');
    this.title.setVisible(remote);
    this.disconnect.setVisible(remote);
    this.says.setVisible(remote);
    for (const i of this.icons) i.button.setVisible(pc);
    this.bankTitle.setVisible(bank);
    this.bankText.setVisible(bank);
    this.amountLabel.setVisible(bank);
    for (const b of [this.recipientBtn, this.lessBtn, this.moreBtn, this.transferBtn, this.backBtn]) b.setVisible(bank);
    this.lastSaid = '';
    if (!remote) this.says.setText('');
    if (this.size.w > 0) this.layout(this.size.w, this.size.h);
    this.syncBank();
  }

  private layoutPc(): void {
    const host = this.ctx.host;
    const u = host.u();
    const ch = controlHeight(host);
    const s = this.screen;
    const pad = 3 * u;
    const cols = Math.max(1, Math.min(3, Math.floor((s.w - 2 * pad) / (62 * u))));
    const rows = Math.ceil(this.icons.length / cols);
    const cw = (s.w - 2 * pad) / cols;
    const rh = Math.min(ch, (s.h - 2 * pad) / rows);
    this.icons.forEach((ic, i) => {
      ic.button.setIconScale(Math.max(1, Math.round(u * 0.75)));
      ic.button.layout(s.x + pad + (i % cols) * cw, s.y + pad + Math.floor(i / cols) * rh, cw - u, rh - u);
    });
  }

  private layoutBank(): void {
    const host = this.ctx.host;
    const u = host.u();
    const d = host.dpr();
    const ch = controlHeight(host);
    const gap = 3 * u;
    const s = this.screen;
    const p = { x: s.x + 4 * u, y: s.y + 4 * u, w: s.w - 8 * u, h: s.h - 8 * u };
    this.bankTitle.setScale(u).setPosition(p.x + 4 * u, p.y + 6 * u);
    let y = p.y + 12 * u + gap;
    this.bankText.setStyle({ fontSize: `${Math.round(13 * d)}px`, wordWrap: { width: p.w - 8 * u, useAdvancedWrap: true } });
    this.bankText.setPosition(p.x + 4 * u, y);
    y += Math.round(17 * d + gap);
    const bh = Math.max(10 * u, Math.min(ch, (p.y + p.h - y - 3 * gap) / 4));
    this.recipientBtn.layout(p.x + 4 * u, y, p.w - 8 * u, bh);
    y += bh + gap;
    const sw = Math.min(40 * u, (p.w - 8 * u) / 4);
    this.lessBtn.layout(p.x + 4 * u, y, sw, bh);
    this.moreBtn.layout(p.x + p.w - 4 * u - sw, y, sw, bh);
    this.amountLabel.setScale(u).setPosition(Math.round(p.x + p.w / 2), Math.round(y + bh / 2));
    y += bh + gap;
    const half = (p.w - 8 * u - gap) / 2;
    this.backBtn.layout(p.x + 4 * u, y, half, bh);
    this.transferBtn.setIconScale(u).layout(p.x + 4 * u + half + gap, y, half, bh);
  }

  private syncBank(): void {
    this.bankText.setText(t('os.fern.balance', { amount: i18n.formatMoney(this.balance) }));
    this.recipientBtn.setLabel(t('os.fern.recipient', { name: t(`os.fern.recipients.${RECIPIENTS[this.recipient]}`) }));
    this.amountLabel.setText(t('os.fern.amount', { amount: i18n.formatMoney(Math.min(this.amount, this.balance)) }));
    this.transferBtn.setEnabled(this.balance > 0 && this.amount > 0);
    this.lessBtn.setEnabled(this.amount > TUNING.remote.amountStep);
    this.moreBtn.setEnabled(this.amount < this.balance);
  }

  private draw(): void {
    const g = this.g;
    const u = this.ctx.host.u();
    g.clear();
    if (this.mode === 'entry') return;
    const s = this.screen;
    // Fremder Bildschirm: anderer Hintergrund, damit klar ist, dass man nicht am eigenen PC ist.
    g.fillStyle(hex('ink0'), 1).fillRect(s.x, s.y, s.w, s.h);
    g.fillStyle(hex('petrol'), 1).fillRect(s.x + u, s.y + u, s.w - 2 * u, s.h - 2 * u);
    for (let yy = s.y + u; yy < s.y + s.h - u; yy += 2 * u) g.fillStyle(hex('teal'), 0.18).fillRect(s.x + u, yy, s.w - 2 * u, u);
    if (this.mode === 'bank') {
      const p = { x: s.x + 4 * u, y: s.y + 4 * u, w: s.w - 8 * u, h: s.h - 8 * u };
      g.fillStyle(hex('ink0'), 1).fillRect(p.x, p.y, p.w, p.h);
      g.fillStyle(hex('paper'), 1).fillRect(p.x + u, p.y + u, p.w - 2 * u, p.h - 2 * u);
      g.fillStyle(hex('mint'), 1).fillRect(p.x + u, p.y + u, p.w - 2 * u, 11 * u);
    }
  }
}

function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export const fernguckerApp: AppDef = {
  id: 'ferngucker',
  icon: 'ferngucker',
  titleKey: 'os.apps.ferngucker.title',
  shortKey: 'os.apps.ferngucker.short',
  size: { w: 260, h: 220 },
  onDesktop: true,
  inStartMenu: true,
  create: (ctx) => new FernguckerView(ctx),
};

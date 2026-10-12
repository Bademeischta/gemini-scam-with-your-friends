import type Phaser from 'phaser';
import { hex, PALETTE } from '../../../config/palette';
import { SCHEMES, schemeById, type SchemeDef } from '../../../data/schemes';
import { i18n, t } from '../../../i18n';
import { PHASES, type Phase } from '../../../systems/conversation/engine';
import { PixelLabel } from '../../PixelLabel';
import { BODY_FONT, controlHeight, fitLabel, OsButton, OsList, OsTextView } from '../widgets';
import { LootEntry, lootTarget, lootTargetName } from './loot';
import type { AppContext, AppDef, AppView } from './types';

/** Auszahlung einer Masche als Text („250 ₮“, „450 ₮ – 900 ₮“). */
export function payoutText(s: SchemeDef): string {
  const [min, max] = s.payout;
  return min === max ? i18n.formatMoney(min) : t('os.schemes.range', { min: i18n.formatMoney(min), max: i18n.formatMoney(max) });
}

/** Forderungen einer Masche („Bürgernummer + Gutschein-Code“, „3 × Ja-Wort“). */
export function demandsText(s: SchemeDef): string {
  const counts = new Map<string, number>();
  for (const d of s.demands) counts.set(d, (counts.get(d) ?? 0) + 1);
  return [...counts]
    .map(([d, n]) => (n > 1 ? t('os.schemes.times', { count: n, demand: t(`calls.demands.${d}`) }) : t(`calls.demands.${d}`)))
    .join(t('os.schemes.join'));
}

/** Maschen-Übersicht (SCH-17): alle Maschen mit Auszahlung; Öffnen zeigt die Skript-App. */
class SchemesView implements AppView {
  private readonly intro: Phaser.GameObjects.Text;
  private readonly list: OsList;
  private readonly off: () => void;
  private unlockKey = '';

  constructor(private readonly ctx: AppContext) {
    const { host } = ctx;
    this.intro = host.scene.add.text(0, 0, t('os.schemes.intro'), { fontFamily: BODY_FONT, color: PALETTE.paper, fontSize: '13px' });
    host.container.add(this.intro);
    this.list = new OsList(host, `${ctx.win.id}:list`);
    this.list.onActivate = (item) => {
      // Gesperrte Maschen (SCH-21): Leitfaden erst ab ihrem Tag.
      const s = schemeById(item.id);
      if (s && !ctx.os.env.work.unlocks().scheme(s.id)) {
        ctx.host.s.sfx.deny();
        ctx.os.toast({ icon: 'lock', title: t('os.locked.title'), body: t('os.locked.body', { app: t(`schemes.${s.id}.name`), day: s.unlockDay }) });
        return;
      }
      ctx.os.open('script', item.id);
    };
    this.off = ctx.os.env.phone.on((e) => {
      if (e.type === 'scheme' || e.type === 'answered' || e.type === 'ended') this.refresh();
    });
    this.refresh();
  }

  layout(w: number, h: number): void {
    const host = this.ctx.host;
    const u = host.u();
    this.intro.setStyle({ fontSize: `${Math.round(13 * host.dpr())}px`, color: PALETTE[host.theme().textDim], wordWrap: { width: w, useAdvancedWrap: true } });
    const y = Math.round(this.intro.height + 4 * u);
    this.list.layout(0, y, w, h - y);
  }

  update(): void {
    // Freischaltungen können sich ändern (Debug-Menü, später Ramschazon).
    const unlocks = this.ctx.os.env.work.unlocks();
    if (SCHEMES.map((s) => (unlocks.scheme(s.id) ? '1' : '0')).join('') !== this.unlockKey) this.refresh();
  }

  firstFocus(): string | undefined {
    return `${this.ctx.win.id}:list`;
  }

  state(): unknown {
    const unlocks = this.ctx.os.env.work.unlocks();
    return { items: this.list.entries.map((e) => e.id), locked: SCHEMES.filter((s) => !unlocks.scheme(s.id)).map((s) => s.id), chosen: this.ctx.os.env.phone.scheme(this.ctx.os.env.desk)?.id ?? null };
  }

  destroy(): void {
    this.off();
    this.list.destroy();
    this.intro.destroy();
  }

  private refresh(): void {
    const chosen = this.ctx.os.env.phone.scheme(this.ctx.os.env.desk)?.id ?? null;
    const unlocks = this.ctx.os.env.work.unlocks();
    this.unlockKey = SCHEMES.map((s) => (unlocks.scheme(s.id) ? '1' : '0')).join('');
    this.list.setItems(
      SCHEMES.map((s) => {
        const open = unlocks.scheme(s.id);
        return {
          id: s.id,
          label: t(`schemes.${s.id}.name`),
          right: !open ? t('os.schemes.locked', { day: s.unlockDay }) : s.id === chosen ? t('os.schemes.chosen') : payoutText(s),
          icon: open ? 'os-icon-scheme' : 'os-icon-lock',
          dim: !open,
        };
      }),
    );
  }
}

/**
 * Skript-App einer Masche (SCH-18, APP-12–26): Beschreibung, Forderungen, Wahl für den Anruf,
 * Fortschrittsbalken der Gesprächsphasen, Leitfaden mit der aktuellen Phase, Tipps – und bei Maschen
 * mit Zahlungs-Code die Eingabe zum Verbuchen.
 */
class ScriptView implements AppView {
  private readonly scheme: SchemeDef;
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly name: PixelLabel;
  private readonly payout: PixelLabel;
  private readonly desc: Phaser.GameObjects.Text;
  private readonly info: Phaser.GameObjects.Text;
  private readonly use: OsButton;
  private readonly guide: OsTextView;
  private readonly entry: LootEntry | null;
  private readonly target: OsButton | null;
  private readonly off: () => void;
  private size = { w: 0, h: 0 };
  private bar = { x: 0, y: 0, w: 0, h: 0 };
  private shownPhase: Phase | null | undefined = undefined;

  constructor(private readonly ctx: AppContext) {
    const { host } = ctx;
    const sc = host.scene;
    const u = host.u();
    const id = ctx.win.id;
    this.scheme = schemeById(String(ctx.args)) ?? SCHEMES[0]!;
    const sid = this.scheme.id;
    this.g = sc.add.graphics();
    host.container.add(this.g);
    this.name = new PixelLabel(sc, t(`schemes.${sid}.name`), { scale: u, color: 'mustard', shadow: null, container: host.container });
    this.payout = new PixelLabel(sc, payoutText(this.scheme), { scale: u, color: 'mint', shadow: null, originX: 1, container: host.container });
    this.desc = sc.add.text(0, 0, t(`schemes.${sid}.desc`), { fontFamily: BODY_FONT, color: PALETTE.paper, fontSize: '13px' });
    this.info = sc.add.text(0, 0, '', { fontFamily: BODY_FONT, color: PALETTE.paper, fontSize: '12px' });
    host.container.add([this.desc, this.info]);
    this.use = new OsButton(host, `${id}:use`, { label: t('os.schemes.use'), icon: 'os-icon-scheme', onClick: () => this.toggleUse() });
    this.guide = new OsTextView(host, `${id}:guide`, '');
    const input = this.scheme.input;
    this.entry = input === 'script' ? new LootEntry(ctx, id, { input, schemeId: sid, placeholder: t('os.schemes.placeholder'), submitLabel: t('os.schemes.submit'), history: false }) : null;
    const tg = lootTarget(input, sid);
    this.target =
      tg && tg.app !== 'script'
        ? new OsButton(host, `${id}:target`, { label: t('os.schemes.open', { app: lootTargetName(input, sid) }), onClick: () => ctx.os.open(tg.app, tg.args) })
        : null;
    this.off = ctx.os.env.phone.on((e) => {
      if (e.type === 'scheme' || e.type === 'answered' || e.type === 'ended') this.syncUse();
    });
    this.syncUse();
  }

  layout(w: number, h: number): void {
    this.size = { w, h };
    const host = this.ctx.host;
    const u = host.u();
    const d = host.dpr();
    const ch = controlHeight(host);
    const gap = 3 * u;
    const th = host.theme();
    const lineH = 7 * u;
    this.payout.setScale(u).setPosition(w, 0);
    fitLabel(this.name, t(`schemes.${this.scheme.id}.name`), w - this.payout.width - 6 * u);
    this.name.setScale(u).setColor(th.accent).setPosition(0, 0);
    let y = lineH + gap;
    this.desc.setStyle({ fontSize: `${Math.round(13 * d)}px`, color: PALETTE[th.text], wordWrap: { width: w, useAdvancedWrap: true } });
    this.desc.setPosition(0, y);
    y += Math.round(this.desc.height + gap);
    this.info.setStyle({ fontSize: `${Math.round(12 * d)}px`, color: PALETTE[th.textDim], wordWrap: { width: w, useAdvancedWrap: true } });
    this.info.setPosition(0, y);
    y += Math.round(this.info.height + gap);
    this.use.setIconScale(u).layout(0, y, w, ch);
    y += ch + gap;
    this.bar = { x: 0, y, w, h: 4 * u };
    y += 4 * u + gap;
    // Unten: Eingabe (Zahlungs-Code) bzw. Knopf zur Ziel-App.
    const bottomH = this.entry ? ch + gap + Math.round(2 * 17 * d) : this.target ? ch : 0;
    const guideH = Math.max(ch, h - y - (bottomH > 0 ? bottomH + gap : 0));
    this.guide.layout(0, y, w, guideH);
    const by = y + guideH + gap;
    this.entry?.layout(0, by, w, bottomH);
    this.target?.layout(0, by, w, ch);
    this.shownPhase = undefined;
    this.syncGuide();
  }

  update(): void {
    this.entry?.update();
    this.syncGuide();
  }

  firstFocus(): string | undefined {
    return `${this.ctx.win.id}:use`;
  }

  state(): unknown {
    return { scheme: this.scheme.id, chosen: this.isChosen(), phase: this.currentPhase(), entry: this.entry?.state() ?? null };
  }

  destroy(): void {
    this.off();
    this.entry?.destroy();
    this.target?.destroy();
    this.use.destroy();
    this.guide.destroy();
    this.name.destroy();
    this.payout.destroy();
    this.desc.destroy();
    this.info.destroy();
    this.g.destroy();
  }

  private get desk(): number {
    return this.ctx.os.env.desk;
  }

  private isChosen(): boolean {
    return this.ctx.os.env.phone.scheme(this.desk)?.id === this.scheme.id;
  }

  /** Phase des laufenden Gesprächs, wenn es diese Masche nutzt. */
  private currentPhase(): Phase | null {
    const hub = this.ctx.os.env.phone;
    const s = hub.session(this.desk);
    const c = s?.active ? s.conversation : null;
    return c && c.scheme?.id === this.scheme.id ? c.phase : null;
  }

  private toggleUse(): void {
    const hub = this.ctx.os.env.phone;
    hub.setScheme(this.desk, this.isChosen() ? null : this.scheme);
  }

  private syncUse(): void {
    const chosen = this.isChosen();
    this.use.setLabel(t(chosen ? 'os.schemes.unchoose' : 'os.schemes.use')).setActive(chosen);
    const live = this.ctx.os.env.phone.session(this.desk)?.active ?? false;
    const target = this.scheme.input === 'auto' ? t('os.schemes.targetAuto') : t('os.schemes.target', { app: lootTargetName(this.scheme.input, this.scheme.id) });
    const parts = [t('os.schemes.demands', { list: demandsText(this.scheme) }), target];
    if (chosen) parts.push(t(live ? 'os.schemes.forCall' : 'os.schemes.forNext'));
    this.info.setText(parts.join('\n'));
    if (this.size.w > 0) this.layout(this.size.w, this.size.h);
  }

  private syncGuide(): void {
    const phase = this.currentPhase();
    if (phase === this.shownPhase) return;
    this.shownPhase = phase;
    const sid = this.scheme.id;
    const lines = [t('os.schemes.guide')];
    for (const p of PHASES) {
      const params = { phase: t(`calls.phase.${p}`), text: t(`schemes.${sid}.guide.${p}`) };
      lines.push(t(p === phase ? 'os.schemes.current' : 'os.schemes.step', params));
    }
    lines.push('', t('os.schemes.tips'));
    for (const tip of i18n.list(`schemes.${sid}.tips`)) lines.push(tip);
    this.guide.setContent(lines.join('\n'));
    this.drawBar(phase);
  }

  /** Fortschrittsbalken der sechs Gesprächsphasen. */
  private drawBar(phase: Phase | null): void {
    const g = this.g;
    const u = this.ctx.host.u();
    const th = this.ctx.host.theme();
    const { x, y, w, h } = this.bar;
    g.clear();
    if (w <= 0) return;
    const n = PHASES.length;
    const cur = phase ? PHASES.indexOf(phase) : -1;
    const seg = (w - (n - 1) * u) / n;
    for (let i = 0; i < n; i++) {
      const sx = Math.round(x + i * (seg + u));
      const sw = Math.round(seg);
      g.fillStyle(hex('ink0'), 1).fillRect(sx, y, sw, h);
      const col = i < cur ? 'mint' : i === cur ? th.accent : th.windowDark;
      g.fillStyle(hex(col), 1).fillRect(sx + u, y + u, sw - 2 * u, h - 2 * u);
    }
  }
}

export const schemesApp: AppDef = {
  id: 'schemes',
  icon: 'scheme',
  titleKey: 'os.apps.schemes.title',
  shortKey: 'os.apps.schemes.short',
  size: { w: 200, h: 200 },
  onDesktop: true,
  inStartMenu: true,
  create: (ctx) => new SchemesView(ctx),
};

export const scriptApp: AppDef = {
  id: 'script',
  icon: 'scheme',
  titleKey: 'os.apps.script.title',
  shortKey: 'os.apps.script.short',
  size: { w: 240, h: 230 },
  onDesktop: false,
  inStartMenu: false,
  windowId: (args) => `script:${String(args)}`,
  title: (args) => t(`schemes.${String(args)}.app`),
  create: (ctx) => new ScriptView(ctx),
};

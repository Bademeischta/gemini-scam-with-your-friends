import Phaser from 'phaser';
import { hex, PALETTE } from '../config/palette';
import { TUNING } from '../config/tuning';
import { i18n, t } from '../i18n';
import { pixelScale, safeRect, type ViewportState } from '../systems/viewport/viewportMath';
import { Menu } from '../ui/Menu';
import { PixelLabel } from '../ui/PixelLabel';
import { BODY_FONT } from './AboutScene';
import { BaseScene } from './BaseScene';
import { playTime } from './ReportScene';

/** Bestenliste (PRG-05) und Lebenszeit-Statistik (PRG-06). */
export class StatsScene extends BaseScene {
  private panel!: Phaser.GameObjects.Graphics;
  private heading!: PixelLabel;
  private board!: Phaser.GameObjects.Text;
  private stats!: Phaser.GameObjects.Text;
  private menu!: Menu;

  constructor() {
    super('Stats');
  }

  protected build(): void {
    this.cameras.main.setBackgroundColor(PALETTE.ink1);
    this.panel = this.add.graphics();
    this.heading = new PixelLabel(this, t('stats.title'), { scale: 2, color: 'mustard', shadow: 'ink0', originX: 0.5 });
    const saves = this.s.saves;
    const entries = saves.leaderboard;
    const boardLines = [t('stats.board')];
    if (entries.length === 0) boardLines.push(t('stats.empty'));
    entries.forEach((e, i) => boardLines.push(t('stats.entry', { rank: i + 1, days: t('stats.days', { count: e.days }), loot: i18n.formatMoney(e.loot), code: e.code })));
    const st = saves.stats;
    const fav = Object.entries(st.schemeWins).sort((a, b) => b[1] - a[1])[0];
    const pct = st.calls > 0 ? Math.round((st.successes / st.calls) * 100) : 0;
    const row = (key: string, value: string | number): string => t('stats.row', { label: t(`stats.${key}`), value });
    const statLines = [
      t('stats.lifetime'),
      row('runs', st.runs),
      row('firings', st.firings),
      row('daysWorked', st.daysWorked),
      row('longestRun', t('stats.days', { count: st.longestRun })),
      row('calls', st.calls),
      row('successRate', t('stats.percent', { value: pct })),
      row('loot', i18n.formatMoney(st.loot)),
      row('bestDay', i18n.formatMoney(st.bestDayLoot)),
      row('favorite', fav ? t(`schemes.${fav[0]}.name`) : t('stats.none')),
      row('staplers', st.staplersHit),
      row('catches', st.bossCatches),
      row('yells', st.bossYells),
      row('baits', st.baitsCaught),
      row('monitors', st.monitorsBurned),
      row('raids', st.raids),
      row('playtime', playTime(st.playSeconds)),
    ];
    this.board = this.add.text(0, 0, boardLines.join('\n'), { fontFamily: BODY_FONT, color: PALETTE.paper, fontSize: '15px', lineSpacing: 4 });
    this.stats = this.add.text(0, 0, statLines.join('\n'), { fontFamily: BODY_FONT, color: PALETTE.paper, fontSize: '15px', lineSpacing: 4 });
    this.menu = new Menu(this, this.s, [{ id: 'back', label: () => t('stats.back'), onSelect: () => this.back() }]);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.menu.destroy());
    this.registry.set('stats', { entries: entries.length, runs: st.runs, calls: st.calls });
  }

  protected layout(vp: ViewportState): void {
    this.cameras.main.setSize(vp.width, vp.height);
    const safe = safeRect(vp, Math.round(TUNING.ui.edgeMargin * vp.dpr));
    const ui = pixelScale(vp, TUNING.display.uiArtScale);
    const minBtn = Math.round(TUNING.ui.minTouchTarget * vp.dpr);
    const pad = 8 * ui;
    const panelW = Math.min(safe.width, Math.round(860 * vp.dpr));
    const twoCols = panelW >= 560 * vp.dpr;
    const colW = twoCols ? (panelW - 3 * pad) / 2 : panelW - 2 * pad;
    const maxH = safe.height - 12 * ui - minBtn - 4 * pad;
    for (let css = 15; css >= 9; css--) {
      for (const tx of [this.board, this.stats]) tx.setStyle({ fontSize: `${Math.round(css * vp.dpr)}px`, wordWrap: { width: colW, useAdvancedWrap: true } }).setLineSpacing(Math.round(css * 0.2 * vp.dpr));
      const h = twoCols ? Math.max(this.board.height, this.stats.height) : this.board.height + pad + this.stats.height;
      if (h <= maxH) break;
    }
    const contentH = twoCols ? Math.max(this.board.height, this.stats.height) : this.board.height + pad + this.stats.height;
    const panelH = Math.min(safe.height, 12 * ui + contentH + minBtn + 4 * pad);
    const x = Math.round(vp.width / 2 - panelW / 2);
    const y = Math.round(vp.height / 2 - panelH / 2);
    this.panel.clear().fillStyle(hex('ink0'), 1).fillRect(x + ui, y + ui, panelW, panelH).fillStyle(hex('ink3'), 1).fillRect(x, y, panelW, panelH).fillStyle(hex('ink2'), 1).fillRect(x + ui, y + ui, panelW - 2 * ui, panelH - 2 * ui);
    this.heading.setScale(ui).setPosition(Math.round(vp.width / 2), y + pad);
    const top = y + pad * 2 + 10 * ui;
    this.board.setPosition(x + pad, top);
    if (twoCols) this.stats.setPosition(x + 2 * pad + colW, top);
    else this.stats.setPosition(x + pad, top + this.board.height + pad);
    this.menu.layout(Math.round(vp.width / 2), Math.round(y + panelH - pad - minBtn / 2), ui, minBtn);
    this.registry.set('menuRects', this.menu.rects().map((r) => ({ id: r.id, x: r.x / vp.dpr, y: r.y / vp.dpr, w: r.w / vp.dpr, h: r.h / vp.dpr })));
  }

  protected override frameUpdate(dt: number): void {
    this.menu.update(dt);
    this.registry.set('menuFocus', this.menu.focusedId);
    if (this.s.input.justPressed('uiBack')) this.back();
  }

  private back(): void {
    this.s.sfx.back();
    this.scene.start('Title', { state: 'menu' });
  }
}

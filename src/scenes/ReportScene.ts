import Phaser from 'phaser';
import { hex, PALETTE } from '../config/palette';
import { TUNING } from '../config/tuning';
import { currentRun, dropRun, hasRun } from '../core/run';
import { BOSS_LOOK, frameIndex } from '../gfx/characters';
import { characterTexture } from '../gfx/phaserTextures';
import { i18n, t } from '../i18n';
import { pixelScale, safeRect, type ViewportState } from '../systems/viewport/viewportMath';
import { Menu } from '../ui/Menu';
import { PixelLabel } from '../ui/PixelLabel';
import { BODY_FONT } from './AboutScene';
import { BaseScene } from './BaseScene';

/** Spielzeit als „h:mm:ss“ bzw. „m:ss“. */
export function playTime(seconds: number): string {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/**
 * Kündigungsbericht Schwindelheim (PRG-04, COP-09, FUN-01): gearbeitete Tage, Team-Gesamtbeute,
 * Rangliste, Spielzeit, Durchschnitt, Schicht-Code, Platz in der Bestenliste und ein letzter
 * Brülling-Spruch. „Neue Bewerbung schreiben“ startet sofort einen neuen Run (PRG-07).
 */
export class ReportScene extends BaseScene {
  private panel!: Phaser.GameObjects.Graphics;
  private heading!: PixelLabel;
  private boss!: Phaser.GameObjects.Image;
  private body!: Phaser.GameObjects.Text;
  private menu!: Menu;

  constructor() {
    super('Report');
  }

  protected build(): void {
    this.cameras.main.setBackgroundColor(PALETTE.ink1);
    const review = hasRun() ? currentRun().review : null;
    const r = review?.report;
    this.panel = this.add.graphics();
    this.heading = new PixelLabel(this, t('report.title'), { scale: 2, color: 'mustard', shadow: 'ink0', originX: 0.5 });
    characterTexture(this, 'char-boss', BOSS_LOOK);
    this.boss = this.add.image(0, 0, 'char-boss', frameIndex('down', 'walk0')).setOrigin(0.5, 1);
    const lines: string[] = [];
    if (r && review) {
      const quotes = i18n.list('boss.fired');
      lines.push(
        t('review.fired', { missing: i18n.formatMoney(review.missing) }),
        quotes.length > 0 ? t('review.quoteLine', { name: t('boss.name'), text: quotes[review.quote % quotes.length]! }) : '',
        '',
        t('report.days', { count: r.days }),
        t('report.loot', { loot: i18n.formatMoney(r.totalLoot) }),
        t('report.average', { avg: i18n.formatMoney(r.average) }),
        t('report.time', { time: playTime(r.seconds) }),
        t('report.staplers', { count: r.staplers }),
        '',
        t('report.ranking'),
        ...r.ranking.map((p, i) => t('report.rankRow', { rank: i + 1, name: p.id === 'player' ? t('report.you') : p.id, loot: i18n.formatMoney(p.loot) })),
        '',
        t('report.code', { code: r.code }),
        r.rank !== null ? t('report.rank', { rank: r.rank }) : t('report.noRank'),
      );
    }
    this.body = this.add.text(0, 0, lines.join('\n'), { fontFamily: BODY_FONT, color: PALETTE.paper, fontSize: '15px', lineSpacing: 4 });
    this.menu = new Menu(this, this.s, [
      { id: 'again', label: () => t('report.again'), onSelect: () => this.again() },
      { id: 'menu', label: () => t('report.menu'), onSelect: () => this.toMenu() },
    ]);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.menu.destroy());
    this.registry.set('report', r ? { days: r.days, loot: r.totalLoot, code: r.code, rank: r.rank } : null);
  }

  protected layout(vp: ViewportState): void {
    this.cameras.main.setSize(vp.width, vp.height);
    const safe = safeRect(vp, Math.round(TUNING.ui.edgeMargin * vp.dpr));
    const ui = pixelScale(vp, TUNING.display.uiArtScale);
    const minBtn = Math.round(TUNING.ui.minTouchTarget * vp.dpr);
    const panelW = Math.min(safe.width, Math.round(640 * vp.dpr));
    const pad = 8 * ui;
    const menuH = 2 * minBtn + 3 * ui;
    const bossScale = Math.max(ui, Math.round(ui * 1.5));
    const headH = 12 * ui + 26 * bossScale;
    const maxText = safe.height - headH - menuH - 4 * pad;
    for (let css = 15; css >= 10; css--) {
      this.body.setStyle({ fontSize: `${Math.round(css * vp.dpr)}px`, wordWrap: { width: panelW - 2 * pad, useAdvancedWrap: true } }).setLineSpacing(Math.round(css * 0.25 * vp.dpr));
      if (this.body.height <= maxText) break;
    }
    const panelH = Math.min(safe.height, headH + this.body.height + menuH + 4 * pad);
    const x = Math.round(vp.width / 2 - panelW / 2);
    const y = Math.round(vp.height / 2 - panelH / 2);
    this.panel.clear().fillStyle(hex('ink0'), 1).fillRect(x + ui, y + ui, panelW, panelH).fillStyle(hex('red'), 1).fillRect(x, y, panelW, panelH).fillStyle(hex('ink2'), 1).fillRect(x + ui, y + ui, panelW - 2 * ui, panelH - 2 * ui);
    this.heading.setScale(ui).setPosition(Math.round(vp.width / 2), y + pad);
    this.boss.setScale(bossScale).setPosition(Math.round(vp.width / 2), y + pad + 12 * ui + 24 * bossScale);
    this.body.setPosition(x + pad, y + pad + headH);
    this.menu.layout(Math.round(vp.width / 2), Math.round(y + panelH - pad - menuH / 2), ui, minBtn);
    this.registry.set('menuRects', this.menu.rects().map((r) => ({ id: r.id, x: r.x / vp.dpr, y: r.y / vp.dpr, w: r.w / vp.dpr, h: r.h / vp.dpr })));
  }

  protected override frameUpdate(dt: number): void {
    this.menu.update(dt);
    this.registry.set('menuFocus', this.menu.focusedId);
    if (this.s.input.justPressed('uiBack')) this.toMenu();
  }

  /** Neue Bewerbung schreiben (PRG-07): sofort ein neuer Run. */
  private again(): void {
    this.s.sfx.start();
    dropRun();
    this.scene.start('Office', { mode: 'new' });
  }

  private toMenu(): void {
    this.s.sfx.back();
    dropRun();
    this.scene.start('Title', { state: 'menu' });
  }
}

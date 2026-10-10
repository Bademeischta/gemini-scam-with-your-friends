import Phaser from 'phaser';
import { hex, PALETTE } from '../config/palette';
import { TUNING } from '../config/tuning';
import { t } from '../i18n';
import { pixelScale, safeRect, type ViewportState } from '../systems/viewport/viewportMath';
import { Menu } from '../ui/Menu';
import { PixelLabel } from '../ui/PixelLabel';
import { BaseScene } from './BaseScene';

export const BODY_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", sans-serif';

/** „Über das Spiel“: Hommage-Hinweis, Fiktions-Hinweis, Echte-Welt-Tipp, Credits. */
export class AboutScene extends BaseScene {
  private panel!: Phaser.GameObjects.Graphics;
  private heading!: PixelLabel;
  private body!: Phaser.GameObjects.Text;
  private menu!: Menu;

  constructor() {
    super('About');
  }

  protected build(): void {
    this.cameras.main.setBackgroundColor(PALETTE.ink1);
    this.panel = this.add.graphics();
    this.heading = new PixelLabel(this, t('about.heading'), { scale: 2, color: 'mustard', shadow: 'ink0', originX: 0.5 });
    const text = [t('about.homage'), t('about.fiction'), t('about.realWorld'), t('about.madeWith')].join('\n\n');
    this.body = this.add.text(0, 0, text, { fontFamily: BODY_FONT, color: PALETTE.paper, fontSize: '16px', lineSpacing: 4 });
    this.menu = new Menu(this, this.s, [{ id: 'back', label: () => t('menu.back'), onSelect: () => this.back() }]);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.menu.destroy());
    this.registry.set('titleState', undefined);
  }

  protected layout(vp: ViewportState): void {
    this.cameras.main.setSize(vp.width, vp.height);
    const margin = Math.round(TUNING.ui.edgeMargin * vp.dpr);
    const safe = safeRect(vp, margin);
    const ui = pixelScale(vp, TUNING.display.uiArtScale);
    const minBtn = Math.round(TUNING.ui.minTouchTarget * vp.dpr);

    const panelW = Math.min(safe.width, Math.round(720 * vp.dpr));
    const px = Math.round(vp.width / 2 - panelW / 2);
    const headingH = 12 * ui;
    const footerH = minBtn + 6 * ui;
    const innerPad = 8 * ui;
    const textW = panelW - innerPad * 2;
    const maxTextH = safe.height - headingH - footerH - innerPad * 3;

    // Schriftgröße so wählen, dass alles ohne Scrollen passt (16 → 11 CSS-px).
    let css = 16;
    for (; css >= 11; css--) {
      this.body.setStyle({ fontSize: `${Math.round(css * vp.dpr)}px`, wordWrap: { width: textW, useAdvancedWrap: true } });
      this.body.setLineSpacing(Math.round(css * 0.3 * vp.dpr));
      if (this.body.height <= maxTextH) break;
    }
    const panelH = Math.min(safe.height, headingH + this.body.height + footerH + innerPad * 3);
    const py = Math.round(vp.height / 2 - panelH / 2);

    const g = this.panel;
    g.clear();
    g.fillStyle(hex('ink0'), 1).fillRect(px + ui, py + ui, panelW, panelH);
    g.fillStyle(hex('ink3'), 1).fillRect(px, py, panelW, panelH);
    g.fillStyle(hex('ink2'), 1).fillRect(px + ui, py + ui, panelW - 2 * ui, panelH - 2 * ui);

    this.heading.setScale(ui).setPosition(Math.round(vp.width / 2), py + innerPad);
    this.body.setPosition(px + innerPad, py + innerPad * 2 + headingH);
    this.menu.layout(Math.round(vp.width / 2), py + panelH - innerPad - Math.round(minBtn / 2), ui, minBtn);
  }

  protected override frameUpdate(dt: number): void {
    this.menu.update(dt);
    if (this.s.input.justPressed('uiBack')) this.back();
  }

  private back(): void {
    this.s.sfx.back();
    this.scene.start('Title', { state: 'menu' });
  }
}

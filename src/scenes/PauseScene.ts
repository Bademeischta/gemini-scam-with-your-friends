import Phaser from 'phaser';
import { hex, PALETTE } from '../config/palette';
import { TUNING } from '../config/tuning';
import { t } from '../i18n';
import { pixelScale, safeRect, type ViewportState } from '../systems/viewport/viewportMath';
import { Menu } from '../ui/Menu';
import { PixelLabel } from '../ui/PixelLabel';
import { BODY_FONT } from './AboutScene';
import { BaseScene } from './BaseScene';

/**
 * Pausenmenü über einer Spielszene. Solange es offen ist, ruht die Spiellogik (Pausegrund 'menu').
 */
export class PauseScene extends BaseScene {
  private dim!: Phaser.GameObjects.Graphics;
  private panel!: Phaser.GameObjects.Graphics;
  private heading!: PixelLabel;
  private hint!: Phaser.GameObjects.Text;
  private menu!: Menu;
  private returnTo = 'Office';

  constructor() {
    super('Pause');
  }

  protected build(data?: unknown): void {
    this.returnTo = (data as { returnTo?: string } | undefined)?.returnTo ?? 'Office';
    this.s.pause.add('menu');
    this.dim = this.add.graphics();
    this.panel = this.add.graphics();
    this.heading = new PixelLabel(this, t('pause.heading'), { scale: 2, color: 'mustard', shadow: 'ink0', originX: 0.5 });
    this.hint = this.add.text(0, 0, `${t('pause.hint')}\n${t('pause.saved')}`, { fontFamily: BODY_FONT, color: PALETTE.fog, fontSize: '14px', align: 'center' }).setOrigin(0.5, 0);
    this.menu = new Menu(this, this.s, [
      { id: 'resume', label: () => t('menu.resume'), onSelect: () => this.resume() },
      { id: 'mainMenu', label: () => t('menu.mainMenu'), onSelect: () => this.toMainMenu() },
    ]);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.menu.destroy());
    this.registry.set('paused', true);
  }

  protected layout(vp: ViewportState): void {
    this.cameras.main.setSize(vp.width, vp.height);
    const ui = pixelScale(vp, TUNING.display.uiArtScale);
    const minBtn = Math.round(TUNING.ui.minTouchTarget * vp.dpr);
    const safe = safeRect(vp, Math.round(TUNING.ui.edgeMargin * vp.dpr));
    this.dim.clear().fillStyle(hex('ink0'), 0.7).fillRect(0, 0, vp.width, vp.height);
    this.hint.setFontSize(Math.round(14 * vp.dpr)).setWordWrapWidth(Math.min(safe.width, 420 * vp.dpr) - 16 * ui);
    const w = Math.min(safe.width, Math.max(260 * vp.dpr, this.hint.width + 16 * ui));
    const h = 14 * ui + this.hint.height + 2 * minBtn + 3 * ui + 22 * ui;
    const x = Math.round(vp.width / 2 - w / 2);
    const y = Math.round(vp.height / 2 - h / 2);
    this.panel
      .clear()
      .fillStyle(hex('ink0'), 1)
      .fillRect(x + ui, y + ui, w, h)
      .fillStyle(hex('mustard'), 1)
      .fillRect(x, y, w, h)
      .fillStyle(hex('ink2'), 1)
      .fillRect(x + ui, y + ui, w - 2 * ui, h - 2 * ui);
    this.heading.setScale(ui).setPosition(Math.round(vp.width / 2), y + 6 * ui);
    this.hint.setPosition(Math.round(vp.width / 2), y + 18 * ui);
    const menuH = 2 * minBtn + 3 * ui;
    this.menu.layout(Math.round(vp.width / 2), Math.round(y + h - 8 * ui - menuH / 2), ui, minBtn);
    this.registry.set('menuRects', this.menu.rects().map((r) => ({ id: r.id, x: r.x / vp.dpr, y: r.y / vp.dpr, w: r.w / vp.dpr, h: r.h / vp.dpr })));
  }

  protected override frameUpdate(dt: number): void {
    this.menu.update(dt);
    this.registry.set('menuFocus', this.menu.focusedId);
    const inp = this.s.input;
    if (inp.justPressed('pause') || inp.justPressed('uiBack')) this.resume();
  }

  private resume(): void {
    this.s.sfx.back();
    this.s.pause.remove('menu');
    // Wer klickt, hat den Fokus – ein hängengebliebener Blur-Grund darf das Spiel nicht festhalten.
    this.s.pause.remove('blur');
    this.registry.set('paused', false);
    this.scene.stop();
  }

  private toMainMenu(): void {
    this.s.pause.remove('menu');
    this.s.pause.remove('blur');
    this.registry.set('paused', false);
    this.scene.stop(this.returnTo);
    this.scene.stop('OfficeHud');
    this.scene.start('Title', { state: 'menu' });
  }
}

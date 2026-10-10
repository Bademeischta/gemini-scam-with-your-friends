import Phaser from 'phaser';
import { hex } from '../config/palette';
import { TUNING } from '../config/tuning';
import { designSkyline, drawSkyline, drawStars, drawWindows, type SkylineModel } from '../gfx/skyline';
import { PIXEL_FONT } from '../gfx/pixelFont';
import { t } from '../i18n';
import { Rng } from '../systems/rng/rng';
import { fullscreenSupported, isFullscreen, isStandalone, onFullscreenChange, toggleFullscreen } from '../systems/platform/fullscreen';
import { pixelScale, safeRect, type ViewportState } from '../systems/viewport/viewportMath';
import { Menu, type MenuItem } from '../ui/Menu';
import { PixelLabel } from '../ui/PixelLabel';
import { BaseScene } from './BaseScene';
import { TEX } from './BootScene';

type TitleState = 'attract' | 'menu';

const SKYLINE_KEY = 'skyline';

/**
 * Titelbildschirm: animierte Nacht-Skyline von Schwindelheim, wackelndes Logo, klingelnder Hörer.
 * „Einstempeln“ (beliebige Taste / Tippen / Gamepad) öffnet das Hauptmenü.
 */
export class TitleScene extends BaseScene {
  private state: TitleState = 'attract';
  private bg!: Phaser.GameObjects.Image;
  private sky: SkylineModel | null = null;
  private skyTex: Phaser.Textures.CanvasTexture | null = null;
  private readonly rng = new Rng(20261010);
  private logo!: Phaser.GameObjects.DynamicBitmapText;
  private logoShadow!: Phaser.GameObjects.DynamicBitmapText;
  private logoSub!: PixelLabel;
  private subtitle!: PixelLabel;
  private prompt!: PixelLabel;
  private navHint!: PixelLabel;
  private disclaimer!: PixelLabel;
  private version!: PixelLabel;
  private deviceLabel!: PixelLabel;
  private handset!: Phaser.GameObjects.Image;
  private ring!: Phaser.GameObjects.Graphics;
  private fsButton!: Phaser.GameObjects.Graphics;
  private footerBg!: Phaser.GameObjects.Graphics;
  private menuBg!: Phaser.GameObjects.Graphics;
  private fsZone!: Phaser.GameObjects.Zone;
  private menu!: Menu;
  private time0 = 0;
  private ringTimer = 0;
  private blinkTimer = 0;
  private handsetScale = 1;
  private handsetBase = { x: 0, y: 0 };
  private fsRect = { x: 0, y: 0, size: 0 };

  constructor() {
    super('Title');
  }

  protected build(data?: unknown): void {
    this.state = (data as { state?: TitleState } | undefined)?.state ?? 'attract';
    this.time0 = 0;
    this.bg = this.add.image(0, 0, TEX.pixel).setOrigin(0, 0).setDepth(0);

    const wave = (d: Phaser.Types.GameObjects.BitmapText.DisplayCallbackConfig): Phaser.Types.GameObjects.BitmapText.DisplayCallbackConfig => {
      d.y += Math.round(Math.sin(this.time0 * TUNING.title.logoWaveSpeed + d.index * 0.7) * TUNING.title.logoWaveAmp);
      return d;
    };
    this.logoShadow = this.add.dynamicBitmapText(0, 0, PIXEL_FONT, t('app.logoMain')).setTint(hex('wine')).setDepth(5);
    this.logoShadow.setDisplayCallback(wave);
    this.logo = this.add.dynamicBitmapText(0, 0, PIXEL_FONT, t('app.logoMain')).setTint(hex('mustard')).setDepth(6);
    this.logo.setDisplayCallback(wave);
    this.logoSub = new PixelLabel(this, t('app.logoSub'), { scale: 4, color: 'white', shadow: 'wine', depth: 6 });
    this.subtitle = new PixelLabel(this, t('app.subtitle'), { scale: 2, color: 'paper', shadow: 'ink0', originX: 0.5, depth: 6 });
    this.prompt = new PixelLabel(this, '', { scale: 2, color: 'white', shadow: 'ink0', originX: 0.5, originY: 0.5, depth: 6 });
    this.navHint = new PixelLabel(this, '', { scale: 2, color: 'fog', shadow: 'ink0', originX: 0.5, originY: 0.5, depth: 6 });
    this.disclaimer = new PixelLabel(this, t('app.disclaimer'), { scale: 2, color: 'fog', shadow: 'ink0', originY: 1, depth: 6 });
    this.version = new PixelLabel(this, t('app.version', { version: __APP_VERSION__ }), { scale: 2, color: 'slate', shadow: 'ink0', originX: 1, originY: 1, depth: 6 });
    this.deviceLabel = new PixelLabel(this, '', { scale: 2, color: 'fog', shadow: 'ink0', originX: 1, originY: 1, depth: 6 });

    this.footerBg = this.add.graphics().setDepth(4);
    this.menuBg = this.add.graphics().setDepth(5);
    this.handset = this.add.image(0, 0, TEX.handset).setDepth(7);
    this.ring = this.add.graphics().setDepth(7);

    this.fsButton = this.add.graphics().setDepth(20);
    this.fsZone = this.add.zone(0, 0, 10, 10).setOrigin(0, 0).setDepth(21).setInteractive({ useHandCursor: true });
    this.fsZone.on('pointerup', () => {
      this.s.sfx.confirm();
      void toggleFullscreen();
    });
    const showFs = fullscreenSupported() && !isStandalone();
    this.fsButton.setVisible(showFs);
    if (!showFs) this.fsZone.disableInteractive();

    const items: MenuItem[] = [
      { id: 'start', label: () => t('menu.start'), onSelect: () => void this.scene.start('Office') },
      { id: 'about', label: () => t('menu.about'), onSelect: () => void this.scene.start('About') },
    ];
    if (showFs) {
      items.push({
        id: 'fullscreen',
        label: () => t(isFullscreen() ? 'menu.fullscreenOn' : 'menu.fullscreenOff'),
        onSelect: () => {
          void toggleFullscreen();
        },
      });
    }
    this.menu = new Menu(this, this.s, items);

    const offFs = (): void => {
      this.menu.refreshLabels();
      this.s.viewport.refresh();
    };
    onFullscreenChange(offFs);
    const offDevice = this.s.device.onChange(() => this.updateDeviceTexts());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offDevice();
      document.removeEventListener('fullscreenchange', offFs);
      document.removeEventListener('webkitfullscreenchange', offFs);
      this.menu.destroy();
      if (this.textures.exists(SKYLINE_KEY)) this.textures.remove(SKYLINE_KEY);
      this.skyTex = null;
    });

    this.updateDeviceTexts();
    this.applyState();
  }

  protected layout(vp: ViewportState): void {
    const margin = Math.round(TUNING.ui.edgeMargin * vp.dpr);
    const safe = safeRect(vp, margin);
    const ui = pixelScale(vp, TUNING.display.uiArtScale);
    const small = pixelScale(vp, 1.5);

    // Hintergrund: Skyline in Art-Pixeln, ganzzahlig hochskaliert, unten bündig.
    const bgScale = pixelScale(vp, 3);
    const artW = Math.ceil(vp.width / bgScale);
    const artH = Math.ceil(vp.height / bgScale);
    this.buildSkyline(artW, artH);
    this.bg.setTexture(SKYLINE_KEY).setScale(bgScale).setPosition(0, vp.height - artH * bgScale);

    const minBtn = Math.round(TUNING.ui.minTouchTarget * vp.dpr);
    const cx = Math.round(vp.width / 2);

    // Fußzeile zuerst: sie legt fest, wie viel Platz nach unten bleibt.
    const portrait = vp.orientation === 'portrait';
    this.disclaimer.setScale(small);
    this.version.setScale(small);
    this.deviceLabel.setScale(small);
    const bottom = safe.y + safe.height;
    if (portrait) {
      this.disclaimer.setOrigin(0.5, 1).setPosition(cx, bottom);
      this.version.setOrigin(0.5, 1).setPosition(cx, bottom - 12 * small);
      this.deviceLabel.setOrigin(0.5, 1).setPosition(cx, bottom - 24 * small);
    } else {
      this.disclaimer.setOrigin(0, 1).setPosition(safe.x, bottom);
      this.version.setOrigin(1, 1).setPosition(safe.x + safe.width, bottom);
      this.deviceLabel.setOrigin(1, 1).setPosition(safe.x + safe.width, bottom - 12 * small);
    }
    const footerTop = portrait ? bottom - 34 * small : bottom - 22 * small;
    // Dunkler, nach oben ausgeblendeter Streifen hinter der Fußzeile (Lesbarkeit über hellen Fenstern).
    const fb = this.footerBg;
    fb.clear();
    for (let i = 0; i < 6; i++) fb.fillStyle(hex('ink0'), 0.12 * (i + 1)).fillRect(0, footerTop - 6 * small + i * small, vp.width, small);
    fb.fillStyle(hex('ink0'), 0.78).fillRect(0, footerTop, vp.width, vp.height - footerTop);

    // Platzbedarf des Menüblocks (Buttons + Hinweis + Ränder).
    const gap = Math.round(3 * ui);
    const menuBlock = this.menu.count * minBtn + (this.menu.count - 1) * gap + 18 * small + 12 * ui;

    // Kopfbereich: größtes ganzzahliges Logo, das in Breite und verbleibende Höhe passt.
    this.logo.setScale(1);
    const logoArtW = this.logo.width;
    const maxL = Math.min(Math.floor((safe.width * 0.72) / Math.max(1, logoArtW)), Math.round(TUNING.display.logoArtScale.max * vp.dpr));
    const room = footerTop - safe.y - menuBlock;
    const headerH = (L: number, withHandset: boolean, withSubtitle: boolean): number => {
      const hs = Math.max(ui, Math.round(L * 0.6));
      const sub = Math.max(ui, Math.round(L * 0.45));
      return (withHandset ? 19 * hs : 0) + 10 * L + 11 * sub + (withSubtitle ? 13 * ui : 0);
    };
    let L = Math.max(ui, maxL);
    let withHandset = true;
    let withSubtitle = true;
    while (L > ui && headerH(L, true, true) > room) L--;
    if (headerH(L, true, true) > room) withHandset = false;
    if (!withHandset && headerH(L, false, true) > room) withSubtitle = false;
    this.handset.setVisible(withHandset);
    this.ring.setVisible(withHandset);
    this.subtitle.setVisible(withSubtitle);

    const used = headerH(L, withHandset, withSubtitle);
    // Freien Platz gleichmäßig über und unter dem Kopfbereich verteilen.
    const spare = Math.max(0, room - used);
    let y = Math.round(safe.y + spare * 0.3);

    this.handsetScale = Math.max(ui, Math.round(L * 0.6));
    if (withHandset) {
      const hs = this.handsetScale;
      this.handset.setScale(hs);
      this.handsetBase = { x: cx, y: Math.round(y + 12 * hs) };
      this.handset.setPosition(this.handsetBase.x, this.handsetBase.y);
      y += 19 * hs;
    }
    this.logo.setScale(L);
    this.logoShadow.setScale(L);
    const logoW = this.logo.width;
    const logoX = Math.round(cx - logoW / 2);
    const logoY = y;
    this.logo.setPosition(logoX, logoY);
    this.logoShadow.setPosition(logoX + Math.max(1, Math.round(L / 3)), logoY + Math.max(1, Math.round(L / 3)));
    y += 10 * L;
    const subScale = Math.max(ui, Math.round(L * 0.45));
    this.logoSub.setScale(subScale).setOrigin(1, 0).setPosition(logoX + logoW, y + subScale);
    y += 11 * subScale;
    this.subtitle.setScale(ui).setPosition(cx, y + ui);
    if (withSubtitle) y += 13 * ui;

    // Menü bzw. Aufforderung mittig im Restplatz zwischen Kopf und Fußzeile.
    const midY = Math.round((y + footerTop) / 2 - 9 * small);
    this.prompt.setScale(ui).setPosition(cx, midY);
    this.menu.layout(cx, midY, ui, minBtn);
    const mb = this.menu.bounds;
    this.navHint.setScale(small).setPosition(cx, Math.round(mb.y + mb.height + 9 * small));
    // Halbtransparente Fläche hinter Menü und Hinweis (Lesbarkeit über der Skyline).
    const padBg = 6 * ui;
    const bgW = Math.max(mb.width, this.navHint.width) + padBg * 2;
    this.menuBg
      .clear()
      .fillStyle(hex('ink0'), 0.62)
      .fillRect(Math.round(cx - bgW / 2), mb.y - padBg, Math.round(bgW), Math.round(mb.height + 18 * small + padBg * 2));
    this.registry.set('menuRects', this.menu.rects().map((r) => ({ id: r.id, x: r.x / vp.dpr, y: r.y / vp.dpr, w: r.w / vp.dpr, h: r.h / vp.dpr })));

    // Vollbild-Knopf oben rechts (Daumengröße).
    const size = Math.max(minBtn, 11 * ui);
    this.fsRect = { x: safe.x + safe.width - size, y: safe.y, size };
    this.fsZone.setPosition(this.fsRect.x, this.fsRect.y).setSize(size, size);
    this.drawFsButton(ui);
  }

  protected override frameUpdate(dt: number): void {
    this.time0 += dt;
    const inp = this.s.input;

    // Aufforderung pulsiert.
    this.prompt.setAlpha(0.55 + 0.45 * Math.abs(Math.sin(this.time0 * 2.4)));
    this.animateHandset(dt);

    if (this.state === 'attract') {
      if (inp.anyJustPressed()) {
        this.s.sfx.start();
        this.state = 'menu';
        this.applyState();
      }
    } else {
      this.menu.update(dt);
      if (inp.justPressed('uiBack')) {
        this.s.sfx.back();
        this.state = 'attract';
        this.applyState();
      }
    }
    this.registry.set('titleState', this.state);
    this.registry.set('menuFocus', this.state === 'menu' ? this.menu.focusedId : undefined);
  }

  protected override fixedUpdate(dt: number): void {
    // Fenster und Sterne der Skyline flackern im festen Takt.
    this.blinkTimer += dt;
    if (this.blinkTimer < 0.25 || !this.sky || !this.skyTex) return;
    this.blinkTimer = 0;
    const toggles = Math.max(1, Math.round(this.sky.windows.length * TUNING.title.windowBlinkRate * 0.25));
    for (let i = 0; i < toggles; i++) {
      const w = this.rng.pick(this.sky.windows);
      w.lit = !w.lit;
    }
    const ctx = this.skyTex.getContext();
    drawWindows(ctx, this.sky);
    drawStars(ctx, this.sky, () => this.rng.chance(0.93));
    this.skyTex.refresh();
  }

  private applyState(): void {
    const menu = this.state === 'menu';
    this.menu.setVisible(menu);
    this.menu.setEnabled(menu);
    this.prompt.setVisible(!menu);
    this.navHint.setVisible(menu);
    this.menuBg.setVisible(menu);
    if (menu) this.menu.setFocus(0);
    this.registry.set('titleState', this.state);
  }

  private updateDeviceTexts(): void {
    const mode = this.s.device.hintMode;
    this.prompt.setText(t(`title.pressStart.${mode}`));
    this.navHint.setText(t(`navHint.${mode}`));
    this.deviceLabel.setText(t('device.label', { device: t(`device.${mode}`) }));
    this.registry.set('hintMode', mode);
  }

  private buildSkyline(artW: number, artH: number): void {
    if (this.sky && this.sky.width === artW && this.sky.height === artH && this.skyTex) return;
    if (this.textures.exists(SKYLINE_KEY)) {
      this.bg.setTexture(TEX.pixel);
      this.textures.remove(SKYLINE_KEY);
    }
    this.sky = designSkyline(artW, artH);
    this.skyTex = this.textures.createCanvas(SKYLINE_KEY, artW, artH);
    if (!this.skyTex) return;
    drawSkyline(this.skyTex.getContext(), this.sky);
    this.skyTex.refresh();
  }

  private animateHandset(dt: number): void {
    // Klingelt im Titel alle 2,4 s für 0,8 s; im Menü ist abgenommen.
    this.ringTimer = (this.ringTimer + dt) % 2.4;
    const ringing = this.state === 'attract' && this.ringTimer < 0.8;
    const s = this.handsetScale;
    const bob = Math.round(Math.sin(this.time0 * 2) * s);
    if (ringing) {
      const shake = Math.sin(this.time0 * 60) * 0.12;
      this.handset.setRotation(shake);
      this.handset.setPosition(this.handsetBase.x, this.handsetBase.y - s + bob);
    } else {
      this.handset.setRotation(0);
      this.handset.setPosition(this.handsetBase.x, this.handsetBase.y + bob);
    }
    const g = this.ring;
    g.clear();
    if (!ringing || Math.floor(this.time0 * 10) % 2 === 1) return;
    g.fillStyle(hex('mustard'), 1);
    const cx = this.handsetBase.x;
    const cy = this.handsetBase.y + bob;
    const px = (x: number, y: number): void => {
      g.fillRect(cx + x * s, cy + y * s, s, s);
    };
    for (const [x, y] of [[-14, -2], [-15, -3], [-16, -4], [13, -2], [14, -3], [15, -4], [-1, -9], [0, -9], [-1, -10], [0, -10], [-1, -11], [0, -11]] as const) {
      px(x, y);
    }
  }

  private drawFsButton(ui: number): void {
    const g = this.fsButton;
    const { x, y, size } = this.fsRect;
    g.clear();
    const box = 11 * ui;
    const bx = Math.round(x + (size - box) / 2);
    const by = Math.round(y + (size - box) / 2);
    g.fillStyle(hex('ink0'), 0.55).fillRect(bx, by, box, box);
    g.fillStyle(hex('paper'), 1);
    const p = (px: number, py: number, w: number, h: number): void => {
      g.fillRect(bx + px * ui, by + py * ui, w * ui, h * ui);
    };
    // Vier Ecken-Winkel.
    p(2, 2, 3, 1); p(2, 2, 1, 3);
    p(6, 2, 3, 1); p(8, 2, 1, 3);
    p(2, 8, 3, 1); p(2, 6, 1, 3);
    p(6, 8, 3, 1); p(8, 6, 1, 3);
  }
}

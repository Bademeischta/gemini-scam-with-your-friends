import Phaser from 'phaser';
import { hex, PALETTE } from '../config/palette';
import { TUNING } from '../config/tuning';
import { currentRun, finishDay, nextDay, recordStaplers, unlockNames, type ReviewResult } from '../core/run';
import { BOSS_LOOK, CHAR_H, frameIndex, PLAYER_LOOK } from '../gfx/characters';
import { characterTexture, gridTexture } from '../gfx/phaserTextures';
import { PixelGrid } from '../gfx/PixelGrid';
import { i18n, t } from '../i18n';
import { StaplerGame, STAGE } from '../systems/day/staplers';
import { Rng } from '../systems/rng/rng';
import { pixelScale, safeRect, type ViewportState } from '../systems/viewport/viewportMath';
import { Menu } from '../ui/Menu';
import { PixelLabel } from '../ui/PixelLabel';
import { BODY_FONT } from './AboutScene';
import { BaseScene } from './BaseScene';

function buildStapler(): PixelGrid {
  const g = new PixelGrid(9, 5);
  g.rect(1, 0, 7, 2, 'red').rect(0, 2, 9, 2, 'ink3').hline(0, 4, 9, 'ink0').set(8, 1, 'ink0').set(1, 1, 'wine');
  return g;
}

type Phase = 'dodge' | 'verdict';

/**
 * Leistungsbewertung (DAY-05, 08, 09, 11): Das Team steht auf dem Teppich vor Brülling, der
 * Ergebnisbalken füllt sich, Tacker fliegen (ausweichen!), dann das Urteil mit Spruch, den drei
 * stärksten Momenten des Tages und den Freischaltungen für morgen. Bestanden → nächster Tag,
 * verfehlt → Kündigungsbericht.
 */
export class ReviewScene extends BaseScene {
  protected override readonly pausable = true;
  private result!: ReviewResult;
  private game2!: StaplerGame;
  private phase: Phase = 'dodge';
  private time0 = 0;
  private stage!: Phaser.GameObjects.Container;
  private stageBg!: Phaser.GameObjects.Graphics;
  private boss!: Phaser.GameObjects.Sprite;
  private player!: Phaser.GameObjects.Sprite;
  private staplerSprites: Phaser.GameObjects.Image[] = [];
  private fx!: Phaser.GameObjects.Graphics;
  private panel!: Phaser.GameObjects.Graphics;
  private barG!: Phaser.GameObjects.Graphics;
  private heading!: PixelLabel;
  private barLabel!: PixelLabel;
  private hint!: Phaser.GameObjects.Text;
  private body!: Phaser.GameObjects.Text;
  private menu!: Menu;
  private stageScale = 2;
  private stageRect = { x: 0, y: 0, w: 0, h: 0 };
  private barRect = { x: 0, y: 0, w: 0, h: 0 };
  private touchDir = 0;

  constructor() {
    super('Review');
  }

  protected build(): void {
    const run = currentRun();
    this.result = finishDay(run);
    this.phase = 'dodge';
    this.time0 = 0;
    this.touchDir = 0;
    this.game2 = new StaplerGame(new Rng((run.seed ^ (run.shift.day * 977)) >>> 0));
    this.cameras.main.setBackgroundColor(PALETTE.ink0);

    characterTexture(this, 'char-boss', BOSS_LOOK);
    characterTexture(this, 'char-player', PLAYER_LOOK);
    gridTexture(this, 'stapler', buildStapler);
    this.stage = this.add.container(0, 0);
    this.stageBg = this.add.graphics();
    this.boss = this.add.sprite(0, 0, 'char-boss', frameIndex('down', 'walk0')).setOrigin(0.5, 1);
    this.player = this.add.sprite(0, 0, 'char-player', frameIndex('up', 'walk0')).setOrigin(0.5, 1);
    this.fx = this.add.graphics();
    this.stage.add([this.stageBg, this.boss, this.player, this.fx]);
    this.staplerSprites = [];

    this.panel = this.add.graphics();
    this.barG = this.add.graphics();
    this.heading = new PixelLabel(this, t('review.title'), { scale: 2, color: 'mustard', shadow: 'ink0' });
    this.barLabel = new PixelLabel(this, '', { scale: 2, color: 'white', shadow: 'ink0' });
    this.hint = this.add.text(0, 0, '', { fontFamily: BODY_FONT, color: PALETTE.fog, fontSize: '14px' });
    this.body = this.add.text(0, 0, '', { fontFamily: BODY_FONT, color: PALETTE.paper, fontSize: '15px', lineSpacing: 4 });
    const passed = this.result.passed;
    this.menu = new Menu(this, this.s, [
      {
        id: passed ? 'nextDay' : 'report',
        label: () => (passed ? t('review.continue', { day: this.result.day + 1 }) : t('review.toReport')),
        onSelect: () => this.continue(),
      },
    ]);
    this.menu.setVisible(false);
    this.menu.setEnabled(false);

    // Touch: links bzw. rechts auf der Bühne tippen und halten.
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => this.touchAt(p));
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => p.isDown && this.touchAt(p));
    this.input.on(Phaser.Input.Events.POINTER_UP, () => (this.touchDir = 0));
    const offPause = this.s.pause.onChange((paused, reasons) => {
      if (paused && (reasons.has('background') || reasons.has('blur')) && !reasons.has('menu')) this.openPause();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offPause();
      this.menu.destroy();
    });
    this.s.sfx.drumroll(TUNING.review.barSeconds);
    this.updateTexts();
    this.publish();
  }

  protected layout(vp: ViewportState): void {
    this.cameras.main.setSize(vp.width, vp.height);
    const safe = safeRect(vp, Math.round(TUNING.ui.edgeMargin * vp.dpr));
    const ui = pixelScale(vp, TUNING.display.uiArtScale);
    const minBtn = Math.round(TUNING.ui.minTouchTarget * vp.dpr);
    const landscape = safe.width >= safe.height * 1.2;
    // Bühne: größter ganzzahliger Maßstab, der in ihren Bereich passt.
    const stageArea = landscape ? { x: safe.x, y: safe.y, w: Math.round(safe.width * 0.62), h: safe.height } : { x: safe.x, y: safe.y, w: safe.width, h: Math.round(safe.height * 0.5) };
    this.stageScale = Math.max(1, Math.floor(Math.min(stageArea.w / STAGE.w, stageArea.h / STAGE.h)));
    const sw = STAGE.w * this.stageScale;
    const sh = STAGE.h * this.stageScale;
    this.stageRect = { x: Math.round(stageArea.x + (stageArea.w - sw) / 2), y: Math.round(stageArea.y + (stageArea.h - sh) / 2), w: sw, h: sh };
    this.stage.setPosition(this.stageRect.x, this.stageRect.y).setScale(this.stageScale);
    this.drawStage();

    const pad = 6 * ui;
    const panel = landscape
      ? { x: stageArea.x + stageArea.w + pad, y: safe.y, w: safe.x + safe.width - (stageArea.x + stageArea.w + pad), h: safe.height }
      : { x: safe.x, y: stageArea.y + stageArea.h + pad, w: safe.width, h: safe.y + safe.height - (stageArea.y + stageArea.h + pad) };
    const g = this.panel;
    g.clear().fillStyle(hex('ink2'), 1).fillRect(panel.x, panel.y, panel.w, panel.h).fillStyle(hex('mustard'), 1).fillRect(panel.x, panel.y, panel.w, ui);
    const inner = { x: panel.x + pad, y: panel.y + pad, w: panel.w - 2 * pad };
    this.heading.setScale(ui).setPosition(inner.x, inner.y);
    let y = inner.y + 10 * ui;
    this.barLabel.setScale(ui).setPosition(inner.x, y);
    y += 9 * ui;
    this.barRect = { x: inner.x, y, w: inner.w, h: 7 * ui };
    y += 10 * ui;
    const font = (css: number): number => Math.round(css * vp.dpr);
    this.hint.setStyle({ fontSize: `${font(13)}px`, wordWrap: { width: inner.w, useAdvancedWrap: true } }).setPosition(inner.x, y);
    y += this.hint.height + 4 * ui;
    const bottom = panel.y + panel.h - pad - minBtn;
    // Schrift so wählen, dass Urteil, Momente und Ausblick ohne Scrollen passen.
    for (let css = 15; css >= 10; css--) {
      this.body.setStyle({ fontSize: `${font(css)}px`, wordWrap: { width: inner.w, useAdvancedWrap: true } }).setLineSpacing(font(css * 0.25));
      if (this.body.height <= bottom - y - 4 * ui) break;
    }
    this.body.setPosition(inner.x, y);
    this.menu.layout(Math.round(panel.x + panel.w / 2), Math.round(panel.y + panel.h - pad - minBtn / 2), ui, minBtn);
    this.registry.set('menuRects', this.menu.rects().map((r) => ({ id: r.id, x: r.x / vp.dpr, y: r.y / vp.dpr, w: r.w / vp.dpr, h: r.h / vp.dpr })));
    this.drawBar();
  }

  protected override fixedUpdate(dt: number): void {
    this.time0 += dt;
    if (this.phase !== 'dodge') return;
    const move = Phaser.Math.Clamp(this.s.input.move.x + this.touchDir, -1, 1);
    const r = this.game2.tick(dt, move);
    if (r.thrown) this.s.sfx.staplerThrow();
    if (r.hit) {
      this.s.sfx.staplerHit();
      this.cameras.main.shake(180, 0.006);
    }
    if (this.game2.done && this.time0 >= TUNING.review.barSeconds) this.showVerdict();
  }

  protected override frameUpdate(dt: number): void {
    const inp = this.s.input;
    if (!this.s.pause.paused && inp.justPressed('pause')) this.openPause();
    if (this.phase === 'verdict') this.menu.update(dt);
    this.drawActors();
    this.drawBar();
    this.publish();
  }

  // ------------------------------------------------------------------ Ablauf

  private showVerdict(): void {
    this.phase = 'verdict';
    recordStaplers(currentRun(), this.game2.hits);
    if (this.result.passed) this.s.sfx.fanfare();
    else this.s.sfx.fired();
    this.updateTexts();
    this.menu.setVisible(true);
    this.menu.setEnabled(true);
    this.menu.setFocus(0);
    if (this.vp) this.layout(this.vp);
  }

  private continue(): void {
    this.s.sfx.confirm();
    if (this.result.passed) {
      nextDay(currentRun());
      this.scene.start('Office', { mode: 'day' });
    } else this.scene.start('Report');
  }

  private openPause(): void {
    if (this.scene.isActive('Pause')) return;
    this.scene.launch('Pause', { returnTo: 'Review' });
  }

  private touchAt(p: Phaser.Input.Pointer): void {
    if (this.phase !== 'dodge' || !p.wasTouch) return;
    const mid = this.stageRect.x + this.stageRect.w / 2;
    this.touchDir = p.x < mid ? -1 : 1;
  }

  // ------------------------------------------------------------------ Darstellung

  private updateTexts(): void {
    const r = this.result;
    const mode = this.s.device.hintMode;
    this.barLabel.setText(t('review.barLine', { day: r.day, team: i18n.formatMoney(r.team), quota: i18n.formatMoney(r.quota) }));
    if (this.phase === 'dodge') {
      this.hint.setText(t(`review.dodge.${mode}`));
      this.body.setText('');
      return;
    }
    const hits = this.game2.hits;
    this.hint.setText(hits > 0 ? t('review.hits', { count: hits }) : t('review.noHits'));
    const lines: string[] = [];
    lines.push(r.passed ? t('review.passed') : t('review.fired', { missing: i18n.formatMoney(r.missing) }));
    const quotes = i18n.list(r.passed ? 'boss.passed' : 'boss.fired');
    if (quotes.length > 0) lines.push(t('review.quoteLine', { name: t('boss.name'), text: quotes[r.quote % quotes.length]! }));
    lines.push('', t('review.momentsTitle'));
    r.moments.forEach((m, i) => lines.push(t('review.momentLine', { n: i + 1, text: t(`review.moments.${m.kind}`, m.params) })));
    if (r.passed) {
      const names = unlockNames(r.tomorrow);
      lines.push('', names.length > 0 ? t('review.tomorrow', { list: names.join(', ') }) : t('review.tomorrowNone'));
    }
    this.body.setText(lines.join('\n'));
  }

  private drawStage(): void {
    const g = this.stageBg;
    g.clear();
    // Chefbüro-Holzboden, Teppich davor, Schreibtisch des Chefs.
    g.fillStyle(hex('cocoa'), 1).fillRect(0, 0, STAGE.w, STAGE.h);
    for (let y = 0; y < STAGE.h; y += 6) g.fillStyle(hex('coffee'), 1).fillRect(0, y, STAGE.w, 1);
    g.fillStyle(hex('ink1'), 1).fillRect(0, 0, STAGE.w, 12);
    g.fillStyle(hex('wine'), 1).fillRect(10, 64, STAGE.w - 20, STAGE.h - 70);
    g.lineStyle(1, hex('mustardDark'), 1).strokeRect(13.5, 67.5, STAGE.w - 27, STAGE.h - 76);
    for (let y = 76; y < STAGE.h - 10; y += 14) for (let x = 24; x < STAGE.w - 20; x += 16) g.fillStyle(hex('mustard'), 1).fillRect(x, y, 1, 1);
    g.fillStyle(hex('ink0'), 1).fillRect(STAGE.w / 2 - 34, STAGE.bossY + 2, 68, 16);
    g.fillStyle(hex('coffee'), 1).fillRect(STAGE.w / 2 - 33, STAGE.bossY + 3, 66, 14);
  }

  private drawActors(): void {
    const gm = this.game2;
    const t0 = this.time0;
    this.boss.setPosition(Math.round(gm.bossX), STAGE.bossY + 4).setFrame(frameIndex('down', gm.throwing ? (['walk1', 'walk3'] as const)[Math.floor(t0 * 6) % 2]! : 'walk0'));
    const walking = Math.abs(this.s.input.move.x + this.touchDir) > 0.1 && gm.ko === 0 && this.phase === 'dodge';
    const pose = walking ? (['walk0', 'walk1', 'walk2', 'walk3'] as const)[Math.floor(t0 * 9) % 4]! : 'walk0';
    this.player.setPosition(Math.round(gm.playerX), STAGE.playerY).setFrame(frameIndex('up', pose));
    this.player.setAngle(gm.ko > 0 && this.phase === 'dodge' ? 90 : 0);
    // Tacker.
    while (this.staplerSprites.length < gm.staplers.length) {
      const img = this.add.image(0, 0, 'stapler');
      this.stage.add(img);
      this.staplerSprites.push(img);
    }
    this.staplerSprites.forEach((img, i) => {
      const s = gm.staplers[i];
      img.setVisible(!!s);
      if (s) img.setPosition(Math.round(s.x), Math.round(s.y)).setRotation(s.spin);
    });
    // K.o.-Sternchen.
    const fx = this.fx;
    fx.clear();
    if (gm.ko > 0 && this.phase === 'dodge') {
      for (let i = 0; i < 3; i++) {
        const a = t0 * 6 + (i * Math.PI * 2) / 3;
        fx.fillStyle(hex('mustard'), 1).fillRect(Math.round(gm.playerX + Math.cos(a) * 8), Math.round(STAGE.playerY - CHAR_H - 2 + Math.sin(a) * 3), 2, 2);
      }
    }
  }

  private drawBar(): void {
    const { x, y, w, h } = this.barRect;
    if (w <= 0) return;
    const g = this.barG.clear();
    const u = pixelScale(this.vp, TUNING.display.uiArtScale);
    const r = this.result;
    // Balken füllt sich mit dem Trommelwirbel; die Quota-Linie liegt bei 80 % der Breite.
    const fill = Math.min(1, this.time0 / TUNING.review.barSeconds);
    const ratio = r.quota > 0 ? r.team / r.quota : 1;
    const shown = Math.min(1.25, ratio) * fill;
    const quotaX = x + Math.round(w * 0.8);
    g.fillStyle(hex('ink0'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex(ratio >= 1 ? 'mint' : 'red'), 1).fillRect(x + u, y + u, Math.round((w - 2 * u) * Math.min(1, (shown * 0.8))), h - 2 * u);
    g.fillStyle(hex('white'), 1).fillRect(quotaX, y - u, u, h + 2 * u);
  }

  private publish(): void {
    this.registry.set('review', {
      phase: this.phase,
      passed: this.result.passed,
      day: this.result.day,
      team: this.result.team,
      quota: this.result.quota,
      hits: this.game2.hits,
      staplers: this.game2.staplers.length,
      moments: this.result.moments.map((m) => m.kind),
      tomorrow: this.result.tomorrow,
      playerX: Math.round(this.game2.playerX),
    });
  }
}

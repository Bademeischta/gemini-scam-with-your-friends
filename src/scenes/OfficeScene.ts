import Phaser from 'phaser';
import { hex } from '../config/palette';
import { TUNING } from '../config/tuning';
import { BOSS_SEAT, DESKS, deskGeometry, OFFICE_OBJECTS, OFFICE_SIZE, SPAWN, SPRITE_SIZE, TILE, TIMECLOCK, type OfficeObject } from '../data/office';
import { clockOut, currentRun, dayOver, hasRun, resumeRun, startNewRun, tickBoss } from '../core/run';
import { i18n } from '../i18n';
import type { BossEvent } from '../systems/day/boss';
import { buildRingBubble, buildRingHandset, buildRingWaves } from '../gfx/callArt';
import { BOSS_LOOK, CHAR_H, frameIndex, PLAYER_LOOK, type Facing, type Pose } from '../gfx/characters';
import { buildBossDoorHalf, buildFloor, buildSprite } from '../gfx/officeArt';
import { characterTexture, gridTexture } from '../gfx/phaserTextures';
import { t } from '../i18n';

import { actionHint } from '../i18n/keyNames';
import type { CollisionWorld } from '../systems/office/collision';
import { findInteractable, type Interactable } from '../systems/office/interaction';
import { createMover, speedOf, stepMover, type MoverParams, type MoverState } from '../systems/office/mover';
import { buildOfficeWorld } from '../systems/office/officeWorld';
import type { ViewportState } from '../systems/viewport/viewportMath';
import { PixelLabel } from '../ui/PixelLabel';
import { BaseScene } from './BaseScene';
import type { DesktopData } from './DesktopScene';
import type { OfficeHudScene } from './OfficeHudScene';

const DEPTH_FLOOR = -1_000_000;
const DEPTH_WALL = -500_000;
const DEPTH_PROMPT = 1_000_000;

/** Wie die Büro-Szene betreten wird: neuer Run, gespeicherten fortsetzen, nächster Tag (Run steht schon). */
export interface OfficeData {
  mode?: 'new' | 'continue' | 'day';
}

/** Ereignisse des Arbeitstags für Desktop und HUD (über `game.events`, Name `office-event`). */
export type OfficeEvent =
  | { type: 'patrol'; line: string }
  | { type: 'catch'; line: string; fine: string }
  | { type: 'yell'; line: string }
  | { type: 'quota' }
  | { type: 'timeUp' };

/**
 * Das Büro: begehbare Draufsicht mit 8 Arbeitsplätzen, Chefbüro und Küche.
 * Spiellogik (Bewegung, Kollision) läuft im festen Takt; dargestellt wird interpoliert.
 */
export class OfficeScene extends BaseScene {
  protected override readonly pausable = true;
  private world!: CollisionWorld;
  private interactables: Interactable[] = [];
  private mover!: MoverState;
  private prev = { x: 0, y: 0 };
  private player!: Phaser.GameObjects.Sprite;
  private seatedAt: number | null = null;
  private chairDepth = new Map<number, number>();
  private focus: Interactable | null = null;
  private prompt!: PixelLabel;
  private promptBg!: Phaser.GameObjects.Graphics;
  private zoom = 1;
  private cam = { x: 0, y: 0 };
  private params!: MoverParams;
  private hud: OfficeHudScene | null = null;
  /** MogelOS ist offen (Spieler sitzt am PC). */
  private desktopOpen = false;
  private boss!: Phaser.GameObjects.Sprite;
  private bossPrev = { x: 0, y: 0 };
  private bossSay!: PixelLabel;
  private bossSayBg!: Phaser.GameObjects.Graphics;
  private bossSayTime = 0;
  private bossChairDepth = 0;
  /** Bewertung läuft an (Szene wird gleich gewechselt). */
  private reviewing = false;
  private quotaAnnounced = false;
  /** Klingel-Anzeige je Platz (Hörer hüpft, Wellen, Blase). */
  private rings: { handset: Phaser.GameObjects.Image; waves: Phaser.GameObjects.Image; bubble: Phaser.GameObjects.Image; phase: number; nextSound: number }[] = [];

  constructor() {
    super('Office');
  }

  protected build(data?: unknown): void {
    this.params = {
      speed: TUNING.office.walkSpeedTiles * TILE,
      accelTime: TUNING.office.accelTime,
      decelTime: TUNING.office.decelTime,
      hitbox: TUNING.office.hitbox,
    };
    // Neuer Run, gespeicherten fortsetzen (MOD-07) oder nächster Tag nach der Bewertung.
    const mode = (data as OfficeData | undefined)?.mode ?? 'new';
    const saved = this.s.saves.run;
    if (mode === 'continue' && saved) resumeRun(saved);
    else if (mode !== 'day' || !hasRun()) startNewRun();
    this.reviewing = false;
    this.quotaAnnounced = currentRun().shift.quotaReached;
    this.desktopOpen = false;
    const built = buildOfficeWorld();
    this.world = built.world;
    this.interactables = built.interactables;
    this.seatedAt = null;
    this.focus = null;

    this.add.image(0, 0, gridTexture(this, 'office-floor', buildFloor)).setOrigin(0, 0).setDepth(DEPTH_FLOOR);
    for (const o of OFFICE_OBJECTS) this.addObject(o);

    characterTexture(this, 'char-boss', BOSS_LOOK);
    const chair = OFFICE_OBJECTS.find((o) => o.id === 'bossChair')!;
    this.bossChairDepth = chair.y + 18.5;
    this.boss = this.add.sprite(BOSS_SEAT.x, BOSS_SEAT.y, 'char-boss', frameIndex('down', 'walk0')).setOrigin(0.5, 1).setDepth(this.bossChairDepth);
    this.bossPrev = { ...BOSS_SEAT };
    this.bossSayBg = this.add.graphics().setDepth(DEPTH_PROMPT - 2).setVisible(false);
    this.bossSay = new PixelLabel(this, '', { scale: 1, color: 'white', shadow: null, originX: 0.5, originY: 1, depth: DEPTH_PROMPT - 1, align: 'center' });
    this.bossSay.setMaxWidth(150).setVisible(false);
    this.bossSayTime = 0;

    characterTexture(this, 'char-player', PLAYER_LOOK);
    this.mover = createMover(SPAWN.x, SPAWN.y, 'up');
    this.prev = { x: SPAWN.x, y: SPAWN.y };
    this.player = this.add.sprite(SPAWN.x, SPAWN.y, 'char-player', frameIndex('up', 'walk0')).setOrigin(0.5, 1);

    gridTexture(this, 'ring-handset', buildRingHandset);
    gridTexture(this, 'ring-waves', buildRingWaves);
    gridTexture(this, 'ring-bubble', buildRingBubble);
    this.rings = DESKS.map((d) => ({
      handset: this.add.image(d.x + 24, d.y + 10, 'ring-handset').setOrigin(0, 0).setVisible(false),
      waves: this.add.image(d.x + 20, d.y + 6, 'ring-waves').setOrigin(0, 0).setVisible(false),
      bubble: this.add.image(d.x + 16, d.y - 4, 'ring-bubble').setOrigin(0.5, 1).setVisible(false).setDepth(DEPTH_PROMPT - 1),
      phase: Math.random(),
      nextSound: 0,
    }));
    this.promptBg = this.add.graphics().setDepth(DEPTH_PROMPT);
    this.prompt = new PixelLabel(this, '', { scale: 1, color: 'white', shadow: 'ink0', originX: 0.5, originY: 1, depth: DEPTH_PROMPT + 1 });

    // HUD-Ebene (Touch-Steuerung) darüber starten.
    this.scene.launch('OfficeHud');
    this.hud = this.scene.get('OfficeHud') as OfficeHudScene;
    this.hud.events.on('pause-request', this.openPause, this);

    // Auto-Pause: Wer die App verlässt, kommt ins Pausenmenü zurück.
    const offPause = this.s.pause.onChange((paused, reasons) => {
      if (paused && (reasons.has('background') || reasons.has('blur')) && !reasons.has('menu')) this.openPause();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offPause();
      this.hud?.events.off('pause-request', this.openPause, this);
      this.scene.stop('OfficeHud');
      this.scene.stop('Desktop');
      this.s.input.setVirtualStick(0, 0);
    });
    this.cam = { x: SPAWN.x, y: SPAWN.y - CHAR_H / 2 };
  }

  protected layout(vp: ViewportState): void {
    const cam = this.cameras.main;
    cam.setSize(vp.width, vp.height);
    // Ganzzahliger Zoom: ~14 Kacheln entlang der kürzeren Seite, aber nie mehr Fläche als das Büro
    // (sonst entstehen leere Balken, z. B. im Hochformat).
    const byShortSide = Math.round(Math.min(vp.width, vp.height) / (TUNING.office.viewTilesShortSide * TILE));
    this.zoom = Math.max(1, byShortSide, Math.ceil(vp.width / OFFICE_SIZE.w), Math.ceil(vp.height / OFFICE_SIZE.h));
    cam.setZoom(this.zoom);
    cam.setRoundPixels(true);
    this.applyCamera(true);
  }

  protected override fixedUpdate(dt: number): void {
    if (this.reviewing) return;
    // Der Arbeitstag und die Anrufe laufen, egal ob am PC oder im Büro (nur die Pause hält sie an).
    const run = currentRun();
    run.shift.tick(dt);
    run.calls.tick(dt);
    run.phone.tick(dt);
    this.bossPrev = { x: run.boss.pos.x, y: run.boss.pos.y };
    for (const e of tickBoss(run, dt, { seated: this.seatedAt !== null, player: { x: this.mover.x, y: this.mover.y } })) this.onBossEvent(e);
    if (!this.quotaAnnounced && run.shift.quotaReached) {
      this.quotaAnnounced = true;
      this.s.sfx.notify();
      this.emitOffice({ type: 'quota' });
    }
    // Countdown abgelaufen oder ausgestempelt: alle zur Leistungsbewertung (DAY-01, DAY-04).
    if (dayOver(run)) {
      this.startReview();
      return;
    }
    this.prev = { x: this.mover.x, y: this.mover.y };
    if (this.seatedAt !== null) return;
    stepMover(this.mover, this.s.input.move, dt, this.params, this.world);
  }

  protected override frameUpdate(dt: number, alpha: number): void {
    const paused = this.s.pause.paused;
    const inp = this.s.input;
    // Am PC steuert MogelOS (Aufstehen, Pause); das Büro wartet.
    if (!paused && !this.desktopOpen && !this.reviewing) {
      if (inp.justPressed('pause')) this.openPause();
      else if (this.seatedAt !== null && (inp.justPressed('interact') || inp.justPressed('leave'))) this.standUp();
      else if (this.seatedAt === null && this.focus && inp.justPressed('interact')) {
        if (this.focus.kind === 'timeclock') this.useTimeclock();
        else this.sitDown(this.focus.ref);
      }
    }
    this.drawBoss(paused ? 0 : dt, alpha);

    // Darstellung: zwischen den letzten beiden Logik-Zuständen interpolieren.
    const x = this.prev.x + (this.mover.x - this.prev.x) * alpha;
    const y = this.prev.y + (this.mover.y - this.prev.y) * alpha;
    this.player.setPosition(x, y);
    this.player.setFrame(frameIndex(this.mover.facing, this.currentPose()));
    // Sitzend: über dem Stuhl (verdeckt Sitzfläche und Lehne wie von hinten gesehen), aber vor dem Tisch.
    this.player.setDepth(this.seatedAt !== null ? (this.chairDepth.get(this.seatedAt) ?? y) + 0.5 : y + 0.25);

    this.focus = this.seatedAt === null ? findInteractable(this.interactables, this.mover, this.mover.facing, TUNING.office.interactRadius, TUNING.office.probeAhead) : null;
    this.updateRinging(paused ? 0 : dt, x, y);
    this.updatePrompt();
    this.updateCameraTarget(x, y, dt);
    this.publishState();
  }

  // ------------------------------------------------------------------ Aktionen

  /** Stempeluhr an der Wand: Ausstempeln, sobald die Quota erreicht ist (OS-07). */
  private useTimeclock(): void {
    if (clockOut(currentRun())) this.s.sfx.start();
    else this.s.sfx.deny();
  }

  /** Chef-Ereignisse: Sprechblase, Klang, Screenshake; der Desktop zeigt sie als Benachrichtigung. */
  private onBossEvent(e: BossEvent): void {
    const pick = (key: string): string => {
      const all = i18n.list(key);
      return all.length > 0 ? all[Math.floor(Math.random() * all.length)]! : '';
    };
    if (e.type === 'patrolStart') {
      const line = pick('boss.patrol');
      this.say(line, 3);
      this.emitOffice({ type: 'patrol', line });
    } else if (e.type === 'yell') {
      const line = pick('boss.yell');
      this.say(line, TUNING.boss.yellSeconds + 0.6);
      this.shake();
      this.emitOffice({ type: 'yell', line });
    } else if (e.type === 'catch') {
      const line = pick('boss.catch');
      this.say(line, 3.5);
      this.shake();
      this.emitOffice({ type: 'catch', line, fine: i18n.formatMoney(e.fine) });
    }
  }

  private say(text: string, seconds: number): void {
    this.bossSay.setText(text);
    this.bossSayTime = seconds;
  }

  /** Brüllanfall: Bildschirm wackelt (Büro und, falls offen, der Desktop). */
  private shake(): void {
    this.cameras.main.shake(TUNING.boss.shakeSeconds * 1000, TUNING.boss.shakeIntensity);
    this.s.sfx.moodDown();
  }

  private emitOffice(e: OfficeEvent): void {
    this.game.events.emit('office-event', e);
  }

  private startReview(): void {
    if (this.reviewing) return;
    this.reviewing = true;
    this.s.input.setVirtualStick(0, 0);
    if (!currentRun().clockedOut) this.emitOffice({ type: 'timeUp' });
    this.scene.start('Review');
  }

  private sitDown(deskIndex: number): void {
    const desk = DESKS[deskIndex];
    if (!desk) return;
    const g = deskGeometry(desk);
    this.seatedAt = deskIndex;
    this.mover.x = g.seat.x;
    this.mover.y = g.seat.y;
    this.mover.vx = 0;
    this.mover.vy = 0;
    this.mover.facing = 'up';
    this.prev = { x: g.seat.x, y: g.seat.y };
    this.s.sfx.confirm();
    this.events.emit('seated', deskIndex);
    currentRun().calls.setStaffed(deskIndex, true);
    this.openDesktop(deskIndex);
  }

  /** Ansicht wechselt zum MogelOS-Desktop (OFF-17). */
  private openDesktop(deskIndex: number): void {
    this.desktopOpen = true;
    this.s.input.setVirtualStick(0, 0);
    this.scene.sleep('OfficeHud');
    const data: DesktopData = {
      desk: deskIndex,
      onLeave: () => this.closeDesktop(),
      onPause: () => this.openPause(),
      onScreen: (on) => this.cameras.main.setVisible(!on),
    };
    this.scene.launch('Desktop', data);
  }

  private closeDesktop(): void {
    if (!this.desktopOpen) return;
    this.desktopOpen = false;
    this.cameras.main.setVisible(true);
    this.scene.stop('Desktop');
    this.scene.wake('OfficeHud');
    this.standUp();
  }

  private standUp(): void {
    if (this.seatedAt === null) return;
    const g = deskGeometry(DESKS[this.seatedAt]!);
    currentRun().calls.setStaffed(this.seatedAt, false);
    this.seatedAt = null;
    this.mover.x = g.standUp.x;
    this.mover.y = g.standUp.y;
    this.mover.facing = 'down';
    this.prev = { x: g.standUp.x, y: g.standUp.y };
    this.s.sfx.back();
    this.events.emit('stood-up');
  }

  private openPause(): void {
    if (this.scene.isActive('Pause') || this.scene.isSleeping('Pause')) return;
    this.s.sfx.confirm();
    this.s.input.setVirtualStick(0, 0);
    this.scene.launch('Pause', { returnTo: 'Office' });
  }

  // ------------------------------------------------------------------ Darstellung

  private addObject(o: OfficeObject): void {
    let key: string;
    if (o.sprite === 'bossDoor') {
      const left = Number(o.id.split('-')[1]) % 2 === 1;
      key = gridTexture(this, left ? 'obj-bossDoor-L' : 'obj-bossDoor-R', () => buildBossDoorHalf(left));
    } else {
      key = gridTexture(this, `obj-${o.sprite}`, () => buildSprite(o.sprite));
    }
    const depth = o.onWall ? DEPTH_WALL + o.y : o.y + (o.sortY ?? SPRITE_SIZE[o.sprite].h);
    this.add.image(o.x, o.y, key).setOrigin(0, 0).setDepth(depth);
    const chair = /^chair(\d)$/.exec(o.id);
    if (chair) this.chairDepth.set(Number(chair[1]), depth);
  }

  /**
   * Klingelnde Telefone: Hörer hüpft, Wellen und Blase über dem Platz, räumlicher Klingelton
   * (lauter und auf der richtigen Seite, je näher man ist). Liefert der HUD die Ziele für Pfeile.
   */
  private updateRinging(dt: number, px: number, py: number): void {
    const views = currentRun().calls.views();
    const cam = this.cameras.main;
    const targets: { x: number; y: number; desk: number }[] = [];
    views.forEach((v, i) => {
      const r = this.rings[i]!;
      const ringing = v.kind === 'ringing';
      r.handset.setVisible(ringing);
      r.waves.setVisible(false);
      r.bubble.setVisible(ringing && this.seatedAt !== i);
      if (!ringing) return;
      const d = DESKS[i]!;
      r.phase += dt;
      // Klingel-Rhythmus: zwei kurze Stöße, dann Pause (1,6 s).
      const t = r.phase % 1.6;
      const buzzing = t < 0.9;
      const jump = buzzing && Math.floor(t * 16) % 2 === 0;
      r.handset.setY(d.y + 10 - (jump ? 2 : 0)).setDepth((this.chairDepth.get(i) ?? d.y + 24) + 0.6);
      r.waves.setVisible(buzzing).setDepth(r.handset.depth);
      r.bubble.setY(Math.round(d.y - 4 - Math.abs(Math.sin(r.phase * 4)) * 3));
      r.nextSound -= dt;
      if (r.nextSound <= 0 && dt > 0) {
        r.nextSound = 1.6;
        const dx = d.x + 16 - px;
        const dist = Math.hypot(dx, d.y + 20 - py);
        const near = this.seatedAt === i ? 1 : Math.max(0.12, 1 - dist / 420);
        // Am PC hört man fremde Telefone gedämpft.
        const vol = this.desktopOpen && this.seatedAt !== i ? near * 0.35 : near;
        this.s.sfx.ring(vol, Math.max(-1, Math.min(1, dx / 220)));
      }
      targets.push({ x: (d.x + 16 - cam.worldView.x) * this.zoom, y: (d.y + 10 - cam.worldView.y) * this.zoom, desk: i });
    });
    this.hud?.setRingTargets(targets);
  }

  private currentPose(): Pose {
    if (this.seatedAt !== null) return 'sit';
    if (speedOf(this.mover) < 1) return 'walk0';
    const stride = this.params.speed / TUNING.office.walkAnimFps;
    const step = Math.floor(this.mover.distance / stride) % 4;
    return (['walk0', 'walk1', 'walk2', 'walk3'] as const)[step]!;
  }

  private updatePrompt(): void {
    const mode = this.s.device.hintMode;
    const bindings = this.s.input.getBindings();
    let text = '';
    let px = 0;
    let py = 0;
    let below = false;
    if (this.desktopOpen) {
      // Am PC zeigt MogelOS, wie man aufsteht (Taskleiste, Tab, B).
    } else if (this.seatedAt !== null) {
      // Unter dem Stuhl, damit der Hinweis nicht den Monitor verdeckt.
      text = actionHint('interact', t('office.prompt.stand'), mode, bindings);
      px = this.player.x;
      py = this.player.y + 3;
      below = true;
    } else if (this.focus?.kind === 'timeclock') {
      const ready = currentRun().shift.quotaReached;
      text = ready ? actionHint('interact', t('office.prompt.clock'), mode, bindings) : t('office.prompt.clockLocked');
      px = TIMECLOCK.x;
      py = TIMECLOCK.y - 18;
    } else if (this.focus) {
      text = actionHint('interact', t('office.prompt.sit'), mode, bindings);
      const desk = DESKS[this.focus.ref]!;
      px = desk.x + 16;
      py = desk.y - 2;
    }
    // Auf Touch-Geräten zeigt der Kontext-Button die Aktion – dort reicht ein dezenter Hinweis.
    const ctxLabel = this.seatedAt !== null ? t('office.prompt.stand') : this.focus?.kind === 'timeclock' ? t('office.prompt.clock') : this.focus ? t('office.prompt.sit') : '';
    this.hud?.setContext(this.seatedAt !== null ? 'stand' : this.focus ? 'sit' : 'none', ctxLabel);
    const show = text !== '';
    this.prompt.setVisible(show);
    this.promptBg.setVisible(show);
    if (!show) return;
    this.prompt.setText(text).setOrigin(0.5, below ? 0 : 1).setPosition(Math.round(px), Math.round(py + (below ? 2 : 0)));
    const w = this.prompt.width + 6;
    const h = this.prompt.height + 3;
    const top = below ? Math.round(py) : Math.round(py - h);
    this.promptBg
      .clear()
      .fillStyle(hex('ink0'), 0.8)
      .fillRect(Math.round(px - w / 2), top, w, h)
      .fillStyle(hex('mustard'), 1)
      .fillRect(Math.round(px - w / 2), below ? top : top + h, w, 1);
  }

  private updateCameraTarget(x: number, y: number, dt: number): void {
    const k = 1 - Math.exp(-TUNING.office.cameraLerp * dt);
    this.cam.x += (x - this.cam.x) * k;
    this.cam.y += (y - CHAR_H / 2 - this.cam.y) * k;
    this.applyCamera(false);
  }

  private applyCamera(snap: boolean): void {
    const cam = this.cameras.main;
    if (snap && this.mover) this.cam = { x: this.mover.x, y: this.mover.y - CHAR_H / 2 };
    const viewW = cam.width / this.zoom;
    const viewH = cam.height / this.zoom;
    const clampAxis = (c: number, view: number, size: number): number => (view >= size ? size / 2 : Phaser.Math.Clamp(c, view / 2, size - view / 2));
    const cx = clampAxis(this.cam.x, viewW, OFFICE_SIZE.w);
    const cy = clampAxis(this.cam.y, viewH, OFFICE_SIZE.h);
    // Auf ganze physische Pixel runden, damit die Pixel-Art beim Scrollen nicht flimmert.
    cam.centerOn(Math.round(cx * this.zoom) / this.zoom, Math.round(cy * this.zoom) / this.zoom);
  }

  /** Chef zeichnen: sitzt am Schreibtisch oder läuft seinen Kontrollgang; beim Brüllen zittert er. */
  private drawBoss(dt: number, alpha: number): void {
    const b = currentRun().boss;
    const x = this.bossPrev.x + (b.pos.x - this.bossPrev.x) * alpha;
    const y = this.bossPrev.y + (b.pos.y - this.bossPrev.y) * alpha;
    const yelling = b.state === 'yell';
    const jitter = yelling ? (Math.floor(this.time.now / 40) % 2 === 0 ? 1 : -1) : 0;
    const atDesk = b.state === 'office' || (yelling && Math.hypot(b.pos.x - BOSS_SEAT.x, b.pos.y - BOSS_SEAT.y) < 1);
    let facing: Facing = 'down';
    if (!atDesk) facing = Math.abs(b.dir.x) > Math.abs(b.dir.y) ? (b.dir.x < 0 ? 'left' : 'right') : b.dir.y < 0 ? 'up' : 'down';
    const stride = (TUNING.boss.walkSpeedTiles * TILE) / TUNING.office.walkAnimFps;
    const pose: Pose = b.moving ? (['walk0', 'walk1', 'walk2', 'walk3'] as const)[Math.floor(b.distance / stride) % 4]! : 'walk0';
    this.boss.setPosition(Math.round(x) + jitter, Math.round(y)).setFrame(frameIndex(facing, pose));
    this.boss.setDepth(atDesk ? this.bossChairDepth : y + 0.25);
    // Sprechblase über dem Kopf.
    this.bossSayTime = Math.max(0, this.bossSayTime - dt);
    const show = this.bossSayTime > 0;
    this.bossSay.setVisible(show);
    this.bossSayBg.setVisible(show);
    if (!show) return;
    this.bossSay.setColor(yelling ? 'red' : 'white').setPosition(Math.round(x), Math.round(y - CHAR_H - 4));
    const w = this.bossSay.width + 6;
    const h = this.bossSay.height + 4;
    const left = Math.round(x - w / 2);
    const top = Math.round(y - CHAR_H - 4 - h + 2);
    this.bossSayBg.clear().fillStyle(hex('ink0'), 0.85).fillRect(left, top, w, h).fillStyle(hex(yelling ? 'red' : 'paper'), 1).fillRect(left, top + h, w, 1);
  }

  private publishState(): void {
    const run = currentRun();
    this.registry.set('boss', { state: run.boss.state, rage: Math.round(run.boss.rage), x: Math.round(run.boss.pos.x), y: Math.round(run.boss.pos.y), yells: run.boss.yells, catches: run.boss.catches });
    this.registry.set('office', {
      x: Math.round(this.mover.x * 10) / 10,
      y: Math.round(this.mover.y * 10) / 10,
      facing: this.mover.facing,
      seated: this.seatedAt,
      desktop: this.desktopOpen,
      focus: this.focus?.id ?? null,
      prompt: this.prompt.main.visible ? this.prompt.main.text : null,
      zoom: this.zoom,
    });
  }
}

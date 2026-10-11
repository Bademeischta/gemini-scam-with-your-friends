import Phaser from 'phaser';
import { hex } from '../../config/palette';
import { i18n, t } from '../../i18n';
import type { ShiftState } from '../../systems/day/ShiftState';
import { PixelLabel } from '../PixelLabel';
import type { Rect } from './focusNav';
import { rootHost, type HostBase } from './host';
import { OsButton, type Host } from './widgets';

export interface TaskbarWindow {
  id: string;
  title: string;
  icon: string;
  active: boolean;
  minimized: boolean;
}

export interface TaskbarCallbacks {
  /** Normal: Startmenü umschalten. Kompakt: zum Startbildschirm (alle Apps minimieren). */
  onStart(): void;
  onWindow(id: string): void;
  onLeave(): void;
  onPause(): void;
}

export interface TaskbarGeometry {
  vpW: number;
  vpH: number;
  safe: { x: number; y: number; width: number; height: number };
  compact: boolean;
  /** Höhe der Leiste(n) in physischen Pixeln. */
  barH: number;
  statusH: number;
}

/** Statusanzeige: eigenes Geld, Team-Summe gegen Quota (Balken), Countdown bis zur Bewertung. */
class StatusView {
  private readonly money: PixelLabel;
  private readonly team: PixelLabel;
  private readonly clock: PixelLabel;
  private readonly g: Phaser.GameObjects.Graphics;
  private barRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private lastQuota = -1;
  private lastMoney = -1;
  private lastTeam = -1;
  private progress = 0;
  private reached = false;
  /** Kurze Texte ohne „Du:“/„Team“, wenn der Platz knapp ist (Handy hochkant). */
  private short = false;
  private urgent = false;
  private blink = 0;

  constructor(private readonly host: Host) {
    this.g = host.scene.add.graphics();
    host.container.add(this.g);
    const opt = { scale: host.u(), color: 'white' as const, shadow: null, originY: 0.5, container: host.container };
    this.money = new PixelLabel(host.scene, '', { ...opt, originX: 1 });
    this.team = new PixelLabel(host.scene, '', { ...opt, originX: 0.5 });
    this.clock = new PixelLabel(host.scene, '', { ...opt, originX: 0 });
  }

  /** Breite, die die Anzeige für die aktuelle Quota braucht (physische Pixel). */
  preferredWidth(shift: ShiftState, short = false): number {
    const u = this.host.u();
    const was = this.short;
    this.short = short;
    this.setTexts(shift);
    const teamW = Math.max(this.team.width, (short ? 24 : 56) * u) + 8 * u;
    const w = this.money.width + teamW + this.clockWidth() + 16 * u;
    this.short = was;
    this.setTexts(shift);
    return w;
  }

  setShort(on: boolean, shift: ShiftState | null): void {
    this.short = on;
    if (shift) this.setTexts(shift);
  }

  update(shift: ShiftState, dt: number): void {
    this.setTexts(shift);
    this.progress = shift.progress;
    this.reached = shift.quotaReached;
    this.urgent = shift.timeLeft <= 60;
    this.blink = (this.blink + dt) % 1;
    const t = this.host.theme();
    this.clock.setColor(this.urgent && this.blink < 0.5 ? 'red' : t.text);
    this.money.setColor(t.text);
    this.team.setColor(this.reached ? 'ink0' : t.text);
    this.drawBar();
  }

  /** Breite der Anzeige hat sich womöglich geändert (Quota, Geld, Team-Summe): neu anordnen. */
  widthChanged(shift: ShiftState): boolean {
    if (shift.quota === this.lastQuota && shift.personal === this.lastMoney && shift.team === this.lastTeam) return false;
    this.lastQuota = shift.quota;
    this.lastMoney = shift.personal;
    this.lastTeam = shift.team;
    return true;
  }

  /** Anzeige in einem Rechteck (lokal) anordnen: Geld | Team-Balken | Countdown. */
  layout(x: number, y: number, w: number, h: number): void {
    const u = this.host.u();
    const cy = Math.round(y + h / 2);
    for (const l of [this.money, this.team, this.clock]) l.setScale(u);
    const moneyW = this.money.width;
    const clockW = this.clockWidth();
    const barW = Math.max(24 * u, w - moneyW - clockW - 16 * u);
    this.money.setPosition(Math.round(x + moneyW), cy);
    this.barRect = { x: Math.round(x + moneyW + 6 * u), y: Math.round(cy - 6 * u), w: Math.round(barW), h: 12 * u };
    this.team.setPosition(Math.round(this.barRect.x + barW / 2), cy);
    this.clock.setPosition(Math.round(this.barRect.x + barW + 6 * u), cy);
    this.drawBar();
  }

  rects(): Record<string, Rect> {
    return { team: { ...this.barRect } };
  }

  texts(): { money: string; team: string; countdown: string } {
    return { money: this.money.main.text, team: this.team.main.text, countdown: this.clock.main.text };
  }

  private clockWidth(): number {
    // Mindestbreite für „00:00“, damit die Leiste beim Herunterzählen nicht springt.
    return Math.max(this.clock.width, 22 * this.host.u());
  }

  private setTexts(shift: ShiftState): void {
    const money = i18n.formatMoney(shift.personal);
    const team = i18n.formatNumber(shift.team);
    const quota = this.short ? i18n.formatNumber(shift.quota) : i18n.formatMoney(shift.quota);
    this.money.setText(this.short ? money : t('os.taskbar.money', { amount: money }));
    this.team.setText(t(this.short ? 'os.taskbar.teamShort' : 'os.taskbar.team', { team, quota }));
    this.clock.setText(shift.countdownText);
  }

  private drawBar(): void {
    const g = this.g;
    const u = this.host.u();
    const th = this.host.theme();
    const { x, y, w, h } = this.barRect;
    g.clear();
    if (w <= 0) return;
    g.fillStyle(hex('ink0'), 1).fillRect(x, y, w, h);
    g.fillStyle(hex(th.windowDark), 1).fillRect(x + u, y + u, w - 2 * u, h - 2 * u);
    const fill = Math.round((w - 2 * u) * this.progress);
    if (fill > 0) g.fillStyle(hex(this.reached ? 'mint' : th.accent), this.reached ? 1 : 0.55).fillRect(x + u, y + u, fill, h - 2 * u);
  }
}

/**
 * Taskleiste von MogelOS. Normal: unten mit Start, Fenster-Buttons, Status, Aufstehen, Pause.
 * Kompakt (Handy): oben Statusleiste mit Aufstehen und Pause, unten Dock mit Startbildschirm
 * und App-Umschalter (nur Symbole).
 */
export class Taskbar {
  readonly container: Phaser.GameObjects.Container;
  readonly host: Host & { moved(): void };
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly startBtn: OsButton;
  private readonly leaveBtn: OsButton;
  private readonly pauseBtn: OsButton;
  private readonly status: StatusView;
  private readonly winBtns = new Map<string, OsButton>();
  private windows: TaskbarWindow[] = [];
  private geo: TaskbarGeometry | null = null;
  private lastShift: ShiftState | null = null;
  private statusArea: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private winArea: Rect = { x: 0, y: 0, w: 0, h: 0 };
  /** Höhe der Leisten, die den Desktop begrenzen (oben/unten). */
  occupied = { top: 0, bottom: 0 };

  constructor(
    base: HostBase,
    depth: number,
    private readonly cb: TaskbarCallbacks,
  ) {
    const sc = base.scene;
    this.container = sc.add.container(0, 0).setDepth(depth);
    this.host = rootHost(base, this.container, 'taskbar');
    this.bg = sc.add.graphics();
    this.container.add(this.bg);
    // Hintergrund fängt Klicks ab, damit nichts „durch“ die Leiste auf den Desktop fällt.
    this.startBtn = new OsButton(this.host, 'tb:start', { icon: 'os-icon-start', label: t('os.taskbar.start'), onClick: () => cb.onStart() });
    this.leaveBtn = new OsButton(this.host, 'tb:leave', { icon: 'os-icon-standUp', label: t('os.taskbar.leave'), onClick: () => cb.onLeave() });
    this.pauseBtn = new OsButton(this.host, 'tb:pause', { icon: 'icon-pause', onClick: () => cb.onPause() });
    this.status = new StatusView(this.host);
  }

  get compact(): boolean {
    return this.geo?.compact ?? false;
  }

  setWindows(list: TaskbarWindow[]): void {
    const ids = new Set(list.map((w) => w.id));
    for (const [id, btn] of this.winBtns) {
      if (!ids.has(id)) {
        btn.destroy();
        this.winBtns.delete(id);
      }
    }
    for (const w of list) {
      let btn = this.winBtns.get(w.id);
      if (!btn) {
        btn = new OsButton(this.host, `tb:win:${w.id}`, { icon: w.icon, label: w.title, align: 'left', onClick: () => this.cb.onWindow(w.id) });
        this.winBtns.set(w.id, btn);
      }
      btn.setActive(w.active && !w.minimized);
    }
    this.windows = list;
    this.layoutWindows();
  }

  layout(geo: TaskbarGeometry): void {
    this.geo = geo;
    const u = this.host.u();
    const th = this.host.theme();
    const { safe, vpW, vpH, barH } = geo;
    const g = this.bg;
    g.clear();
    const pad = 2 * u;
    const iconScale = Math.max(1, Math.round(u / 2));
    for (const b of [this.startBtn, this.leaveBtn, this.pauseBtn]) b.setIconScale(iconScale);

    if (!geo.compact) {
      const top = vpH - (vpH - safe.y - safe.height) - barH;
      this.occupied = { top: 0, bottom: vpH - top };
      g.fillStyle(hex(th.taskbar), 1).fillRect(0, top, vpW, vpH - top);
      g.fillStyle(hex(th.frameLight), 1).fillRect(0, top, vpW, u);
      const by = top + pad + u;
      const bh = barH - 2 * pad - u;
      let left = safe.x + pad;
      const startW = this.startBtn.preferredWidth();
      this.startBtn.setLabelVisible(true).layout(left, by, startW, bh);
      left += startW + pad;
      let right = safe.x + safe.width - pad;
      this.pauseBtn.layout(right - bh, by, bh, bh);
      right -= bh + pad;
      const leaveFull = this.leaveBtn.preferredWidth();
      const shift = this.lastShift;
      this.status.setShort(false, shift);
      const statusW = shift ? this.status.preferredWidth(shift) : 140 * u;
      // Wenig Platz: „Aufstehen“ nur als Symbol.
      const roomy = right - left - leaveFull - statusW > 80 * u;
      const leaveW = roomy ? leaveFull : bh;
      this.leaveBtn.setLabelVisible(roomy).layout(right - leaveW, by, leaveW, bh);
      right -= leaveW + 2 * pad;
      const sw = Math.min(statusW, Math.max(60 * u, right - left - 40 * u));
      this.statusArea = { x: right - sw, y: by, w: sw, h: bh };
      this.status.layout(right - sw, by, sw, bh);
      right -= sw + 2 * pad;
      g.fillStyle(hex('ink0'), 0.35).fillRect(this.statusArea.x - pad, top + 2 * u, sw + 2 * pad, barH - 3 * u);
      this.winArea = { x: left, y: by, w: Math.max(0, right - left), h: bh };
    } else {
      const statusH = geo.statusH;
      const topBar = safe.y + statusH;
      const bottomTop = vpH - (vpH - safe.y - safe.height) - barH;
      this.occupied = { top: topBar, bottom: vpH - bottomTop };
      g.fillStyle(hex(th.taskbar), 1).fillRect(0, 0, vpW, topBar).fillRect(0, bottomTop, vpW, vpH - bottomTop);
      g.fillStyle(hex(th.frameLight), 1).fillRect(0, topBar - u, vpW, u).fillRect(0, bottomTop, vpW, u);
      // Statusleiste oben: Aufstehen links, Pause rechts, dazwischen der Status.
      const sy = safe.y + pad;
      const sh = statusH - 2 * pad - u;
      const leaveFull = this.leaveBtn.preferredWidth();
      const roomy = safe.width > leaveFull + sh + 120 * u;
      const leaveW = roomy ? leaveFull : sh;
      this.leaveBtn.setLabelVisible(roomy).layout(safe.x + pad, sy, leaveW, sh);
      this.pauseBtn.layout(safe.x + safe.width - pad - sh, sy, sh, sh);
      let sx = safe.x + 2 * pad + leaveW + 2 * u;
      let sw = safe.x + safe.width - 2 * pad - sh - 2 * u - sx;
      const shift = this.lastShift;
      const short = !!shift && this.status.preferredWidth(shift) > sw;
      this.status.setShort(short, shift);
      // Selbst kurz zu eng? Dann „Aufstehen“ nur als Symbol.
      if (shift && roomy && this.status.preferredWidth(shift, true) > sw) {
        this.leaveBtn.setLabelVisible(false).layout(safe.x + pad, sy, sh, sh);
        sx = safe.x + 2 * pad + sh + 2 * u;
        sw = safe.x + safe.width - 2 * pad - sh - 2 * u - sx;
      }
      this.statusArea = { x: sx, y: sy, w: sw, h: sh };
      this.status.layout(sx, sy, sw, sh);
      // Dock unten: Startbildschirm + App-Umschalter.
      const by = bottomTop + pad + u;
      const bh = barH - 2 * pad - u;
      this.startBtn.setLabelVisible(false).layout(safe.x + pad, by, bh, bh);
      this.winArea = { x: safe.x + 2 * pad + bh + 2 * u, y: by, w: Math.max(0, safe.width - 3 * pad - bh - 2 * u), h: bh };
    }
    this.layoutWindows();
  }

  update(shift: ShiftState, dt: number): void {
    const first = this.lastShift === null;
    this.lastShift = shift;
    this.status.update(shift, dt);
    if ((this.status.widthChanged(shift) || first) && this.geo) this.layout(this.geo);
  }

  /** Rechtecke für Tests (physische Pixel). */
  rects(): Record<string, Rect> {
    return { ...this.status.rects(), status: { ...this.statusArea } };
  }

  statusTexts(): { money: string; team: string; countdown: string } {
    return this.status.texts();
  }

  redraw(): void {
    if (this.geo) this.layout(this.geo);
    for (const b of [this.startBtn, this.leaveBtn, this.pauseBtn, ...this.winBtns.values()]) b.draw();
  }

  destroy(): void {
    for (const b of this.winBtns.values()) b.destroy();
    this.startBtn.destroy();
    this.leaveBtn.destroy();
    this.pauseBtn.destroy();
    this.container.destroy(true);
  }

  private layoutWindows(): void {
    if (!this.geo) return;
    const u = this.host.u();
    const { x, y, w, h } = this.winArea;
    const n = this.windows.length;
    if (n === 0) return;
    const pad = 2 * u;
    const compact = this.geo.compact;
    const maxW = compact ? h : 90 * u;
    const each = Math.max(0, Math.min(maxW, Math.floor((w - pad * (n - 1)) / n)));
    const iconOnly = compact || each < 40 * u;
    const iconScale = Math.max(1, Math.round(u / 2));
    this.windows.forEach((win, i) => {
      const btn = this.winBtns.get(win.id);
      if (!btn) return;
      btn.setIconScale(iconScale).setLabelVisible(!iconOnly).setLabel(win.title);
      btn.layout(x + i * (each + pad), y, iconOnly ? Math.min(each, h) : each, h);
    });
  }
}

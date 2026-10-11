import Phaser from 'phaser';
import { TUNING } from '../../config/tuning';
import type { Services } from '../../core/services';
import { WALLPAPERS, OS_THEME_IDS, type OsThemeId, type Wallpaper } from '../../data/os/appearance';
import { buildOsIcon, buildWallpaper, buildWeatherIcon, OS_ICONS, type WeatherIcon } from '../../gfx/osArt';
import { gridTexture } from '../../gfx/phaserTextures';
import { i18n, t } from '../../i18n';
import { callerById } from '../../data/callers';
import { DEFAULT_SCHEME_FOR, schemeById } from '../../data/schemes';
import type { LootLedger } from '../../systems/calls/ledger';
import type { PhoneHub } from '../../systems/calls/PhoneHub';
import type { ShiftState } from '../../systems/day/ShiftState';
import { NavRepeat } from '../../systems/input/NavRepeat';
import type { Notebook } from '../../systems/os/notebook';
import type { Plauder } from '../../systems/os/plauder';
import type { VirtualFs } from '../../systems/os/vfs';
import { haptic } from '../../systems/platform/haptics';
import { safeRect, pixelScale, type ViewportState } from '../../systems/viewport/viewportMath';
import { icon as touchIcon } from '../touch/touchArt';
import { APPS, appById } from './apps';
import { lootTarget, lootTargetName } from './apps/loot';
import { chatName } from './apps/plauder';
import { emptyTrash } from './apps/trash';
import type { AppDef, AppView, ContextItem, OsApi, OsEnv, ToastOptions } from './apps/types';
import { CallPopup } from './CallPopup';
import { DesktopIcon } from './DesktopIcon';
import { FocusManager } from './FocusManager';
import type { NavDir, Rect } from './focusNav';
import { rootHost, type HostBase } from './host';
import { OsWindow } from './OsWindow';
import { PopupMenu, type PopupEntry } from './PopupMenu';
import { attachPress } from './press';
import { Taskbar } from './Taskbar';
import { OS_THEMES, type OsTheme } from './theme';
import { Toasts } from './Toasts';
import { gesture } from './widgets';

const DEPTH = { wallpaper: 0, background: 5, icons: 10, windows: 100, call: 4500, taskbar: 5000, start: 6000, ctx: 7000, toasts: 8000, focus: 9000 } as const;
const WEATHER_ICONS: readonly WeatherIcon[] = ['sun', 'cloud', 'rain', 'storm', 'fog', 'rocket'];

interface WinEntry {
  win: OsWindow;
  def: AppDef;
  view: AppView;
  args: unknown;
}

export interface MogelOSOptions {
  scene: Phaser.Scene;
  s: Services;
  shift: () => ShiftState;
  vfs: VirtualFs;
  /** Platz, an dem der Spieler sitzt, mit Telefon und Notizblock. */
  desk: number;
  phone: PhoneHub;
  notes: Notebook;
  ledger: LootLedger;
  plauder: Plauder;
  /** Aufstehen angefordert (Taskleiste, Tab, B). */
  onLeave: () => void;
  onPause: () => void;
}

/** Alle Texturen von MogelOS einmalig erzeugen. */
function ensureTextures(scene: Phaser.Scene): void {
  for (const name of OS_ICONS) gridTexture(scene, `os-icon-${name}`, () => buildOsIcon(name));
  for (const w of WEATHER_ICONS) gridTexture(scene, `os-wx-${w}`, () => buildWeatherIcon(w));
  for (const wp of WALLPAPERS) gridTexture(scene, `os-wp-thumb-${wp}`, () => buildWallpaper(wp, 40, 24));
  gridTexture(scene, 'icon-pause', () => touchIcon('pause'));
}

/**
 * MogelOS, der Ingame-Desktop (OS-01): Hintergrund, Symbole, Fenster, Taskleiste, Startmenü,
 * Kontextmenüs und Benachrichtigungen. Auf schmalen Bildschirmen läuft es als Handy-Oberfläche
 * (Apps im Vollbild, App-Umschalter im Dock, Wischen wechselt die App).
 */
export class MogelOS implements OsApi {
  readonly env: OsEnv;
  private readonly scene: Phaser.Scene;
  private readonly s: Services;
  private readonly focus: FocusManager;
  private readonly base: HostBase;
  private readonly wallpaper: Phaser.GameObjects.Image;
  private wallpaperKey: string | null = null;
  private readonly bgZone: Phaser.GameObjects.Zone;
  private readonly iconLayer: Phaser.GameObjects.Container;
  private readonly icons: DesktopIcon[] = [];
  private readonly taskbar: Taskbar;
  private readonly toasts: Toasts;
  private readonly popup: CallPopup;
  private windows: WinEntry[] = [];
  private startMenu: PopupMenu | null = null;
  private ctxMenu: PopupMenu | null = null;
  private vp: ViewportState;
  private unit = 2;
  private isCompact = false;
  private area: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private selectedIcon: DesktopIcon | null = null;
  private cascade = 0;
  private swipe: { x: number; y: number; time: number } | null = null;
  /** Fenster in Öffnungsreihenfolge (Taskleiste, App-Umschalter). */
  private openOrder: string[] = [];
  private readonly nav: Record<NavDir, NavRepeat>;
  private readonly offs: (() => void)[] = [];

  constructor(private readonly o: MogelOSOptions) {
    this.scene = o.scene;
    this.s = o.s;
    this.vp = o.s.viewport.state;
    ensureTextures(this.scene);
    this.focus = new FocusManager(this.scene, DEPTH.focus);
    this.base = {
      scene: this.scene,
      s: this.s,
      focus: this.focus,
      theme: () => this.theme,
      u: () => this.unit,
      dpr: () => this.vp.dpr,
    };
    this.env = {
      vfs: o.vfs,
      day: () => o.shift().day,
      setWallpaper: (id) => this.setWallpaper(id),
      setTheme: (id) => this.setTheme(id),
      desk: o.desk,
      phone: o.phone,
      notes: o.notes,
      ledger: o.ledger,
      plauder: o.plauder,
    };
    this.unit = pixelScale(this.vp, TUNING.display.uiArtScale);
    const nr = (): NavRepeat => new NavRepeat(TUNING.input.navRepeatDelay, TUNING.input.navRepeatInterval);
    this.nav = { up: nr(), down: nr(), left: nr(), right: nr() };

    this.wallpaper = this.scene.add.image(0, 0, '__DEFAULT').setOrigin(0, 0).setDepth(DEPTH.wallpaper);
    this.bgZone = this.scene.add.zone(0, 0, 1, 1).setOrigin(0, 0).setDepth(DEPTH.background).setInteractive();
    attachPress(
      this.scene,
      this.bgZone,
      {
        onTap: () => this.selectIcon(null),
        onContext: (p) => this.desktopContext(p.x, p.y),
      },
      () => 8 * this.vp.dpr,
    );
    this.iconLayer = this.scene.add.container(0, 0).setDepth(DEPTH.icons);
    const iconHost = rootHost(this.base, this.iconLayer, 'desktop');
    for (const def of APPS.filter((a) => a.onDesktop)) {
      this.icons.push(
        new DesktopIcon(iconHost, {
          id: def.id,
          texture: this.iconTexture(def),
          label: t(def.shortKey),
          onOpen: () => this.open(def.id),
          onSelect: (ic) => this.selectIcon(ic),
          onContext: (x, y) => this.iconContext(def, x, y),
        }),
      );
    }
    this.taskbar = new Taskbar(this.base, DEPTH.taskbar, {
      onStart: () => (this.isCompact ? this.goHome() : this.toggleStart()),
      onWindow: (id) => this.taskbarClick(id),
      onLeave: () => o.onLeave(),
      onPause: () => o.onPause(),
    });
    this.toasts = new Toasts(this.base, DEPTH.toasts);
    this.popup = new CallPopup(this.base, DEPTH.call, { onAnswer: () => this.answerCall(), onDecline: () => this.declineCall() });
    // Beute aus Gesprächen an diesem Platz landet im Notizblock – kurz Bescheid geben, wohin damit.
    this.offs.push(
      o.phone.on((e) => {
        if (e.type !== 'capture' || e.desk !== o.desk) return;
        const { loot } = e.capture;
        if (loot.kind !== 'nummer' && loot.kind !== 'code' && loot.kind !== 'gutschein' && loot.kind !== 'geld') return;
        const scheme = schemeById(loot.schemeId ?? DEFAULT_SCHEME_FOR[loot.kind] ?? '');
        const target = scheme ? lootTarget(scheme.input, scheme.id) : null;
        this.s.sfx.note();
        this.toast({
          icon: 'notes',
          title: t('os.notes.toastTitle'),
          body:
            scheme && target
              ? t('os.loot.captured', { demand: t(`calls.demands.${loot.kind}`), value: loot.heard, app: lootTargetName(scheme.input, scheme.id) })
              : t('os.notes.captured', { demand: t(`calls.demands.${loot.kind}`), value: loot.heard }),
          onClick: () => (target ? this.open(target.app, target.args) : this.open('notes')),
        });
      }),
    );
    // Auszahlung (SCH-19): Kasse klingelt.
    this.offs.push(
      o.ledger.onPaid((item) => {
        if (item.desk !== o.desk || item.amount <= 0) return;
        this.s.sfx.cash();
        this.toast({
          icon: 'coin',
          title: t('os.loot.toastTitle', { amount: i18n.formatMoney(item.amount) }),
          body: t('os.loot.toastBody', { scheme: t(`schemes.${item.schemeId}.name`), name: t(`callers.${item.callerId}.short`) }),
        });
      }),
    );

    // Wischen zwischen Apps (Handy-Modus) und Ende von Schieberegler-Gesten.
    const onDown = (p: Phaser.Input.Pointer): void => {
      this.swipe = { x: p.x, y: p.y, time: p.downTime };
    };
    const onUp = (p: Phaser.Input.Pointer): void => {
      const sw = this.swipe;
      this.swipe = null;
      const locked = gesture.locked;
      gesture.locked = false;
      if (!sw || locked || !this.isCompact || this.overlayOpen) return;
      const dx = p.x - sw.x;
      const dy = p.y - sw.y;
      const dt = (p.upTime - sw.time) / 1000;
      if (Math.abs(dx) >= TUNING.os.swipeMinDistance * this.vp.dpr && Math.abs(dx) > 2 * Math.abs(dy) && dt <= TUNING.os.swipeMaxSeconds) {
        this.cycle(dx < 0 ? 1 : -1);
      }
    };
    this.scene.input.on(Phaser.Input.Events.POINTER_DOWN, onDown);
    this.scene.input.on(Phaser.Input.Events.POINTER_UP, onUp);
    this.offs.push(() => {
      this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, onDown);
      this.scene.input.off(Phaser.Input.Events.POINTER_UP, onUp);
    });
    this.offs.push(o.vfs.onChange(() => this.syncTrashIcon()));
    this.syncTrashIcon();
  }

  // ------------------------------------------------------------------ OsApi

  get compact(): boolean {
    return this.isCompact;
  }

  get theme(): OsTheme {
    return OS_THEMES[this.s.settings.get().osTheme];
  }

  open(appId: string, args?: unknown): void {
    const def = appById(appId);
    if (!def) return;
    this.closeOverlays();
    const id = def.windowId ? def.windowId(args) : def.id;
    const existing = this.windows.find((w) => w.win.id === id);
    if (existing) {
      this.restore(existing);
      return;
    }
    this.s.sfx.confirm();
    const win = new OsWindow({
      id,
      title: def.title ? def.title(args) : t(def.titleKey),
      icon: this.iconTexture(def),
      scene: this.scene,
      s: this.s,
      focus: this.focus,
      theme: () => this.theme,
      u: () => this.unit,
      dpr: () => this.vp.dpr,
      onClose: (w) => this.close(w),
      onFocusRequest: (w) => {
        const e = this.entryOf(w);
        if (e) this.activate(e, false);
      },
      onMinimize: (w) => {
        const e = this.entryOf(w);
        if (e) this.minimize(e);
      },
      draggable: () => !this.isCompact,
      titleBarHeight: () => this.titleBarHeight(),
    });
    const entry: WinEntry = { win, def, args, view: null as unknown as AppView };
    entry.view = def.create({ os: this, host: win.host, win, args });
    this.windows.push(entry);
    this.placeWindow(entry, true);
    this.activate(entry, true);
  }

  close(win: OsWindow): void {
    const i = this.windows.findIndex((e) => e.win === win);
    if (i < 0) return;
    const [e] = this.windows.splice(i, 1);
    e!.view.destroy();
    e!.win.destroy();
    this.s.sfx.back();
    this.activateTop();
  }

  toast(opts: ToastOptions): void {
    this.toasts.push(opts);
    haptic(this.s.settings.get().vibration, 20);
  }

  contextMenu(x: number, y: number, items: ContextItem[]): void {
    this.closeOverlays();
    if (items.length === 0) return;
    haptic(this.s.settings.get().vibration, 15);
    this.s.sfx.move();
    const menu = new PopupMenu(this.base, {
      scope: 'ctx',
      depth: DEPTH.ctx,
      entries: items.map((i) => ({ id: i.id, label: i.label, onSelect: i.onSelect })),
      onClose: () => {
        if (this.ctxMenu === menu) this.ctxMenu = null;
      },
    });
    menu.place(x, y, 'top-left', this.screenRect());
    this.ctxMenu = menu;
    if (this.ringVisible && menu.firstId) this.focus.focus(menu.firstId);
  }

  // ------------------------------------------------------------------ Ablauf

  get overlayOpen(): boolean {
    return this.startMenu !== null || this.ctxMenu !== null;
  }

  /** Klingelnden Anruf am eigenen Platz annehmen (Popup, E/A, Wischen) und das Telefon zeigen. */
  answerCall(): void {
    if (!this.o.phone.answer(this.o.desk)) return;
    this.s.sfx.pickUp();
    haptic(this.s.settings.get().vibration, 30);
    this.popup.hide();
    this.open('phone');
  }

  private declineCall(): void {
    this.o.phone.decline(this.o.desk);
    this.s.sfx.hangUp();
    this.popup.hide();
  }

  /** Popup ein-/ausblenden je nach Klingeln am eigenen Platz. */
  private syncPopup(dt: number): void {
    const v = this.o.phone.calls.view(this.o.desk);
    if (v.kind === 'ringing') {
      const def = callerById(v.callerId);
      if (def && this.popup.shownCallId !== v.callId) {
        this.popup.show(def, v.callId);
        haptic(this.s.settings.get().vibration, 60);
        if (this.ringVisible && !this.overlayOpen) this.focus.focus('call:answer');
      }
      this.popup.update(dt, v.left / TUNING.calls.ringSeconds);
    } else this.popup.hide();
  }

  /** Freunde in der Plauderbude melden sich, solange man am PC sitzt (APP-05). */
  private tickPlauder(dt: number): void {
    const p = this.o.plauder;
    const chat = p.tick(dt);
    if (!chat || p.muted || this.activeEntry()?.def.id === 'plauder') return;
    const msg = chat.messages[chat.messages.length - 1];
    this.s.sfx.notify();
    this.toast({ icon: 'plauder', title: t('os.plauder.newMessage', { name: chatName(chat.handle) }), body: msg?.text ?? '', onClick: () => this.open('plauder') });
  }

  private get ringVisible(): boolean {
    const k = this.s.device.kind;
    return k === 'keyboard' || k === 'gamepad';
  }

  layout(vp: ViewportState): void {
    this.vp = vp;
    this.unit = pixelScale(vp, TUNING.display.uiArtScale);
    const u = this.unit;
    const cssW = vp.width / vp.dpr;
    const cssH = vp.height / vp.dpr;
    const wasCompact = this.isCompact;
    this.isCompact = cssW < TUNING.os.compactMaxWidth || cssH < TUNING.os.compactMaxHeight;
    this.focus.setUnit(u);
    this.closeOverlays();
    const touch = this.s.device.hintMode === 'touch';
    const safe = safeRect(vp, 0);
    const barCss = touch || this.isCompact ? TUNING.os.taskbarHeightTouch : TUNING.os.taskbarHeight;
    this.taskbar.layout({
      vpW: vp.width,
      vpH: vp.height,
      safe,
      compact: this.isCompact,
      barH: Math.round(barCss * vp.dpr),
      statusH: Math.round(TUNING.os.statusBarHeight * vp.dpr),
    });
    const occ = this.taskbar.occupied;
    this.area = {
      x: safe.x,
      y: Math.max(safe.y, occ.top),
      w: safe.width,
      h: vp.height - occ.bottom - Math.max(safe.y, occ.top),
    };
    this.renderWallpaper();
    this.bgZone.setPosition(this.area.x, this.area.y).setSize(this.area.w, this.area.h);
    this.bgZone.input?.hitArea.setTo(0, 0, this.area.w, this.area.h);
    this.layoutIcons();
    for (const e of this.windows) this.placeWindow(e, wasCompact !== this.isCompact);
    const margin = 4 * u;
    // Unten rechts (Handy: über dem Dock), damit sie keine Desktop-Symbole verdecken.
    this.toasts.layout({ x: this.area.x + margin, y: this.area.y + margin, w: this.area.w - 2 * margin, h: this.area.h - 2 * margin }, 'bottom');
    this.popup.layout(this.area);
    this.syncTaskbar();
  }

  /** Pro Frame (nur wenn nicht pausiert und kein Übergang läuft). */
  update(dt: number, acceptInput: boolean): void {
    this.syncPopup(dt);
    this.tickPlauder(dt);
    if (acceptInput) this.handleInput(dt);
    for (const e of this.windows) e.view.update?.(dt);
    this.taskbar.update(this.o.shift(), dt);
    this.toasts.update(dt);
    this.updateScopes();
    this.focus.setRingVisible(this.ringVisible);
    this.focus.draw();
  }

  /** Zustand für Tests (CSS-Pixel); `ready` = nimmt gerade Eingaben an. */
  snapshot(ready: boolean): unknown {
    const d = this.vp.dpr;
    const css = (r: Rect): Rect => ({ x: r.x / d, y: r.y / d, w: r.w / d, h: r.h / d });
    const active = this.activeEntry();
    const st = this.s.settings.get();
    return {
      ready,
      compact: this.isCompact,
      wallpaper: st.osWallpaper,
      theme: st.osTheme,
      ring: this.ringVisible,
      focus: this.focus.focusedId,
      start: this.startMenu !== null,
      ctx: this.ctxMenu !== null,
      area: css(this.area),
      windows: this.windows.map((e) => ({
        id: e.win.id,
        app: e.def.id,
        title: e.win.titleText,
        active: e === active,
        minimized: e.win.minimized,
        rect: css(e.win.bounds),
        titleRect: css(e.win.titleRect()),
        state: e.view.state?.() ?? null,
      })),
      toasts: this.toasts.snapshot(),
      popup: this.popup.snapshot(),
      toastRects: this.toasts.rects().map(css),
      taskbar: this.taskbar.statusTexts(),
      taskbarRects: Object.fromEntries(Object.entries(this.taskbar.rects()).map(([k, r]) => [k, css(r)])),
      icons: this.icons.map((ic) => ({ id: ic.id, selected: ic === this.selectedIcon, rect: css(ic.screenRect()) })),
      targets: this.focus.all().map((f) => ({ id: f.id, scope: f.scope, ...css(f.rect) })),
    };
  }

  destroy(): void {
    for (const off of this.offs) off();
    this.closeOverlays();
    for (const e of this.windows) {
      e.view.destroy();
      e.win.destroy();
    }
    this.windows = [];
    for (const ic of this.icons) ic.destroy();
    this.taskbar.destroy();
    this.toasts.destroy();
    this.popup.destroy();
  }

  // ------------------------------------------------------------------ Eingabe

  private handleInput(dt: number): void {
    const inp = this.s.input;
    const typed = inp.typed();
    let enterUsed = false;
    const top = this.activeEntry();
    if (!this.overlayOpen && top?.view.onTyped && typed.length > 0) enterUsed = top.view.onTyped(typed) && typed.includes('Enter');

    // Klingeln: E/A nimmt an, Entf/LT lehnt ab – egal, wo der Fokus gerade ist.
    if (this.popup.visible && !this.overlayOpen) {
      if (inp.justPressed('interact')) {
        this.answerCall();
        return;
      }
      if (inp.justPressed('hangup')) {
        this.declineCall();
        return;
      }
    }
    if (this.overlayOpen) {
      if (inp.justPressed('uiBack') || inp.justPressed('pause') || inp.justPressed('leave')) this.closeOverlays();
    } else if (inp.justPressed('pause')) {
      this.o.onPause();
      return;
    } else if (inp.justPressed('leave')) {
      this.o.onLeave();
      return;
    }

    const actions: Record<NavDir, 'uiUp' | 'uiDown' | 'uiLeft' | 'uiRight'> = { up: 'uiUp', down: 'uiDown', left: 'uiLeft', right: 'uiRight' };
    for (const dir of ['up', 'down', 'left', 'right'] as const) {
      const a = actions[dir];
      if (this.nav[dir].update(dt, inp.isDown(a), inp.justPressed(a))) {
        if (this.focus.focusedId === null || this.focus.currentScope === null) this.focusDefault();
        else if (this.focus.move(dir)) this.s.sfx.move();
      }
    }
    if (inp.justPressed('uiConfirm') && !enterUsed) {
      if (!this.focus.activate()) this.focusDefault();
    }
    if (inp.justPressed('emote')) this.focus.context();
    if (inp.justPressed('nextApp')) this.cycle(1);
    if (inp.justPressed('prevApp')) this.cycle(-1);
  }

  /** Welche Bereiche sind für Tastatur/Gamepad erreichbar? */
  private updateScopes(): void {
    const active = this.activeEntry();
    if (this.ctxMenu) this.focus.restrict((sc) => sc === 'ctx');
    else if (this.startMenu) this.focus.restrict((sc) => sc === 'start');
    else if (active) {
      const scope = `win:${active.win.id}`;
      this.focus.restrict((sc) => sc === scope || sc === 'taskbar' || sc === 'call');
    } else this.focus.restrict((sc) => sc === 'desktop' || sc === 'taskbar' || sc === 'call');
  }

  private focusDefault(): void {
    this.updateScopes();
    const active = this.activeEntry();
    if (this.ctxMenu || this.startMenu) {
      this.focus.focusScope(this.ctxMenu ? 'ctx' : 'start');
      return;
    }
    if (active) {
      const first = active.view.firstFocus?.();
      if (!(first && this.focus.focus(first))) this.focus.focusScope(`win:${active.win.id}`);
      return;
    }
    if (!this.focus.focusScope('desktop')) this.focus.focusScope('taskbar');
  }

  // ------------------------------------------------------------------ Fenster

  private entryOf(win: OsWindow): WinEntry | undefined {
    return this.windows.find((e) => e.win === win);
  }

  private activeEntry(): WinEntry | null {
    for (let i = this.windows.length - 1; i >= 0; i--) {
      const e = this.windows[i]!;
      if (!e.win.minimized) return e.win.active ? e : null;
    }
    return null;
  }

  private activate(e: WinEntry, moveFocus: boolean): void {
    const i = this.windows.indexOf(e);
    if (i < 0) return;
    this.windows.splice(i, 1);
    this.windows.push(e);
    e.win.minimized = false;
    e.win.setVisible(true);
    this.windows.forEach((w, j) => {
      w.win.setDepth(DEPTH.windows + j);
      w.win.setActive(w === e);
    });
    this.selectIcon(null);
    this.syncTaskbar();
    if (moveFocus && this.ringVisible) {
      this.updateScopes();
      const first = e.view.firstFocus?.();
      if (!(first && this.focus.focus(first))) this.focus.focusScope(`win:${e.win.id}`);
    }
  }

  private activateTop(): void {
    for (let i = this.windows.length - 1; i >= 0; i--) {
      const e = this.windows[i]!;
      if (!e.win.minimized) {
        this.activate(e, true);
        return;
      }
    }
    for (const w of this.windows) w.win.setActive(false);
    this.syncTaskbar();
  }

  private minimize(e: WinEntry): void {
    e.win.minimized = true;
    e.win.setActive(false);
    e.win.setVisible(false);
    this.s.sfx.move();
    this.activateTop();
  }

  private restore(e: WinEntry): void {
    this.activate(e, true);
  }

  private taskbarClick(id: string): void {
    const e = this.windows.find((w) => w.win.id === id);
    if (!e) return;
    this.closeOverlays();
    if (e.win.minimized) this.restore(e);
    else if (e === this.activeEntry() && !this.isCompact) this.minimize(e);
    else this.activate(e, true);
  }

  /** Nächstes/vorheriges Fenster (LB/RB, Bild↑/↓, Wischen). */
  private cycle(dir: 1 | -1): void {
    if (this.windows.length === 0) return;
    const active = this.activeEntry();
    // Reihenfolge wie in der Taskleiste (Öffnungsreihenfolge).
    const order = this.taskbarOrder();
    const idx = active ? order.indexOf(active) : dir === 1 ? -1 : 0;
    const next = order[(idx + dir + order.length) % order.length];
    if (next && next !== active) {
      this.s.sfx.move();
      this.activate(next, true);
    }
  }

  private goHome(): void {
    this.closeOverlays();
    for (const e of this.windows) {
      e.win.minimized = true;
      e.win.setActive(false);
      e.win.setVisible(false);
    }
    this.s.sfx.move();
    this.syncTaskbar();
  }

  private taskbarOrder(): WinEntry[] {
    for (const e of this.windows) if (!this.openOrder.includes(e.win.id)) this.openOrder.push(e.win.id);
    this.openOrder = this.openOrder.filter((id) => this.windows.some((e) => e.win.id === id));
    return this.openOrder.map((id) => this.windows.find((e) => e.win.id === id)!);
  }

  private syncTaskbar(): void {
    const active = this.activeEntry();
    this.taskbar.setWindows(
      this.taskbarOrder().map((e) => ({ id: e.win.id, title: e.win.titleText, icon: this.iconTexture(e.def), active: e === active, minimized: e.win.minimized })),
    );
  }

  private titleBarHeight(): number {
    const touch = this.s.device.hintMode === 'touch' || this.isCompact;
    return Math.max(12 * this.unit, Math.round((touch ? TUNING.os.titleBarHeightTouch : TUNING.os.titleBarHeight) * this.vp.dpr));
  }

  private placeWindow(e: WinEntry, fresh: boolean): void {
    const u = this.unit;
    const a = this.area;
    let r: Rect;
    if (this.isCompact) {
      r = { ...a };
    } else {
      const w = Math.min(e.def.size.w * u + 4 * u, a.w - 8 * u);
      const h = Math.min(e.def.size.h * u + this.titleBarHeight() + 4 * u, a.h - 8 * u);
      if (fresh) {
        const x0 = a.x + Math.min(70 * u, a.w * 0.12) + this.cascade * 14 * u;
        const y0 = a.y + 8 * u + this.cascade * 12 * u;
        this.cascade = (this.cascade + 1) % 6;
        r = { x: x0, y: y0, w, h };
      } else r = { ...e.win.bounds, w, h };
      r.x = Phaser.Math.Clamp(r.x, a.x, Math.max(a.x, a.x + a.w - r.w));
      r.y = Phaser.Math.Clamp(r.y, a.y, Math.max(a.y, a.y + a.h - r.h));
    }
    e.win.setBounds(r);
    const c = e.win.contentRect();
    e.view.layout(c.w, c.h);
  }

  // ------------------------------------------------------------------ Desktop

  private layoutIcons(): void {
    const u = this.unit;
    const a = this.area;
    const compact = this.isCompact;
    let iconScale = compact ? Math.max(u, Math.round(u * 1.6)) : u;
    const pad = 4 * u;
    let cellH = 16 * iconScale + 30 * u;
    // Zellen so breit wie die längste Beschriftung (ein Wort bricht nicht um).
    const widest = Math.max(0, ...this.icons.map((ic) => ic.labelWidth(u))) + 6 * u;
    if (compact) {
      // Startbildschirm: alle Symbole ohne Scrollen – notfalls kleinere Symbole und engere Zeilen.
      const n = this.icons.length;
      let cols = 3;
      for (let s = iconScale; s >= 1; s--) {
        const minCell = Math.max(16 * s + 16 * u, widest);
        cols = Math.max(3, Math.floor((a.w - 2 * pad) / minCell));
        const rows = Math.ceil(n / cols);
        iconScale = s;
        cellH = Math.min(16 * s + 30 * u, Math.floor((a.h - 2 * pad) / rows));
        if (cellH >= 16 * s + 15 * u) break;
      }
      const cellW = (a.w - 2 * pad) / cols;
      this.icons.forEach((ic, i) => ic.layout(a.x + pad + (i % cols) * cellW, a.y + pad + Math.floor(i / cols) * cellH, cellW, cellH, iconScale));
    } else {
      const cellW = Math.max(50 * u, widest);
      const rows = Math.max(1, Math.floor((a.h - 2 * pad) / cellH));
      this.icons.forEach((ic, i) => ic.layout(a.x + pad + Math.floor(i / rows) * cellW, a.y + pad + (i % rows) * cellH, cellW, cellH, iconScale));
    }
  }

  private selectIcon(ic: DesktopIcon | null): void {
    if (this.selectedIcon === ic) return;
    this.selectedIcon?.setSelected(false);
    this.selectedIcon = ic;
    ic?.setSelected(true);
  }

  private iconTexture(def: AppDef): string {
    if (def.id === 'trash') return this.o.vfs.trash().length > 0 ? 'os-icon-trashFull' : 'os-icon-trash';
    return `os-icon-${def.icon}`;
  }

  private syncTrashIcon(): void {
    const ic = this.icons.find((i) => i.id === 'trash');
    const def = appById('trash');
    if (ic && def) ic.setTexture(this.iconTexture(def));
  }

  private renderWallpaper(): void {
    const u = this.unit;
    const w = Math.ceil(this.vp.width / u);
    const h = Math.ceil(this.vp.height / u);
    const kind = this.s.settings.get().osWallpaper;
    const key = `os-wallpaper-${kind}-${w}x${h}`;
    if (key !== this.wallpaperKey) {
      gridTexture(this.scene, key, () => buildWallpaper(kind, w, h));
      this.wallpaper.setTexture(key);
      const old = this.wallpaperKey;
      this.wallpaperKey = key;
      if (old && this.scene.textures.exists(old)) this.scene.textures.remove(old);
    }
    this.wallpaper.setScale(u).setPosition(0, 0);
  }

  private setWallpaper(id: Wallpaper): void {
    this.s.settings.update({ osWallpaper: id });
    this.renderWallpaper();
  }

  private setTheme(id: OsThemeId): void {
    this.s.settings.update({ osTheme: id });
    for (const e of this.windows) {
      e.win.redraw();
      const c = e.win.contentRect();
      e.view.layout(c.w, c.h);
    }
    this.taskbar.redraw();
    this.toasts.redraw();
    this.popup.redraw();
    this.icons.forEach((ic) => ic.setSelected(ic === this.selectedIcon));
  }

  private desktopContext(x: number, y: number): void {
    const st = this.s.settings.get();
    const nextWp = WALLPAPERS[(WALLPAPERS.indexOf(st.osWallpaper) + 1) % WALLPAPERS.length]!;
    const nextTheme = OS_THEME_IDS[(OS_THEME_IDS.indexOf(st.osTheme) + 1) % OS_THEME_IDS.length]!;
    this.contextMenu(x, y, [
      { id: 'wallpaper', label: t('os.ctx.nextWallpaper'), onSelect: () => this.setWallpaper(nextWp) },
      { id: 'theme', label: t('os.ctx.nextTheme'), onSelect: () => this.setTheme(nextTheme) },
      { id: 'settings', label: t('os.ctx.settings'), onSelect: () => this.open('settings') },
    ]);
  }

  private iconContext(def: AppDef, x: number, y: number): void {
    const items: ContextItem[] = [{ id: 'open', label: t('os.ctx.open'), onSelect: () => this.open(def.id) }];
    if (def.id === 'trash' && this.o.vfs.trash().length > 0) items.push({ id: 'emptyTrash', label: t('os.trash.emptyAction'), onSelect: () => emptyTrash(this, this.s) });
    this.contextMenu(x, y, items);
  }

  // ------------------------------------------------------------------ Startmenü

  private toggleStart(): void {
    if (this.startMenu) {
      this.closeOverlays();
      return;
    }
    this.closeOverlays();
    this.s.sfx.confirm();
    const entries: PopupEntry[] = APPS.filter((a) => a.inStartMenu).map((a) => ({ id: a.id, label: t(a.titleKey), icon: this.iconTexture(a), onSelect: () => this.open(a.id) }));
    entries.push({ id: 'leave', label: t('os.taskbar.leave'), icon: 'os-icon-standUp', onSelect: () => this.o.onLeave(), separator: true });
    const menu = new PopupMenu(this.base, {
      scope: 'start',
      depth: DEPTH.start,
      header: t('os.start.header'),
      entries,
      onClose: () => {
        if (this.startMenu === menu) this.startMenu = null;
      },
    });
    const u = this.unit;
    menu.place(this.area.x + 2 * u, this.area.y + this.area.h, 'bottom-left', this.screenRect(), 90 * u);
    this.startMenu = menu;
    if (this.ringVisible && menu.firstId) this.focus.focus(menu.firstId);
  }

  private closeOverlays(): void {
    const menus = [this.startMenu, this.ctxMenu];
    this.startMenu = null;
    this.ctxMenu = null;
    for (const m of menus) m?.close();
  }

  private screenRect(): Rect {
    const safe = safeRect(this.vp, 0);
    return { x: safe.x, y: safe.y, w: safe.width, h: safe.height };
  }
}

import { OS_THEME_IDS, WALLPAPERS } from '../../../data/os/appearance';
import { t } from '../../../i18n';
import { PixelLabel } from '../../PixelLabel';
import { controlHeight, OsButton, OsSlider, OsTabs, OsTextView, OsToggle } from '../widgets';
import type { AppContext, AppDef, AppView } from './types';

/**
 * Systemsteuerung (APP-54, OS-13): Hintergrund und Farbschema, Lautstärken, Vibration, Info.
 * Weitere Spiel-Einstellungen (Tastenbelegung, Komfort-Optionen) kommen mit M11 hinzu.
 */
class SettingsView implements AppView {
  private readonly tabs: OsTabs;
  private readonly wpLabel: PixelLabel;
  private readonly wpButtons: OsButton[];
  private readonly themeLabel: PixelLabel;
  private readonly themeButtons: OsButton[];
  private readonly masterLabel: PixelLabel;
  private readonly master: OsSlider;
  private readonly uiLabel: PixelLabel;
  private readonly ui: OsSlider;
  private readonly vibration: OsToggle;
  private readonly info: OsTextView;
  private size = { w: 0, h: 0 };

  constructor(private readonly ctx: AppContext) {
    const { host, os } = ctx;
    const id = ctx.win.id;
    const st = host.s.settings;
    const label = (key: string) => new PixelLabel(host.scene, t(key), { scale: host.u(), color: 'white', shadow: null, originY: 0.5, container: host.container });
    this.tabs = new OsTabs(host, `${id}:tab`, [t('os.settings.tabs.look'), t('os.settings.tabs.sound'), t('os.settings.tabs.info')]);
    this.tabs.onChange = () => this.relayout();
    this.wpLabel = label('os.settings.wallpaper');
    this.wpButtons = WALLPAPERS.map(
      (wp) =>
        new OsButton(host, `${id}:wp:${wp}`, {
          icon: `os-wp-thumb-${wp}`,
          label: t(`os.settings.wallpapers.${wp}`),
          align: 'left',
          onClick: () => {
            os.env.setWallpaper(wp);
            this.syncActive();
          },
        }),
    );
    this.themeLabel = label('os.settings.theme');
    this.themeButtons = OS_THEME_IDS.map(
      (th) =>
        new OsButton(host, `${id}:theme:${th}`, {
          label: t(`os.settings.themes.${th}`),
          onClick: () => {
            os.env.setTheme(th);
            this.syncActive();
          },
        }),
    );
    this.masterLabel = label('os.settings.master');
    this.master = new OsSlider(host, `${id}:master`, st.get().masterVolume);
    this.master.onChange = (v) => {
      st.update({ masterVolume: v });
      this.syncLabels();
    };
    this.uiLabel = label('os.settings.ui');
    this.ui = new OsSlider(host, `${id}:ui`, st.get().uiVolume);
    this.ui.onChange = (v) => {
      st.update({ uiVolume: v });
      this.syncLabels();
      host.s.sfx.move();
    };
    this.vibration = new OsToggle(host, `${id}:vibration`, t('os.settings.vibration'), st.get().vibration);
    this.vibration.onChange = (v) => st.update({ vibration: v });
    this.info = new OsTextView(host, `${id}:info`, t('os.settings.infoText', { version: __APP_VERSION__ }));
    this.syncActive();
    this.syncLabels();
  }

  layout(w: number, h: number): void {
    this.size = { w, h };
    this.relayout();
  }

  firstFocus(): string | undefined {
    return `${this.ctx.win.id}:tab:0`;
  }

  state(): unknown {
    const st = this.ctx.host.s.settings.get();
    return { tab: this.tabs.index, wallpaper: st.osWallpaper, theme: st.osTheme, master: st.masterVolume, ui: st.uiVolume, vibration: st.vibration };
  }

  destroy(): void {
    this.tabs.destroy();
    for (const b of [...this.wpButtons, ...this.themeButtons]) b.destroy();
    for (const l of [this.wpLabel, this.themeLabel, this.masterLabel, this.uiLabel]) l.destroy();
    this.master.destroy();
    this.ui.destroy();
    this.vibration.destroy();
    this.info.destroy();
  }

  private relayout(): void {
    const { w, h } = this.size;
    if (w <= 0) return;
    const host = this.ctx.host;
    const u = host.u();
    const ch = controlHeight(host);
    const gap = 3 * u;
    const page = this.tabs.index;
    this.tabs.layout(0, 0, w, ch, 2 * u);
    let y = ch + 2 * gap;

    // Seite 1: Darstellung.
    const look = page === 0;
    for (const l of [this.wpLabel, this.themeLabel]) l.setVisible(look).setScale(u);
    for (const b of [...this.wpButtons, ...this.themeButtons]) b.setVisible(look);
    if (look) {
      this.wpLabel.setPosition(0, Math.round(y + this.wpLabel.height / 2));
      y += this.wpLabel.height + gap;
      const iconScale = Math.max(1, Math.round(u / 2));
      for (const b of this.wpButtons) b.setIconScale(iconScale);
      const perRow = w >= 4 * 70 * u ? 4 : 2;
      const bw = (w - 2 * u * (perRow - 1)) / perRow;
      const bh = Math.max(ch, 20 * iconScale + 4 * u);
      this.wpButtons.forEach((b, i) => b.layout((i % perRow) * (bw + 2 * u), y + Math.floor(i / perRow) * (bh + 2 * u), bw, bh));
      y += Math.ceil(this.wpButtons.length / perRow) * (bh + 2 * u) + gap;
      this.themeLabel.setPosition(0, Math.round(y + this.themeLabel.height / 2));
      y += this.themeLabel.height + gap;
      const tw = (w - 2 * u * (this.themeButtons.length - 1)) / this.themeButtons.length;
      this.themeButtons.forEach((b, i) => b.layout(i * (tw + 2 * u), y, tw, ch));
    }

    // Seite 2: Ton & Vibration.
    const sound = page === 1;
    for (const l of [this.masterLabel, this.uiLabel]) l.setVisible(sound).setScale(u);
    this.master.setVisible(sound);
    this.ui.setVisible(sound);
    this.vibration.setVisible(sound);
    if (sound) {
      y = ch + 2 * gap;
      for (const [lab, slider] of [
        [this.masterLabel, this.master],
        [this.uiLabel, this.ui],
      ] as const) {
        lab.setPosition(0, Math.round(y + lab.height / 2));
        y += lab.height + gap;
        slider.layout(2 * u, y, w - 4 * u, ch);
        y += ch + gap;
      }
      this.vibration.layout(0, y, w, ch);
    }

    // Seite 3: Info.
    const info = page === 2;
    this.info.setVisible(info);
    if (info) this.info.layout(0, ch + gap, w, h - ch - gap);
    this.syncLabels();
  }

  private syncActive(): void {
    const st = this.ctx.host.s.settings.get();
    this.wpButtons.forEach((b, i) => b.setActive(WALLPAPERS[i] === st.osWallpaper));
    this.themeButtons.forEach((b, i) => b.setActive(OS_THEME_IDS[i] === st.osTheme));
  }

  private syncLabels(): void {
    const st = this.ctx.host.s.settings.get();
    const th = this.ctx.host.theme();
    this.masterLabel.setText(t('os.settings.masterValue', { value: Math.round(st.masterVolume * 100) })).setColor(th.text);
    this.uiLabel.setText(t('os.settings.uiValue', { value: Math.round(st.uiVolume * 100) })).setColor(th.text);
    this.wpLabel.setColor(th.text);
    this.themeLabel.setColor(th.text);
  }
}

export const settingsApp: AppDef = {
  id: 'settings',
  icon: 'settings',
  titleKey: 'os.apps.settings.title',
  shortKey: 'os.apps.settings.short',
  size: { w: 220, h: 170 },
  onDesktop: true,
  inStartMenu: true,
  create: (ctx) => new SettingsView(ctx),
};

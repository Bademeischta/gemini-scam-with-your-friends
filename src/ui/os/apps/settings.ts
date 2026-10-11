import Phaser from 'phaser';
import { PALETTE } from '../../../config/palette';
import { OS_THEME_IDS, WALLPAPERS } from '../../../data/os/appearance';
import { t } from '../../../i18n';
import { MIC_MODES, VOICE_MODES } from '../../../systems/save/settings';
import { SpeechInput } from '../../../systems/voice/SpeechInput';
import { PixelLabel } from '../../PixelLabel';
import { BODY_FONT, controlHeight, OsButton, OsSlider, OsTabs, OsTextView, OsToggle } from '../widgets';
import type { AppContext, AppDef, AppView } from './types';

const PAGE = { look: 0, sound: 1, voice: 2, info: 3 } as const;

/**
 * Systemsteuerung (APP-54, OS-13, MEN-05): Hintergrund und Farbschema, Lautstärken, Vibration,
 * Sprache (Anruferstimmen, Stimmwahl, Spracheingabe, Mikrofon-Test), Info.
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
  private readonly voiceModes: OsButton[];
  private readonly voiceName: OsButton;
  private readonly voiceVolLabel: PixelLabel;
  private readonly voiceVol: OsSlider;
  private readonly voiceTest: OsButton;
  private readonly speechToggle: OsToggle;
  private readonly micModes: OsButton[];
  private readonly micTest: OsButton;
  private readonly voiceNote: Phaser.GameObjects.Text;
  private readonly micNote: Phaser.GameObjects.Text;
  private micText = '';
  private readonly info: OsTextView;
  private size = { w: 0, h: 0 };

  constructor(private readonly ctx: AppContext) {
    const { host, os } = ctx;
    const id = ctx.win.id;
    const st = host.s.settings;
    const label = (key: string) => new PixelLabel(host.scene, t(key), { scale: host.u(), color: 'white', shadow: null, originY: 0.5, container: host.container });
    this.tabs = new OsTabs(host, `${id}:tab`, [t('os.settings.tabs.look'), t('os.settings.tabs.sound'), t('os.settings.tabs.voice'), t('os.settings.tabs.info')]);
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
    this.voiceModes = VOICE_MODES.map(
      (m) =>
        new OsButton(host, `${id}:voice:${m}`, {
          label: t(`os.settings.voiceModes.${m}`),
          onClick: () => {
            st.update({ voiceMode: m });
            this.syncActive();
          },
        }),
    );
    this.voiceName = new OsButton(host, `${id}:voiceName`, { label: '', align: 'left', onClick: () => this.nextVoice() });
    this.voiceVolLabel = label('os.settings.voiceValue');
    this.voiceVol = new OsSlider(host, `${id}:voiceVol`, st.get().voiceVolume);
    this.voiceVol.onChange = (v) => {
      st.update({ voiceVolume: v });
      this.syncLabels();
    };
    this.voiceTest = new OsButton(host, `${id}:voiceTest`, { label: t('os.settings.voiceTest'), icon: 'os-icon-speakerOn', onClick: () => this.testVoice() });
    this.speechToggle = new OsToggle(host, `${id}:speech`, t('os.settings.speechInput'), st.get().speechInput);
    this.speechToggle.onChange = (v) => {
      st.update({ speechInput: v });
      this.syncActive();
    };
    this.micModes = MIC_MODES.map(
      (m) =>
        new OsButton(host, `${id}:mic:${m}`, {
          label: t(`os.settings.micModes.${m}`),
          onClick: () => {
            st.update({ micMode: m });
            this.syncActive();
          },
        }),
    );
    this.micTest = new OsButton(host, `${id}:micTest`, { label: t('os.settings.micTest'), icon: 'os-icon-mic', onClick: () => this.testMic() });
    const note = () => host.scene.add.text(0, 0, '', { fontFamily: BODY_FONT, color: PALETTE.fog, fontSize: '12px' });
    this.voiceNote = note();
    this.micNote = note();
    host.container.add([this.voiceNote, this.micNote]);
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
    return {
      tab: this.tabs.index,
      wallpaper: st.osWallpaper,
      theme: st.osTheme,
      master: st.masterVolume,
      ui: st.uiVolume,
      vibration: st.vibration,
      voiceMode: st.voiceMode,
      voiceName: st.voiceName,
      voiceVolume: st.voiceVolume,
      speechInput: st.speechInput,
      micMode: st.micMode,
      micText: this.micText,
    };
  }

  destroy(): void {
    this.tabs.destroy();
    this.ctx.host.s.speech.abort();
    for (const b of [...this.wpButtons, ...this.themeButtons, ...this.voiceModes, ...this.micModes, this.voiceName, this.voiceTest, this.micTest]) b.destroy();
    for (const l of [this.wpLabel, this.themeLabel, this.masterLabel, this.uiLabel, this.voiceVolLabel]) l.destroy();
    this.master.destroy();
    this.ui.destroy();
    this.voiceVol.destroy();
    this.vibration.destroy();
    this.speechToggle.destroy();
    this.voiceNote.destroy();
    this.micNote.destroy();
    this.info.destroy();
  }

  private nextVoice(): void {
    const s = this.ctx.host.s;
    const names = ['', ...s.voice.germanVoices().map((v) => v.name)];
    const i = names.indexOf(s.settings.get().voiceName);
    s.settings.update({ voiceName: names[(i + 1) % names.length] ?? '' });
    this.syncLabels();
  }

  private testVoice(): void {
    const s = this.ctx.host.s;
    const st = s.settings.get();
    if (st.voiceMode === 'tts' && s.voice.usable) {
      s.voice.cancel();
      s.voice.speak(t('os.settings.voiceSample'), { pitch: 1.1, rate: 0.95, babble: 260, female: true }, {
        index: 0,
        volume: s.audio.voiceLevel,
        preferred: st.voiceName,
        words: { currency: t('calls.voice.currency'), percent: t('calls.voice.percent') },
      });
    } else if (st.voiceMode !== 'off') {
      for (let i = 0; i < 8; i++) this.ctx.host.scene.time.delayedCall(i * 90, () => s.sfx.babble(260, (i * 3) % 7 / 6, 1));
    }
  }

  private testMic(): void {
    const s = this.ctx.host.s;
    if (!SpeechInput.supported(window)) return;
    if (s.speech.listening) {
      s.speech.stop();
      return;
    }
    this.micText = '';
    this.micNote.setText(t('os.settings.micTestListening'));
    const ok = s.speech.start('auto', {
      interim: (text) => this.micNote.setText(t('os.settings.micTestResult', { text })),
      final: (text) => {
        this.micText = text;
        this.micNote.setText(t('os.settings.micTestResult', { text }));
      },
      end: () => {
        if (!this.micText) this.micNote.setText(t('os.settings.micTestNothing'));
        this.micTest.setActive(false);
      },
    });
    this.micTest.setActive(ok);
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
    const look = page === PAGE.look;
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
    const sound = page === PAGE.sound;
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

    // Seite 3: Sprache.
    const voice = page === PAGE.voice;
    for (const b of [...this.voiceModes, ...this.micModes, this.voiceName, this.voiceTest, this.micTest]) b.setVisible(voice);
    this.voiceVolLabel.setVisible(voice).setScale(u);
    this.voiceVol.setVisible(voice);
    this.speechToggle.setVisible(voice);
    this.voiceNote.setVisible(voice);
    this.micNote.setVisible(voice);
    if (voice) {
      const top = ch + 2 * gap;
      this.syncLabels();
      // Zwei Spalten (Stimmen der Anrufer | eigene Stimme), wenn die Knöpfe nebeneinander passen; sonst eine.
      const need = (btns: OsButton[]): number => btns.reduce((a, b) => a + b.preferredWidth(), 0) + 2 * u * (btns.length - 1);
      const twoCol = (w - 2 * gap) / 2 >= Math.max(need(this.voiceModes), need(this.micModes));
      const colW = twoCol ? (w - 2 * gap) / 2 : w;
      const lw = this.voiceVolLabel.width + 3 * u;
      const inline = lw <= colW * 0.5;
      const leftRows = inline ? 4 : 5;
      const rows = twoCol ? leftRows : leftRows + 4;
      const rowH = Math.max(12 * u, Math.min(ch, Math.floor((h - top - rows * gap) / rows)));
      const rowAt = (i: number) => top + i * (rowH + gap);
      // Stimmen der Anrufer: Modus, Systemstimme, Lautstärke, Test.
      const mw = (colW - 2 * u * (this.voiceModes.length - 1)) / this.voiceModes.length;
      this.voiceModes.forEach((b, i) => b.layout(i * (mw + 2 * u), rowAt(0), mw, rowH));
      this.voiceName.layout(0, rowAt(1), colW, rowH);
      this.voiceVolLabel.setPosition(0, Math.round(rowAt(2) + rowH / 2));
      if (inline) this.voiceVol.layout(lw, rowAt(2), colW - lw, rowH);
      else this.voiceVol.layout(0, rowAt(3), colW, rowH);
      this.voiceTest.setIconScale(u).layout(0, rowAt(leftRows - 1), colW, rowH);
      // Eigene Stimme: Spracheingabe an/aus, Modus, Test, Ergebnis.
      const x2 = twoCol ? colW + 2 * gap : 0;
      const r0 = twoCol ? 0 : leftRows;
      this.speechToggle.layout(x2, rowAt(r0), colW, rowH);
      const mmw = (colW - 2 * u) / 2;
      this.micModes.forEach((b, i) => b.layout(x2 + i * (mmw + 2 * u), rowAt(r0 + 1), mmw, rowH));
      this.micTest.setIconScale(u).layout(x2, rowAt(r0 + 2), colW, rowH);
      const d = this.ctx.host.dpr();
      const noteStyle = { fontSize: `${Math.round(12 * d)}px`, color: PALETTE[this.ctx.host.theme().textDim], wordWrap: { width: colW, useAdvancedWrap: true } };
      this.micNote.setStyle(noteStyle).setPosition(x2, rowAt(r0 + 3));
      this.voiceNote.setStyle(noteStyle).setPosition(x2, rowAt(r0 + 3) + Math.round(this.micNote.height) + gap);
      this.syncActive();
    }

    // Seite 4: Info.
    const info = page === PAGE.info;
    this.info.setVisible(info);
    if (info) this.info.layout(0, ch + gap, w, h - ch - gap);
    this.syncLabels();
  }

  private syncActive(): void {
    const st = this.ctx.host.s.settings.get();
    this.wpButtons.forEach((b, i) => b.setActive(WALLPAPERS[i] === st.osWallpaper));
    this.themeButtons.forEach((b, i) => b.setActive(OS_THEME_IDS[i] === st.osTheme));
    this.voiceModes.forEach((b, i) => b.setActive(VOICE_MODES[i] === st.voiceMode));
    const sttOk = SpeechInput.supported(window);
    this.micModes.forEach((b, i) => b.setActive(MIC_MODES[i] === st.micMode).setEnabled(sttOk && st.speechInput));
    this.micTest.setEnabled(sttOk && st.speechInput);
    this.voiceName.setEnabled(st.voiceMode === 'tts');
    this.voiceTest.setEnabled(st.voiceMode !== 'off');
    if (!sttOk) this.micNote.setText(t('os.settings.micUnsupported'));
  }

  private syncLabels(): void {
    const st = this.ctx.host.s.settings.get();
    const th = this.ctx.host.theme();
    this.masterLabel.setText(t('os.settings.masterValue', { value: Math.round(st.masterVolume * 100) })).setColor(th.text);
    this.uiLabel.setText(t('os.settings.uiValue', { value: Math.round(st.uiVolume * 100) })).setColor(th.text);
    this.voiceVolLabel.setText(t('os.settings.voiceValue', { value: Math.round(st.voiceVolume * 100) })).setColor(th.text);
    const voices = this.ctx.host.s.voice.germanVoices();
    const name = st.voiceName && voices.some((v) => v.name === st.voiceName) ? st.voiceName : t('os.settings.voiceAuto');
    this.voiceName.setLabel(t('os.settings.voiceName', { name: asciiName(name) }));
    this.voiceNote.setText(voices.length === 0 ? t('os.settings.voiceNone') : '');
    const vb = this.voiceName.bounds;
    if (vb.w > 0) this.voiceName.layout(vb.x, vb.y, vb.w, vb.h);
    this.wpLabel.setColor(th.text);
    this.themeLabel.setColor(th.text);
  }
}

/** Systemstimmen-Namen können Zeichen enthalten, die die Pixel-Schrift nicht kennt. */
function asciiName(name: string): string {
  return name.replace(/[^A-Za-z0-9ÄÖÜäöüß .,()\-–+]/g, '').replace(/\s+/g, ' ').trim();
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

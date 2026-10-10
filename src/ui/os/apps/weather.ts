import Phaser from 'phaser';
import { t } from '../../../i18n';
import { forecast, type DayWeather } from '../../../systems/os/weather';
import { PixelLabel } from '../../PixelLabel';
import { drawBevel } from '../widgets';
import type { AppContext, AppDef, AppView } from './types';

interface Card {
  w: DayWeather;
  day: PixelLabel;
  icon: Phaser.GameObjects.Image;
  temp: PixelLabel;
  feels: PixelLabel;
  text: PixelLabel;
}

const DAY_KEYS = ['os.weather.today', 'os.weather.tomorrow', 'os.weather.dayAfter'] as const;

/** Wetter (APP-52): Drei-Tage-Vorhersage für Schwindelheim, fest pro Arbeitstag. */
class WeatherView implements AppView {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly heading: PixelLabel;
  private readonly footer: PixelLabel;
  private readonly cards: Card[];

  constructor(private readonly ctx: AppContext) {
    const { host } = ctx;
    const sc = host.scene;
    const opt = (color: 'white' | 'fog' | 'mustard') => ({ scale: host.u(), color, shadow: null, container: host.container });
    this.g = sc.add.graphics();
    host.container.add(this.g);
    const day = ctx.os.env.day();
    this.heading = new PixelLabel(sc, t('os.weather.heading', { day }), opt('white'));
    this.footer = new PixelLabel(sc, t('os.weather.footer'), opt('fog'));
    this.cards = forecast(day, 3).map((w, i) => {
      const icon = sc.add.image(0, 0, `os-wx-${w.symbol}`);
      host.container.add(icon);
      return {
        w,
        day: new PixelLabel(sc, t(DAY_KEYS[i]!), opt('mustard')),
        icon,
        temp: new PixelLabel(sc, t('os.weather.temp', { temp: w.temp }), opt('white')),
        feels: new PixelLabel(sc, t(`os.weather.feels.${w.feels}`), opt('fog')),
        text: new PixelLabel(sc, t(`os.weather.forecast.${w.id}`, { chance: w.chance }), opt('white')),
      };
    });
  }

  layout(w: number, h: number): void {
    const u = this.ctx.host.u();
    const th = this.ctx.host.theme();
    const g = this.g;
    g.clear();
    this.heading.setScale(u).setColor(th.text).setMaxWidth(w).setPosition(0, 0);
    this.footer.setScale(u).setColor(th.textDim).setMaxWidth(w);
    const top = this.heading.height + 3 * u;
    const bottom = h - this.footer.height - 2 * u;
    this.footer.setPosition(0, bottom + 2 * u);
    const gap = 3 * u;
    const n = this.cards.length;
    // Spalten nur, wenn jede Karte breit genug für lange Wörter ist und die Zeilen zu flach würden.
    const colW = (w - gap * (n - 1)) / n;
    const rowH = (bottom - top - gap * (n - 1)) / n;
    const columns = colW >= 110 * u && rowH < 52 * u;
    const cw = columns ? colW : w;
    const chH = columns ? bottom - top : rowH;
    this.cards.forEach((c, i) => {
      const x = columns ? i * (cw + gap) : 0;
      const y = columns ? top : top + i * (chH + gap);
      drawBevel(g, Math.round(x), Math.round(y), Math.round(cw), Math.round(chH), u, th.windowDark, th.buttonDark, th.frameLight, true);
      const pad = 4 * u;
      c.day.setScale(u).setColor(th.accent).setPosition(Math.round(x + pad), Math.round(y + pad));
      if (columns) {
        // Spalte (flach, z. B. Handy quer): Symbol links neben „Tag Temperatur“, darunter gefühlt und Text.
        const iconScale = u;
        c.icon.setScale(iconScale).setPosition(Math.round(x + pad + 8 * iconScale), Math.round(y + pad + 8 * iconScale));
        const tx = x + 2 * pad + 16 * iconScale;
        c.day.setPosition(Math.round(tx), Math.round(y + pad));
        c.temp.setScale(u).setPosition(Math.round(tx + c.day.width + 4 * u), Math.round(y + pad));
        let ty = y + pad + Math.max(16 * iconScale, c.day.height) + 3 * u;
        c.feels.setScale(u).setColor(th.textDim).setMaxWidth(cw - 2 * pad).setPosition(Math.round(x + pad), Math.round(ty));
        ty += c.feels.height + 3 * u;
        c.text.setScale(u).setColor(th.text).setMaxWidth(cw - 2 * pad).setPosition(Math.round(x + pad), Math.round(ty));
      } else {
        // Zeile: Symbol links, rechts Tag/Temperatur, gefühlt und Text.
        const iconScale = Math.max(1, Math.min(3 * u, Math.floor((chH - 2 * pad) / 16)));
        c.icon.setScale(iconScale).setPosition(Math.round(x + pad + 8 * iconScale), Math.round(y + chH / 2));
        const tx = x + 2 * pad + 16 * iconScale;
        const tw = cw - (tx - x) - pad;
        c.day.setPosition(Math.round(tx), Math.round(y + pad));
        c.temp.setScale(u).setPosition(Math.round(tx + c.day.width + 4 * u), Math.round(y + pad));
        c.feels.setScale(u).setColor(th.textDim).setMaxWidth(tw).setPosition(Math.round(tx), Math.round(y + pad + c.day.height + 2 * u));
        c.text.setScale(u).setColor(th.text).setMaxWidth(tw).setPosition(Math.round(tx), Math.round(y + pad + c.day.height + c.feels.height + 4 * u));
      }
    });
  }

  state(): unknown {
    return { days: this.cards.map((c) => ({ id: c.w.id, temp: c.w.temp, symbol: c.w.symbol })) };
  }

  destroy(): void {
    this.g.destroy();
    this.heading.destroy();
    this.footer.destroy();
    for (const c of this.cards) {
      c.day.destroy();
      c.icon.destroy();
      c.temp.destroy();
      c.feels.destroy();
      c.text.destroy();
    }
  }
}

export const weatherApp: AppDef = {
  id: 'weather',
  icon: 'weather',
  titleKey: 'os.apps.weather.title',
  shortKey: 'os.apps.weather.short',
  size: { w: 260, h: 200 },
  onDesktop: true,
  inStartMenu: true,
  create: (ctx) => new WeatherView(ctx),
};

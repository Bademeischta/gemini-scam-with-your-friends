import { TUNING } from '../../../config/tuning';
import { unlockNames } from '../../../core/run';
import { i18n, t } from '../../../i18n';
import { LAST_UNLOCK_DAY, unlocksOn } from '../../../systems/day/unlocks';
import { controlHeight, OsButton, OsList, OsTextView } from '../widgets';
import type { AppContext, AppDef, AppView } from './types';

/** Postfach (APP-07): Chef-Mails mit Tagesziel, Freischaltungen, Spam. */
class MailView implements AppView {
  private readonly list: OsList;
  private readonly detail: OsTextView;
  private readonly del: OsButton;
  private readonly off: () => void;
  private size = { w: 0, h: 0 };

  constructor(private readonly ctx: AppContext) {
    const { host } = ctx;
    const id = ctx.win.id;
    this.list = new OsList(host, `${id}:list`);
    this.list.onSelect = () => this.syncDetail();
    this.list.onActivate = () => this.syncDetail();
    this.detail = new OsTextView(host, `${id}:detail`, '');
    this.del = new OsButton(host, `${id}:delete`, { label: t('os.mail.delete'), onClick: () => this.remove() });
    this.off = ctx.os.env.work.mail.onChange(() => this.refresh());
    this.refresh();
  }

  layout(w: number, h: number): void {
    this.size = { w, h };
    const host = this.ctx.host;
    const gap = 3 * host.u();
    const ch = controlHeight(host);
    if (w >= h * 1.2) {
      const lw = Math.round(w * 0.42);
      this.list.layout(0, 0, lw, h);
      this.detail.layout(lw + gap, 0, w - lw - gap, h - ch - gap);
      this.del.layout(w - Math.min(w - lw - gap, this.del.preferredWidth() + 8 * host.u()), h - ch, Math.min(w - lw - gap, this.del.preferredWidth() + 8 * host.u()), ch);
    } else {
      const lh = Math.round(h * 0.36);
      this.list.layout(0, 0, w, lh);
      this.detail.layout(0, lh + gap, w, h - lh - ch - 2 * gap);
      this.del.layout(w - Math.min(w, this.del.preferredWidth() + 8 * host.u()), h - ch, Math.min(w, this.del.preferredWidth() + 8 * host.u()), ch);
    }
  }

  firstFocus(): string | undefined {
    return `${this.ctx.win.id}:list`;
  }

  state(): unknown {
    const mb = this.ctx.os.env.work.mail;
    return { mails: mb.mails.map((m) => ({ from: m.from, subject: t(m.subject, m.params), read: m.read })), unread: mb.unread, selected: this.list.selectedItem?.id ?? null };
  }

  destroy(): void {
    this.off();
    this.list.destroy();
    this.detail.destroy();
    this.del.destroy();
  }

  private refresh(): void {
    const mails = this.ctx.os.env.work.mail.mails;
    this.list.setItems(
      mails.map((m) => ({
        id: `mail-${m.id}`,
        label: t(m.subject, m.params),
        icon: m.from === 'spam' ? 'os-icon-trash' : m.from === 'boss' ? 'os-icon-mail' : 'os-icon-lock',
        dim: m.read,
      })),
    );
    this.syncDetail();
    if (this.size.w > 0) this.layout(this.size.w, this.size.h);
  }

  private current() {
    const sel = this.list.selectedItem;
    return sel ? this.ctx.os.env.work.mail.mails.find((m) => `mail-${m.id}` === sel.id) : undefined;
  }

  private syncDetail(): void {
    const m = this.current();
    this.del.setEnabled(!!m);
    if (!m) {
      this.detail.setContent(t('os.mail.empty'));
      return;
    }
    this.detail.setContent(`${t(`os.mail.from.${m.from}`)}\n${t(m.subject, m.params)}\n\n${t(m.body, m.params)}`);
    // Lesen markiert als gelesen (das löst ein Neuzeichnen der Liste aus).
    if (!m.read) this.ctx.os.env.work.mail.markRead(m.id);
  }

  private remove(): void {
    const m = this.current();
    if (!m) return;
    this.ctx.os.env.work.mail.remove(m.id);
    this.ctx.host.s.sfx.crumple();
  }
}

/** Stempeluhr (APP-10, OS-07): Tagesziel, Team-Fortschritt, wer ausgestempelt hat, Laune des Chefs. */
class ClockView implements AppView {
  private readonly info: OsTextView;
  private readonly btn: OsButton;
  private refreshIn = 0;
  private lastText = '';

  constructor(private readonly ctx: AppContext) {
    const { host } = ctx;
    const id = ctx.win.id;
    this.info = new OsTextView(host, `${id}:info`, '');
    this.btn = new OsButton(host, `${id}:clockout`, { label: t('os.clock.button'), icon: 'os-icon-timeclock', variant: 'primary', onClick: () => this.clockOut() });
    this.sync();
  }

  layout(w: number, h: number): void {
    const host = this.ctx.host;
    const ch = Math.round(controlHeight(host) * 1.2);
    const gap = 3 * host.u();
    this.info.layout(0, 0, w, h - ch - gap);
    this.btn.setIconScale(host.u()).layout(0, h - ch, w, ch);
  }

  update(dt: number): void {
    this.refreshIn -= dt;
    if (this.refreshIn <= 0) this.sync();
  }

  firstFocus(): string | undefined {
    return `${this.ctx.win.id}:clockout`;
  }

  state(): unknown {
    const w = this.ctx.os.env.work;
    return { ready: w.shift().quotaReached, clockedOut: w.clockedOut(), text: this.lastText };
  }

  destroy(): void {
    this.info.destroy();
    this.btn.destroy();
  }

  private clockOut(): void {
    if (this.ctx.os.env.work.clockOut()) this.ctx.host.s.sfx.start();
    else this.ctx.host.s.sfx.deny();
    this.sync();
  }

  private sync(): void {
    this.refreshIn = 0.5;
    const w = this.ctx.os.env.work;
    const s = w.shift();
    const rage = w.bossRage();
    const level = rage >= TUNING.boss.yellAt - 10 ? 'furious' : rage >= TUNING.boss.angryAt ? 'angry' : rage >= 30 ? 'grumpy' : 'calm';
    const lines = [
      t('os.clock.goal', { quota: i18n.formatMoney(s.quota) }),
      t('os.clock.team', { team: i18n.formatMoney(s.team), percent: Math.round(s.progress * 100) }),
      '',
      t('os.clock.colleagues'),
      t('os.clock.member', { name: t('report.you'), status: t(w.clockedOut() ? 'os.clock.clockedOut' : 'os.clock.working') }),
      '',
      t('os.clock.rage', { level: t(`os.clock.rageLevels.${level}`) }),
      '',
      t(s.quotaReached ? 'os.clock.ready' : 'os.clock.locked'),
    ];
    const text = lines.join('\n');
    if (text !== this.lastText) {
      this.lastText = text;
      this.info.setContent(text);
    }
    this.btn.setEnabled(s.quotaReached && !w.clockedOut());
  }
}

/** Kalender & Uhr (APP-53): Arbeitstag, Ingame-Uhrzeit, Countdown, Vorschau der Freischaltungen. */
class CalendarView implements AppView {
  private readonly info: OsTextView;
  private refreshIn = 0;
  private lastText = '';

  constructor(private readonly ctx: AppContext) {
    this.info = new OsTextView(ctx.host, `${ctx.win.id}:info`, '');
    this.sync();
  }

  layout(w: number, h: number): void {
    this.info.layout(0, 0, w, h);
  }

  update(dt: number): void {
    this.refreshIn -= dt;
    if (this.refreshIn <= 0) this.sync();
  }

  firstFocus(): string | undefined {
    return `${this.ctx.win.id}:info`;
  }

  state(): unknown {
    return { text: this.lastText };
  }

  destroy(): void {
    this.info.destroy();
  }

  private sync(): void {
    this.refreshIn = 1;
    const s = this.ctx.os.env.work.shift();
    const d = TUNING.day;
    // Ingame-Uhr: der Tag läuft von 9 bis 17 Uhr.
    const frac = 1 - s.timeLeft / s.dayLength;
    const minutes = Math.floor((d.clockStart + frac * (d.clockEnd - d.clockStart)) * 60);
    const time = `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
    const lines = [t('os.calendar.day', { day: s.day }), t('os.calendar.time', { time }), t('os.calendar.left', { left: s.countdownText }), '', t('os.calendar.unlocks')];
    if (s.day >= LAST_UNLOCK_DAY) lines.push(t('os.calendar.allDone'));
    for (let day = s.day; day <= Math.min(LAST_UNLOCK_DAY, s.day + 3); day++) {
      const names = unlockNames(unlocksOn(day));
      if (names.length === 0) continue;
      lines.push(t('os.calendar.unlockDay', { day: day === s.day ? t('os.calendar.today') : day, list: names.join(', ') }));
    }
    const text = lines.join('\n');
    if (text !== this.lastText) {
      this.lastText = text;
      this.info.setContent(text);
    }
  }
}

export const mailApp: AppDef = {
  id: 'mail',
  icon: 'mail',
  titleKey: 'os.apps.mail.title',
  shortKey: 'os.apps.mail.short',
  size: { w: 260, h: 190 },
  onDesktop: true,
  inStartMenu: true,
  create: (ctx) => new MailView(ctx),
};

export const clockApp: AppDef = {
  id: 'clock',
  icon: 'timeclock',
  titleKey: 'os.apps.clock.title',
  shortKey: 'os.apps.clock.short',
  size: { w: 190, h: 170 },
  onDesktop: true,
  inStartMenu: true,
  create: (ctx) => new ClockView(ctx),
};

export const calendarApp: AppDef = {
  id: 'calendar',
  icon: 'calendar',
  titleKey: 'os.apps.calendar.title',
  shortKey: 'os.apps.calendar.short',
  size: { w: 210, h: 160 },
  onDesktop: true,
  inStartMenu: true,
  create: (ctx) => new CalendarView(ctx),
};

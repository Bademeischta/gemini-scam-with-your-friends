import { callerById } from '../../../data/callers';
import { schemeById } from '../../../data/schemes';
import { t } from '../../../i18n';
import { OsList, OsTextView } from '../widgets';
import type { AppContext, AppDef, AppView } from './types';

/**
 * Kundenkartei (APP-03): Wer schon angerufen hat, mit Kurzbeschreibung, Statistik und allem, was man
 * im Gespräch über Vorlieben, Abneigungen und Lieblingsmaschen herausgefunden hat. Ein Aktenhinweis
 * verrät je Anrufer eine Vorliebe, die man noch nicht kennt.
 */
class KarteiView implements AppView {
  private readonly list: OsList;
  private readonly detail: OsTextView;
  private readonly offs: (() => void)[] = [];
  private size = { w: 0, h: 0 };
  private onPhone: string | null = null;

  constructor(private readonly ctx: AppContext) {
    const { host } = ctx;
    const id = ctx.win.id;
    this.list = new OsList(host, `${id}:list`);
    this.list.onSelect = () => this.syncDetail();
    this.list.onActivate = () => this.syncDetail();
    this.detail = new OsTextView(host, `${id}:detail`, '');
    const hub = ctx.os.env.phone;
    this.offs.push(hub.dossier.onChange(() => this.refresh()));
    this.offs.push(
      hub.on((e) => {
        if (e.type === 'answered' || e.type === 'ended') this.refresh();
      }),
    );
    this.refresh();
  }

  layout(w: number, h: number): void {
    this.size = { w, h };
    const gap = 3 * this.ctx.host.u();
    if (w >= h * 1.2) {
      const lw = Math.round(w * 0.4);
      this.list.layout(0, 0, lw, h);
      this.detail.layout(lw + gap, 0, w - lw - gap, h);
    } else {
      const lh = Math.round(h * 0.38);
      this.list.layout(0, 0, w, lh);
      this.detail.layout(0, lh + gap, w, h - lh - gap);
    }
  }

  firstFocus(): string | undefined {
    return `${this.ctx.win.id}:list`;
  }

  state(): unknown {
    return { callers: this.list.entries.map((e) => e.id), selected: this.list.selectedItem?.id ?? null };
  }

  destroy(): void {
    for (const off of this.offs) off();
    this.list.destroy();
    this.detail.destroy();
  }

  private refresh(): void {
    const hub = this.ctx.os.env.phone;
    const s = hub.session(this.ctx.os.env.desk);
    const live = s?.active ? s.caller.id : null;
    const ids = hub.dossier.ids();
    // Wer gerade am Telefon ist, steht oben und ist ausgewählt.
    const ordered = live ? [live, ...ids.filter((i) => i !== live)] : ids;
    const prev = this.list.selectedItem?.id;
    this.list.setItems(
      ordered.map((id) => {
        const e = hub.dossier.get(id);
        return {
          id,
          label: t(`callers.${id}.name`),
          right: t('os.kartei.calls', { count: e?.calls ?? 0 }),
          icon: id === live ? 'os-icon-phone' : 'os-icon-kartei',
        };
      }),
    );
    const want = live && live !== this.onPhone ? live : prev;
    this.onPhone = live;
    const idx = this.list.entries.findIndex((e) => e.id === want);
    if (idx >= 0) this.list.select(idx);
    this.syncDetail();
    if (this.size.w > 0) this.layout(this.size.w, this.size.h);
  }

  private syncDetail(): void {
    const id = this.list.selectedItem?.id;
    const def = id ? callerById(id) : undefined;
    const e = id ? this.ctx.os.env.phone.dossier.get(id) : undefined;
    if (!id || !def || !e) {
      this.detail.setContent(t('os.kartei.empty'));
      return;
    }
    const topics = (set: Iterable<string>): string => [...set].map((x) => t(`calls.topics.${x}`)).join(', ');
    const schemes = (set: Iterable<string>): string => [...set].map((x) => (schemeById(x) ? t(`schemes.${x}.name`) : x)).join(', ');
    const unknown = t('os.kartei.unknown');
    const lines = [
      t(`callers.${id}.name`),
      t(`callers.${id}.bio`),
      '',
      t('os.kartei.stats', { calls: t('os.kartei.calls', { count: e.calls }), wins: t('os.kartei.wins', { count: e.wins }), best: t('os.kartei.best', { n: e.best }) }),
      t('os.kartei.likes', { list: e.likes.size > 0 ? topics(e.likes) : unknown }),
      t('os.kartei.dislikes', { list: e.dislikes.size > 0 ? topics(e.dislikes) : unknown }),
      t('os.kartei.fans', { list: e.fans.size > 0 ? schemes(e.fans) : unknown }),
      t('os.kartei.skeptics', { list: e.skeptics.size > 0 ? schemes(e.skeptics) : unknown }),
    ];
    // Aktenhinweis: eine Vorliebe, die man noch nicht herausgefunden hat.
    const hint = def.likes.find((l) => !e.likes.has(l));
    if (hint) lines.push('', t('os.kartei.hint', { topic: t(`calls.topics.${hint}`) }));
    this.detail.setContent(lines.join('\n'));
  }
}

export const karteiApp: AppDef = {
  id: 'kartei',
  icon: 'kartei',
  titleKey: 'os.apps.kartei.title',
  shortKey: 'os.apps.kartei.short',
  size: { w: 250, h: 180 },
  onDesktop: true,
  inStartMenu: true,
  create: (ctx) => new KarteiView(ctx),
};

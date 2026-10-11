import type Phaser from 'phaser';
import { PALETTE } from '../../../config/palette';
import { callerChat, PLAUDER_FRIENDS } from '../../../data/os/plauder';
import { t } from '../../../i18n';
import { BODY_FONT, controlHeight, OsButton, OsList, OsTabs, OsTextView, OsToggle } from '../widgets';
import { LootEntry } from './loot';
import type { AppContext, AppDef, AppView } from './types';

/** Anzeigename eines Chats (Freund oder Plauderbude-Handle des Anrufers). */
export function chatName(handle: string): string {
  if (handle.startsWith('caller:')) return t(`apps.plauder.callerHandles.${handle.slice(7)}`);
  return PLAUDER_FRIENDS.includes(handle) ? t(`apps.plauder.friends.${handle}`) : handle;
}

/**
 * Plauderbude (APP-05, SCH-03): Messenger mit Kettenbrief-Spam der „Freunde“. Ist ein Anrufer am
 * Telefon, steht sein Kontakt oben – dort geht das Turbo-Geschenk raus. Unter „Anmelden“ wird der
 * vorgelesene Login-Code eingegeben (Turbo-Gönner zahlt aus).
 */
class PlauderView implements AppView {
  private readonly tabs: OsTabs;
  private readonly list: OsList;
  private readonly messages: OsTextView;
  private readonly giftBtn: OsButton;
  private readonly mute: OsToggle;
  private readonly entry: LootEntry;
  private readonly loginIntro: Phaser.GameObjects.Text;
  private readonly offs: (() => void)[] = [];
  private size = { w: 0, h: 0 };
  private liveCaller: string | null = null;

  constructor(private readonly ctx: AppContext) {
    const { host } = ctx;
    const id = ctx.win.id;
    const env = ctx.os.env;
    this.tabs = new OsTabs(host, `${id}:tab`, [t('os.plauder.chats'), t('os.plauder.login')]);
    this.tabs.onChange = () => this.syncTab();
    this.list = new OsList(host, `${id}:list`);
    this.list.onSelect = () => this.syncMessages();
    this.list.onActivate = () => this.syncMessages();
    this.messages = new OsTextView(host, `${id}:messages`, '');
    this.giftBtn = new OsButton(host, `${id}:gift`, { label: t('os.plauder.gift'), icon: 'os-icon-gift', variant: 'primary', onClick: () => this.sendGift() });
    this.mute = new OsToggle(host, `${id}:mute`, t('os.plauder.mute'), env.plauder.muted);
    this.mute.onChange = (v) => env.plauder.setMuted(v);
    this.entry = new LootEntry(ctx, `${id}:login`, { input: 'plauderbude', placeholder: t('os.plauder.placeholder'), submitLabel: t('os.plauder.submit'), history: true });
    this.loginIntro = host.scene.add.text(0, 0, t('os.plauder.loginIntro'), { fontFamily: BODY_FONT, color: PALETTE.paper, fontSize: '13px' });
    host.container.add(this.loginIntro);
    this.offs.push(env.plauder.onChange(() => this.refresh()));
    this.offs.push(
      env.phone.on((e) => {
        if (e.type === 'answered' || e.type === 'ended') this.refresh();
      }),
    );
    this.refresh();
    this.syncTab();
  }

  layout(w: number, h: number): void {
    this.size = { w, h };
    const host = this.ctx.host;
    const u = host.u();
    const ch = controlHeight(host);
    const gap = 3 * u;
    this.tabs.layout(0, 0, w, ch, gap);
    const y = ch + gap;
    const rest = h - y;
    // Anmelden: kurze Erklärung, Eingabe, Verlauf.
    this.loginIntro.setStyle({ fontSize: `${Math.round(13 * host.dpr())}px`, color: PALETTE[host.theme().textDim], wordWrap: { width: w, useAdvancedWrap: true } });
    this.loginIntro.setPosition(0, y);
    const ey = Math.round(y + this.loginIntro.height + gap);
    this.entry.layout(0, ey, w, h - ey);
    if (w >= h * 1.2) {
      const lw = Math.round(w * 0.38);
      this.list.layout(0, y, lw, rest - ch - gap);
      this.mute.layout(0, h - ch, lw, ch);
      const mx = lw + gap;
      this.messages.layout(mx, y, w - mx, rest - ch - gap);
      this.giftBtn.setIconScale(u).layout(mx, h - ch, w - mx, ch);
    } else {
      const lh = Math.round(rest * 0.36);
      this.list.layout(0, y, w, lh);
      const my = y + lh + gap;
      this.messages.layout(0, my, w, h - my - ch - gap);
      const half = (w - gap) / 2;
      this.mute.layout(0, h - ch, half, ch);
      this.giftBtn.setIconScale(u).layout(half + gap, h - ch, half, ch);
    }
  }

  update(): void {
    this.entry.update();
  }

  firstFocus(): string | undefined {
    return this.tabs.index === 0 ? `${this.ctx.win.id}:list` : `${this.ctx.win.id}:login:submit`;
  }

  state(): unknown {
    const p = this.ctx.os.env.plauder;
    return {
      tab: this.tabs.index,
      chats: p.chats.map((c) => ({ handle: c.handle, unread: c.unread, count: c.messages.length })),
      order: this.list.entries.map((e) => e.id),
      selected: this.list.selectedItem?.id ?? null,
      giftEnabled: this.giftEnabled(),
      muted: p.muted,
      entry: this.entry.state(),
    };
  }

  destroy(): void {
    for (const off of this.offs) off();
    this.tabs.destroy();
    this.list.destroy();
    this.messages.destroy();
    this.giftBtn.destroy();
    this.mute.destroy();
    this.entry.destroy();
    this.loginIntro.destroy();
  }

  private get live(): { callerId: string; desk: number } | null {
    const env = this.ctx.os.env;
    const s = env.phone.session(env.desk);
    return s?.active ? { callerId: s.caller.id, desk: env.desk } : null;
  }

  private giftEnabled(): boolean {
    const live = this.live;
    const sel = this.list.selectedItem?.id;
    if (!live || sel !== callerChat(live.callerId)) return false;
    const c = this.ctx.os.env.phone.session(live.desk)?.conversation;
    return !!c && c.state === 'active' && !c.giftSent;
  }

  private sendGift(): void {
    const live = this.live;
    if (!live || !this.giftEnabled()) return;
    const env = this.ctx.os.env;
    env.plauder.add(callerChat(live.callerId), { from: 'me', text: t('os.plauder.giftMsg') });
    env.phone.gift(live.desk);
    this.ctx.host.s.sfx.gift();
    this.refresh();
  }

  private syncTab(): void {
    const chats = this.tabs.index === 0;
    this.list.setVisible(chats);
    this.messages.setVisible(chats);
    this.giftBtn.setVisible(chats);
    this.mute.setVisible(chats);
    this.entry.setVisible(!chats);
    this.loginIntro.setVisible(!chats);
    if (this.size.w > 0) this.layout(this.size.w, this.size.h);
  }

  private refresh(): void {
    const p = this.ctx.os.env.plauder;
    const live = this.live;
    // Der Anrufer bekommt seinen Kontakt, sobald er am Telefon ist – und steht dann ganz oben.
    if (live) p.chat(callerChat(live.callerId));
    const liveKey = live ? callerChat(live.callerId) : null;
    const chats = [...p.chats].filter((c) => c.handle === liveKey || !c.handle.startsWith('caller:') || c.messages.length > 0);
    chats.sort((a, b) => (a.handle === liveKey ? -1 : b.handle === liveKey ? 1 : 0));
    const prev = this.list.selectedItem?.id;
    this.list.setItems(
      chats.map((c) => ({
        id: c.handle,
        label: c.handle === liveKey ? t('os.plauder.onPhone', { handle: chatName(c.handle) }) : chatName(c.handle),
        right: c.unread > 0 ? String(c.unread) : undefined,
        icon: c.handle.startsWith('caller:') ? 'os-icon-phone' : 'os-icon-plauder',
      })),
    );
    // Neuer Anrufer: gleich seinen Chat zeigen.
    const want = liveKey && liveKey !== this.liveCaller ? liveKey : prev;
    this.liveCaller = liveKey;
    const idx = this.list.entries.findIndex((e) => e.id === want);
    if (idx >= 0) this.list.select(idx);
    this.syncMessages();
  }

  private syncMessages(): void {
    const handle = this.list.selectedItem?.id;
    const p = this.ctx.os.env.plauder;
    const chat = handle ? p.chats.find((c) => c.handle === handle) : undefined;
    if (chat && chat.unread > 0 && this.tabs.index === 0) p.read(chat.handle);
    const text =
      chat && chat.messages.length > 0
        ? chat.messages.map((m) => t('os.plauder.message', { name: m.from === 'me' ? t('os.plauder.you') : chatName(chat.handle), text: m.text })).join('\n\n')
        : t('os.plauder.empty');
    this.messages.setContent(text);
    this.giftBtn.setEnabled(this.giftEnabled());
  }
}

export const plauderApp: AppDef = {
  id: 'plauder',
  icon: 'plauder',
  titleKey: 'os.apps.plauder.title',
  shortKey: 'os.apps.plauder.short',
  size: { w: 260, h: 200 },
  onDesktop: true,
  inStartMenu: true,
  create: (ctx) => new PlauderView(ctx),
};

import { t } from '../../../i18n';
import type { Rect } from '../focusNav';
import { TextInputBridge, type TextInputOptions } from '../TextInputBridge';
import { controlHeight, OsButton, OsList, OsTextView, type ListItem } from '../widgets';
import type { AppContext, AppDef, AppView } from './types';

/**
 * Notizblock (APP-08): eigene Notizen per Texteingabe, dazu automatisch erfasste Beute aus Gesprächen
 * (mit Name des Anrufers). Auswahl zeigt den vollen Text; Löschen per Knopf oder Kontextmenü.
 */
class NotesView implements AppView {
  private readonly list: OsList;
  private readonly detail: OsTextView;
  private readonly add: OsButton;
  private readonly del: OsButton;
  private readonly bridge = TextInputBridge.get();
  private readonly off: () => void;
  private inputRect: Rect | null = null;
  private size = { w: 0, h: 0 };
  private readonly inputOpts: TextInputOptions = {
    placeholder: t('os.notes.placeholder'),
    maxLength: 120,
    onSubmit: (text) => this.addNote(text),
  };

  constructor(private readonly ctx: AppContext) {
    const { host } = ctx;
    const id = ctx.win.id;
    this.list = new OsList(host, `${id}:list`);
    this.list.onSelect = () => this.syncDetail();
    this.list.onActivate = () => this.syncDetail();
    this.list.onContext = (item, x, y) => ctx.os.contextMenu(x, y, [{ id: 'delete', label: t('os.ctx.delete'), onSelect: () => this.remove(item) }]);
    this.detail = new OsTextView(host, `${id}:detail`, '');
    this.add = new OsButton(host, `${id}:add`, { icon: 'os-icon-send', variant: 'primary', onClick: () => this.submit() });
    this.del = new OsButton(host, `${id}:delete`, { label: t('os.notes.delete'), onClick: () => this.list.selectedItem && this.remove(this.list.selectedItem) });
    this.off = ctx.os.env.notes.onChange(() => this.refresh());
    this.refresh();
  }

  layout(w: number, h: number): void {
    this.size = { w, h };
    const host = this.ctx.host;
    const u = host.u();
    const ch = controlHeight(host);
    const gap = 3 * u;
    const addW = Math.max(ch, 24 * u);
    this.add.setIconScale(u).layout(w - addW, 0, addW, ch);
    this.inputRect = { x: 0, y: 0, w: w - addW - gap, h: ch };
    const rest = h - ch - gap;
    const listH = Math.round(rest * 0.6);
    this.list.layout(0, ch + gap, w, listH);
    const dy = ch + gap + listH + gap;
    const delW = Math.min(w, this.del.preferredWidth() + 8 * u);
    this.detail.layout(0, dy, w - delW - gap, h - dy);
    this.del.layout(w - delW, h - ch, delW, ch);
  }

  update(): void {
    const win = this.ctx.win;
    const r = this.inputRect;
    const dpr = this.ctx.host.dpr();
    if (!r || !win.active || win.minimized || this.ctx.os.overlayOpen) {
      this.bridge.place(this, null, dpr);
      return;
    }
    if (this.bridge.ownedBy !== this) this.bridge.attach(this, this.inputOpts);
    const o = this.ctx.host.origin();
    const u = this.ctx.host.u();
    this.bridge.place(this, { x: o.x + r.x + u, y: o.y + r.y + u, w: r.w - 2 * u, h: r.h - 2 * u }, dpr);
  }

  firstFocus(): string | undefined {
    return `${this.ctx.win.id}:list`;
  }

  state(): unknown {
    return { notes: this.ctx.os.env.notes.notes.map((n) => ({ text: n.text, from: n.from })), selected: this.list.selectedItem?.id ?? null };
  }

  destroy(): void {
    this.off();
    this.bridge.detach(this);
    this.list.destroy();
    this.detail.destroy();
    this.add.destroy();
    this.del.destroy();
  }

  private submit(): void {
    const text = this.bridge.value.trim();
    if (!text) {
      this.bridge.focus(this);
      return;
    }
    this.bridge.setValue(this, '');
    this.addNote(text);
  }

  private addNote(text: string): void {
    if (this.ctx.os.env.notes.add(text, null)) this.ctx.host.s.sfx.confirm();
  }

  private remove(item: ListItem): void {
    this.ctx.os.env.notes.remove(Number(item.id.replace('note-', '')));
    this.ctx.host.s.sfx.crumple();
  }

  private refresh(): void {
    const notes = this.ctx.os.env.notes.notes;
    this.list.setItems(
      notes.map((n) => ({
        id: `note-${n.id}`,
        label: n.from ? `${t(`callers.${n.from}.short`)}: ${n.text}` : n.text,
        icon: n.from ? 'os-icon-phone' : 'os-icon-notes',
      })),
    );
    this.syncDetail();
    if (this.size.w > 0) this.layout(this.size.w, this.size.h);
  }

  private syncDetail(): void {
    const sel = this.list.selectedItem;
    const note = sel ? this.ctx.os.env.notes.notes.find((n) => `note-${n.id}` === sel.id) : undefined;
    this.detail.setContent(note ? (note.from ? `${t(`callers.${note.from}.name`)}\n${note.text}` : note.text) : t('os.notes.empty'));
    this.del.setEnabled(!!note);
  }
}

export const notesApp: AppDef = {
  id: 'notes',
  icon: 'notes',
  titleKey: 'os.apps.notes.title',
  shortKey: 'os.apps.notes.short',
  size: { w: 180, h: 170 },
  onDesktop: true,
  inStartMenu: true,
  create: (ctx) => new NotesView(ctx),
};

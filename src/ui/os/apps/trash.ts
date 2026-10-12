import type { Services } from '../../../core/services';
import { t } from '../../../i18n';
import { PixelLabel } from '../../PixelLabel';
import { controlHeight, OsButton, OsList } from '../widgets';
import { fileItems } from './files';
import type { AppContext, AppDef, AppView, OsApi } from './types';

/** Papierkorb (APP-48): gelöschte Dateien ansehen, wiederherstellen, endgültig leeren. */
class TrashView implements AppView {
  private readonly list: OsList;
  private readonly restoreBtn: OsButton;
  private readonly emptyBtn: OsButton;
  private readonly empty: PixelLabel;
  private readonly off: () => void;
  private size = { w: 0, h: 0 };

  constructor(private readonly ctx: AppContext) {
    const { host, os } = ctx;
    const id = ctx.win.id;
    this.list = new OsList(host, `${id}:list`);
    this.list.onActivate = (it) => os.open('viewer', { fileId: it.id });
    this.list.onContext = (it, x, y) =>
      os.contextMenu(x, y, [
        { id: 'open', label: t('os.ctx.open'), onSelect: () => os.open('viewer', { fileId: it.id }) },
        { id: 'restore', label: t('os.trash.restore'), onSelect: () => this.restore(it.id) },
      ]);
    this.empty = new PixelLabel(host.scene, t('os.trash.empty'), { scale: host.u(), color: 'fog', shadow: null, originX: 0.5, originY: 0.5, align: 'center', container: host.container });
    this.restoreBtn = new OsButton(host, `${id}:restore`, { label: t('os.trash.restore'), onClick: () => this.list.selectedItem && this.restore(this.list.selectedItem.id) });
    this.emptyBtn = new OsButton(host, `${id}:empty`, { label: t('os.trash.emptyAction'), onClick: () => emptyTrash(os, host.s) });
    this.off = os.env.vfs.onChange(() => this.refresh());
    this.refresh();
  }

  layout(w: number, h: number): void {
    this.size = { w, h };
    const u = this.ctx.host.u();
    const ch = controlHeight(this.ctx.host);
    const gap = 2 * u;
    const listH = h - ch - gap;
    this.list.layout(0, 0, w, listH);
    this.empty.setScale(u).setMaxWidth(w - 12 * u).setPosition(Math.round(w / 2), Math.round(listH / 2));
    const bw = (w - gap) / 2;
    this.restoreBtn.layout(0, h - ch, bw, ch);
    this.emptyBtn.layout(bw + gap, h - ch, bw, ch);
  }

  firstFocus(): string | undefined {
    return this.list.entries.length ? `${this.ctx.win.id}:list` : `${this.ctx.win.id}:restore`;
  }

  state(): unknown {
    return { files: this.list.entries.map((i) => i.id) };
  }

  destroy(): void {
    this.off();
    this.list.destroy();
    this.restoreBtn.destroy();
    this.emptyBtn.destroy();
    this.empty.destroy();
  }

  private refresh(): void {
    const files = this.ctx.os.env.vfs.trash();
    this.list.setItems(fileItems(files));
    this.empty.setVisible(files.length === 0);
    this.restoreBtn.setEnabled(files.length > 0);
    this.emptyBtn.setEnabled(files.length > 0);
    if (this.size.w > 0) this.layout(this.size.w, this.size.h);
  }

  private restore(fileId: string): void {
    if (!this.ctx.os.env.vfs.restore(fileId)) return;
    this.ctx.host.s.sfx.confirm();
  }
}

/** Papierkorb leeren (auch aus dem Kontextmenü des Desktop-Symbols). */
export function emptyTrash(os: OsApi, s: Services): void {
  const n = os.env.vfs.emptyTrash();
  if (n === 0) return;
  s.sfx.crumple();
  os.toast({ icon: 'trash', title: t('os.trash.toastTitle'), body: t('os.trash.toastBody', { count: n }) });
}

export const trashApp: AppDef = {
  id: 'trash',
  icon: 'trash',
  titleKey: 'os.apps.trash.title',
  shortKey: 'os.apps.trash.short',
  size: { w: 190, h: 140 },
  onDesktop: true,
  inStartMenu: true,
  create: (ctx) => new TrashView(ctx),
};

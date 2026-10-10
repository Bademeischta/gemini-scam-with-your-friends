import { i18n, t } from '../../../i18n';
import { FOLDERS, type FolderId, type VFile } from '../../../systems/os/vfs';
import { PixelLabel } from '../../PixelLabel';
import { controlHeight, OsButton, OsList, OsTabs, type ListItem } from '../widgets';
import type { AppContext, AppDef, AppView } from './types';

/** Dateien als Listeneinträge, alphabetisch wie in einem Explorer. */
export function fileItems(files: VFile[]): ListItem[] {
  return files.map((f) => ({ id: f.id, label: t(f.nameKey), icon: 'os-icon-textfile' })).sort((a, b) => a.label.localeCompare(b.label, i18n.locale));
}

/** Dateien (APP-47): Ordner als Reiter, Dateiliste, Öffnen und Löschen (→ Papierkorb). */
class FilesView implements AppView {
  private readonly tabs: OsTabs;
  private readonly list: OsList;
  private readonly openBtn: OsButton;
  private readonly delBtn: OsButton;
  private readonly empty: PixelLabel;
  private readonly info: PixelLabel;
  private folder: FolderId = 'docs';
  private readonly off: () => void;
  private size = { w: 0, h: 0 };

  constructor(private readonly ctx: AppContext) {
    const { host, os } = ctx;
    const id = ctx.win.id;
    this.tabs = new OsTabs(host, `${id}:tab`, FOLDERS.map((f) => t(`os.files.folders.${f}`)));
    this.tabs.onChange = (i) => {
      this.folder = FOLDERS[i] ?? 'docs';
      this.refresh();
    };
    this.list = new OsList(host, `${id}:list`);
    this.list.onActivate = (it) => this.open(it.id);
    this.list.onContext = (it, x, y) =>
      os.contextMenu(x, y, [
        { id: 'open', label: t('os.ctx.open'), onSelect: () => this.open(it.id) },
        { id: 'delete', label: t('os.ctx.delete'), onSelect: () => this.remove(it.id) },
      ]);
    this.empty = new PixelLabel(host.scene, t('os.files.empty'), { scale: host.u(), color: 'fog', shadow: null, originX: 0.5, originY: 0.5, align: 'center', container: host.container });
    this.info = new PixelLabel(host.scene, '', { scale: host.u(), color: 'fog', shadow: null, originY: 0.5, container: host.container });
    this.openBtn = new OsButton(host, `${id}:open`, { label: t('os.files.open'), onClick: () => this.list.selectedItem && this.open(this.list.selectedItem.id) });
    this.delBtn = new OsButton(host, `${id}:delete`, { label: t('os.files.delete'), onClick: () => this.list.selectedItem && this.remove(this.list.selectedItem.id) });
    this.off = os.env.vfs.onChange(() => this.refresh());
    this.refresh();
  }

  layout(w: number, h: number): void {
    this.size = { w, h };
    const u = this.ctx.host.u();
    const ch = controlHeight(this.ctx.host);
    const gap = 2 * u;
    this.tabs.layout(0, 0, w, ch, gap);
    const listY = ch + gap;
    const listH = h - listY - ch - gap;
    this.list.layout(0, listY, w, listH);
    this.empty.setScale(u).setMaxWidth(w - 8 * u).setPosition(Math.round(w / 2), Math.round(listY + listH / 2));
    const by = h - ch;
    const bw = Math.min(70 * u, (w - gap) / 3);
    this.openBtn.layout(0, by, bw, ch);
    this.delBtn.layout(bw + gap, by, bw, ch);
    this.info.setScale(u).setPosition(Math.round(2 * bw + 2 * gap + 2 * u), Math.round(by + ch / 2));
    this.info.setVisible(w - 2 * bw - 2 * gap > 40 * u);
  }

  firstFocus(): string | undefined {
    return `${this.ctx.win.id}:tab:0`;
  }

  state(): unknown {
    return { folder: this.folder, files: this.list.entries.map((i) => i.id), selected: this.list.selectedItem?.id ?? null };
  }

  destroy(): void {
    this.off();
    this.tabs.destroy();
    this.list.destroy();
    this.openBtn.destroy();
    this.delBtn.destroy();
    this.empty.destroy();
    this.info.destroy();
  }

  private refresh(): void {
    const files = this.ctx.os.env.vfs.list(this.folder);
    this.list.setItems(fileItems(files));
    this.empty.setVisible(files.length === 0);
    this.info.setText(t('os.files.count', { count: files.length }));
    this.openBtn.setEnabled(files.length > 0);
    this.delBtn.setEnabled(files.length > 0);
    if (this.size.w > 0) this.layout(this.size.w, this.size.h);
  }

  private open(fileId: string): void {
    this.ctx.os.open('viewer', { fileId });
  }

  private remove(fileId: string): void {
    if (this.ctx.os.env.vfs.delete(fileId)) this.ctx.host.s.sfx.crumple();
  }
}

export const filesApp: AppDef = {
  id: 'files',
  icon: 'files',
  titleKey: 'os.apps.files.title',
  shortKey: 'os.apps.files.short',
  size: { w: 210, h: 150 },
  onDesktop: true,
  inStartMenu: true,
  create: (ctx) => new FilesView(ctx),
};

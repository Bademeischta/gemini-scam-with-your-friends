import { t } from '../../../i18n';
import { OsTextView } from '../widgets';
import type { AppContext, AppDef, AppView } from './types';

interface ViewerArgs {
  fileId: string;
}

function fileIdOf(args: unknown): string {
  return (args as ViewerArgs | undefined)?.fileId ?? '';
}

/** Textansicht für Dateien (öffnet aus Dateien und Papierkorb). */
class ViewerView implements AppView {
  private readonly text: OsTextView;

  constructor(private readonly ctx: AppContext) {
    const file = ctx.os.env.vfs.get(fileIdOf(ctx.args));
    this.text = new OsTextView(ctx.host, `${ctx.win.id}:text`, file ? t(file.contentKey) : '');
    if (file) ctx.win.setTitle(t(file.nameKey));
  }

  layout(w: number, h: number): void {
    this.text.layout(0, 0, w, h);
  }

  firstFocus(): string | undefined {
    return `${this.ctx.win.id}:text`;
  }

  state(): unknown {
    return { fileId: fileIdOf(this.ctx.args) };
  }

  destroy(): void {
    this.text.destroy();
  }
}

export const viewerApp: AppDef = {
  id: 'viewer',
  icon: 'textfile',
  titleKey: 'os.apps.viewer.title',
  shortKey: 'os.apps.viewer.short',
  size: { w: 200, h: 160 },
  onDesktop: false,
  inStartMenu: false,
  windowId: (args) => `viewer-${fileIdOf(args)}`,
  create: (ctx) => new ViewerView(ctx),
};

import type Phaser from 'phaser';
import { PALETTE } from '../../../config/palette';
import type { SchemeInput } from '../../../data/schemes';
import type { OsIcon } from '../../../gfx/osArt';
import { t } from '../../../i18n';
import { BODY_FONT } from '../widgets';
import { LootEntry } from './loot';
import type { AppContext, AppDef, AppView } from './types';

/** Einfache Eingabe-App: kurze Erklärung, Eingabezeile, Verlauf (Ident-o-Mat, Gutschein-Kasse). */
class EntryView implements AppView {
  private readonly intro: Phaser.GameObjects.Text;
  private readonly entry: LootEntry;

  constructor(
    private readonly ctx: AppContext,
    key: string,
    input: SchemeInput,
  ) {
    const sc = ctx.host.scene;
    this.intro = sc.add.text(0, 0, t(`os.${key}.intro`), { fontFamily: BODY_FONT, color: PALETTE.paper, fontSize: '13px' });
    ctx.host.container.add(this.intro);
    this.entry = new LootEntry(ctx, ctx.win.id, { input, placeholder: t(`os.${key}.placeholder`), submitLabel: t(`os.${key}.submit`), history: true });
  }

  layout(w: number, h: number): void {
    const host = this.ctx.host;
    const u = host.u();
    const d = host.dpr();
    this.intro.setStyle({ fontSize: `${Math.round(13 * d)}px`, color: PALETTE[host.theme().textDim], wordWrap: { width: w, useAdvancedWrap: true } });
    this.intro.setPosition(0, 0);
    const y = Math.round(this.intro.height + 4 * u);
    this.entry.layout(0, y, w, h - y);
  }

  update(): void {
    this.entry.update();
  }

  firstFocus(): string | undefined {
    return `${this.ctx.win.id}:submit`;
  }

  state(): unknown {
    return this.entry.state();
  }

  destroy(): void {
    this.entry.destroy();
    this.intro.destroy();
  }
}

function entryApp(id: string, icon: OsIcon, key: string, input: SchemeInput): AppDef {
  return {
    id,
    icon,
    titleKey: `os.apps.${id}.title`,
    shortKey: `os.apps.${id}.short`,
    size: { w: 200, h: 170 },
    onDesktop: true,
    inStartMenu: true,
    create: (ctx) => new EntryView(ctx, key, input),
  };
}

/** Ident-o-Mat (APP-02): Bürgernummern eintragen – Rentennummer-Raffer zahlt aus. */
export const identomatApp = entryApp('identomat', 'idcard', 'identomat', 'identomat');

/** Gutschein-Kasse (APP-11): vorgelesene Gutscheincodes einlösen. */
export const voucherApp = entryApp('voucher', 'voucher', 'voucher', 'gutschein');

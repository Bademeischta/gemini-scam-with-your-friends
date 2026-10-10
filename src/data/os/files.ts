import type { VFile } from '../../systems/os/vfs';

/** Startinhalt des Arbeitsplatz-PCs. Namen und Texte: i18n unter os.doc.<id>.name/.text */
const f = (id: string, folder: VFile['folder']): VFile => ({ id, folder, kind: 'text', nameKey: `os.doc.${id}.name`, contentKey: `os.doc.${id}.text` });

export const START_FILES: readonly VFile[] = [
  f('leitfaden', 'docs'),
  f('handbuch', 'docs'),
  f('kuendigung', 'docs'),
  f('passwoerter', 'docs'),
  f('einkauf', 'docs'),
  f('ram', 'downloads'),
  f('rechnung', 'downloads'),
];

export const START_TRASH: readonly VFile[] = [f('gewissen', 'docs'), f('urlaub', 'docs'), f('moral', 'docs'), f('lebenslauf', 'docs')];

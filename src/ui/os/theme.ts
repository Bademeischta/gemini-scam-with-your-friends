import type { PaletteName } from '../../config/palette';
import type { OsThemeId } from '../../data/os/appearance';

/** Farbschemata von MogelOS (wählbar in der Systemsteuerung). */
export interface OsTheme {
  id: OsThemeId;
  window: PaletteName;
  windowDark: PaletteName;
  frame: PaletteName;
  frameLight: PaletteName;
  title: PaletteName;
  titleInactive: PaletteName;
  titleText: PaletteName;
  text: PaletteName;
  textDim: PaletteName;
  accent: PaletteName;
  button: PaletteName;
  buttonLight: PaletteName;
  buttonDark: PaletteName;
  taskbar: PaletteName;
  selection: PaletteName;
}


export const OS_THEMES: Record<OsThemeId, OsTheme> = {
  klassik: {
    id: 'klassik', window: 'ink2', windowDark: 'ink1', frame: 'ink0', frameLight: 'slate', title: 'mustard', titleInactive: 'ink3',
    titleText: 'ink0', text: 'paper', textDim: 'fog', accent: 'mustard', button: 'ink3', buttonLight: 'slate', buttonDark: 'ink1',
    taskbar: 'ink1', selection: 'navy',
  },
  petrol: {
    id: 'petrol', window: 'navy', windowDark: 'ink1', frame: 'ink0', frameLight: 'teal', title: 'teal', titleInactive: 'petrol',
    titleText: 'ink0', text: 'white', textDim: 'sky', accent: 'mint', button: 'petrol', buttonLight: 'teal', buttonDark: 'ink1',
    taskbar: 'ink1', selection: 'blue',
  },
  himbeere: {
    id: 'himbeere', window: 'wine', windowDark: 'ink1', frame: 'ink0', frameLight: 'rose', title: 'rose', titleInactive: 'ink3',
    titleText: 'ink0', text: 'white', textDim: 'blush', accent: 'blush', button: 'ink3', buttonLight: 'rose', buttonDark: 'ink1',
    taskbar: 'ink1', selection: 'violet',
  },
};

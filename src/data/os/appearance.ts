/** Wählbares Erscheinungsbild von MogelOS (Systemsteuerung, gespeichert in den Einstellungen). */
export const WALLPAPERS = ['mogel', 'karo', 'nacht', 'chef'] as const;
export type Wallpaper = (typeof WALLPAPERS)[number];

export const OS_THEME_IDS = ['klassik', 'petrol', 'himbeere'] as const;
export type OsThemeId = (typeof OS_THEME_IDS)[number];

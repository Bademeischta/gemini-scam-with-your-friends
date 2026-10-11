import type { OsThemeId, Wallpaper } from '../../../data/os/appearance';
import type { OsIcon } from '../../../gfx/osArt';
import type { PhoneHub } from '../../../systems/calls/PhoneHub';
import type { Notebook } from '../../../systems/os/notebook';
import type { VirtualFs } from '../../../systems/os/vfs';
import type { OsWindow } from '../OsWindow';
import type { Host } from '../widgets';

/** Was eine App vom Betriebssystem braucht (bewusst schmal gehalten). */
export interface OsApi {
  /** App öffnen (oder nach vorne holen, falls schon offen). */
  open(appId: string, args?: unknown): void;
  close(win: OsWindow): void;
  toast(opts: ToastOptions): void;
  /** Kontextmenü an einer Bildschirmposition (physische Pixel). */
  contextMenu(x: number, y: number, items: ContextItem[]): void;
  /** Kompakter Handy-Modus (Apps im Vollbild). */
  readonly compact: boolean;
  /** Start- oder Kontextmenü offen (DOM-Eingabefelder ausblenden). */
  readonly overlayOpen: boolean;
  /** Zentrale Dienste des Desktops (Dateisystem, Schicht …). */
  readonly env: OsEnv;
}

export interface OsEnv {
  vfs: VirtualFs;
  /** Aktueller Arbeitstag (Wetter, Chef-Mail …). */
  day(): number;
  /** Farbschema / Hintergrund ändern (Systemsteuerung). */
  setWallpaper(id: Wallpaper): void;
  setTheme(id: OsThemeId): void;
  /** Platz, an dem der Spieler sitzt (Telefon dieses Platzes). */
  desk: number;
  phone: PhoneHub;
  notes: Notebook;
}

export interface ToastOptions {
  icon: OsIcon;
  title: string;
  body: string;
  /** Beim Antippen ausführen (z. B. App öffnen). */
  onClick?: () => void;
}

export interface ContextItem {
  id: string;
  label: string;
  onSelect: () => void;
}

export interface AppContext {
  os: OsApi;
  host: Host;
  win: OsWindow;
  args?: unknown;
}

export interface AppView {
  /** Inhalt im Fenster anordnen (lokale Koordinaten, physische Pixel). */
  layout(w: number, h: number): void;
  update?(dt: number): void;
  /**
   * Texteingabe dieses Frames (siehe InputManager.typed). true = verbraucht;
   * Enter löst dann nicht zusätzlich das fokussierte Element aus.
   */
  onTyped?(keys: readonly string[]): boolean;
  /** Fokus-ID beim Aktivieren des Fensters (Tastatur/Gamepad). */
  firstFocus?(): string | undefined;
  /** Zustand für automatisierte Tests. */
  state?(): unknown;
  destroy(): void;
}

export interface AppDef {
  id: string;
  icon: OsIcon;
  /** Fenstertitel und Startmenü (i18n os.apps.<id>.title), Symbolbeschriftung (os.apps.<id>.short). */
  titleKey: string;
  shortKey: string;
  /** Wunschgröße in OS-Pixeln (u). */
  size: { w: number; h: number };
  onDesktop: boolean;
  inStartMenu: boolean;
  /** Fenster-ID je nach Argument (z. B. eine Textansicht pro Datei). */
  windowId?(args: unknown): string;
  create(ctx: AppContext): AppView;
}

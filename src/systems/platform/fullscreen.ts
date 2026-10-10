/** Vollbild-Steuerung mit Fallbacks für ältere WebKit-Präfixe. Fehler werden still abgefangen. */

type FsDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

export function fullscreenSupported(doc: Document = document): boolean {
  const d = doc as FsDocument;
  return !!(d.fullscreenEnabled || d.webkitFullscreenEnabled);
}

export function isFullscreen(doc: Document = document): boolean {
  const d = doc as FsDocument;
  return !!(d.fullscreenElement || d.webkitFullscreenElement);
}

/** Läuft das Spiel als installierte App (Homescreen)? Dann ist kein Vollbild-Wechsel nötig. */
export function isStandalone(win: Window = window): boolean {
  try {
    return (
      win.matchMedia('(display-mode: fullscreen)').matches ||
      win.matchMedia('(display-mode: standalone)').matches ||
      (win.navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

export async function enterFullscreen(el: HTMLElement = document.documentElement): Promise<boolean> {
  const e = el as FsElement;
  try {
    if (e.requestFullscreen) await e.requestFullscreen({ navigationUI: 'hide' });
    else if (e.webkitRequestFullscreen) await e.webkitRequestFullscreen();
    else return false;
    return true;
  } catch {
    return false;
  }
}

export async function exitFullscreen(doc: Document = document): Promise<void> {
  const d = doc as FsDocument;
  try {
    if (d.exitFullscreen) await d.exitFullscreen();
    else await d.webkitExitFullscreen?.();
  } catch {
    /* ignorieren */
  }
}

export async function toggleFullscreen(): Promise<void> {
  if (isFullscreen()) await exitFullscreen();
  else await enterFullscreen();
}

export function onFullscreenChange(fn: () => void, doc: Document = document): void {
  doc.addEventListener('fullscreenchange', fn);
  doc.addEventListener('webkitfullscreenchange', fn);
}

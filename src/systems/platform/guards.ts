/**
 * Browser-Verhalten abschalten, das im Spiel stört:
 * Zoomen (Pinch, Doppeltippen, Strg+Mausrad, Strg+Plus/Minus), Scrollen, Pull-to-Refresh,
 * Text-Markieren, Kontextmenü und Drag-Ghosts. Texteingabefelder bleiben benutzbar.
 */
export function isTextField(target: EventTarget | null): boolean {
  if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
}

/**
 * preventDefault nur, wenn der Browser es zulässt. Nicht abbrechbare Events (z. B. touchmove
 * während einer laufenden Scroll-Geste) würden sonst eine Chrome-Intervention in der Konsole auslösen.
 */
export function preventIfCancelable(e: Pick<Event, 'cancelable' | 'preventDefault'>): void {
  if (e.cancelable) e.preventDefault();
}

export function installBrowserGuards(win: Window): void {
  const doc = win.document;
  const block = (e: Event): void => {
    if (!isTextField(e.target)) preventIfCancelable(e);
  };

  // Scrollen und Pull-to-Refresh (zusätzlich zu CSS overscroll-behavior/touch-action).
  doc.addEventListener('touchmove', block, { passive: false });
  // Mehrfinger-Gesten (Pinch-Zoom).
  doc.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length > 1) preventIfCancelable(e);
    },
    { passive: false },
  );
  // iOS-Safari-Gesten.
  doc.addEventListener('gesturestart', block as EventListener, { passive: false } as AddEventListenerOptions);
  doc.addEventListener('gesturechange', block as EventListener, { passive: false } as AddEventListenerOptions);
  // Doppeltippen-Zoom.
  doc.addEventListener('dblclick', block, { passive: false });
  // Strg+Mausrad bzw. Trackpad-Pinch am Desktop.
  win.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey) preventIfCancelable(e);
    },
    { passive: false },
  );
  // Strg + / - / 0.
  win.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && ['Equal', 'Minus', 'NumpadAdd', 'NumpadSubtract', 'Digit0', 'Numpad0'].includes(e.code)) {
      e.preventDefault();
    }
  });
  doc.addEventListener('contextmenu', block);
  doc.addEventListener('selectstart', block);
  doc.addEventListener('dragstart', block);
}

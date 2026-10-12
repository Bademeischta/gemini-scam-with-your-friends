/** Reine Viewport-Berechnungen (ohne DOM), damit sie testbar sind. */

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ViewportState {
  /** Sichtbare Fläche in CSS-px. */
  cssWidth: number;
  cssHeight: number;
  /** Verwendete Pixeldichte (gedeckelt). */
  dpr: number;
  /** Canvas-Größe in physischen Pixeln (= Spielkoordinaten). */
  width: number;
  height: number;
  /** Safe-Area-Abstände in physischen Pixeln. */
  safe: Insets;
  orientation: 'landscape' | 'portrait';
}

export const ZERO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

export function parsePx(value: string | null | undefined): number {
  if (!value) return 0;
  const n = parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function clampDpr(raw: number, max: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  return Math.min(Math.max(raw, 1), max);
}

export function computeViewport(cssWidth: number, cssHeight: number, rawDpr: number, maxDpr: number, safeCss: Insets): ViewportState {
  const w = Math.max(1, Math.floor(cssWidth));
  const h = Math.max(1, Math.floor(cssHeight));
  const dpr = clampDpr(rawDpr, maxDpr);
  return {
    cssWidth: w,
    cssHeight: h,
    dpr,
    width: Math.round(w * dpr),
    height: Math.round(h * dpr),
    safe: {
      top: Math.round(safeCss.top * dpr),
      right: Math.round(safeCss.right * dpr),
      bottom: Math.round(safeCss.bottom * dpr),
      left: Math.round(safeCss.left * dpr),
    },
    orientation: w >= h ? 'landscape' : 'portrait',
  };
}

/** Rechteck innerhalb der Safe Area (physische Pixel), optional mit zusätzlichem Rand. */
export function safeRect(vp: ViewportState, marginPx = 0): { x: number; y: number; width: number; height: number } {
  const x = vp.safe.left + marginPx;
  const y = vp.safe.top + marginPx;
  return {
    x,
    y,
    width: Math.max(0, vp.width - vp.safe.right - marginPx - x),
    height: Math.max(0, vp.height - vp.safe.bottom - marginPx - y),
  };
}

/**
 * Größter ganzzahliger Skalierungsfaktor für Pixel-Art, sodass `artPx` CSS-Pixel pro Art-Pixel
 * ungefähr erreicht werden – immer ganzzahlig in physischen Pixeln (scharf auf Retina).
 */
export function pixelScale(vp: ViewportState, cssPerArtPixel: number): number {
  return Math.max(1, Math.round(cssPerArtPixel * vp.dpr));
}

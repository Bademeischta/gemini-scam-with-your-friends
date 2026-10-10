/**
 * Zentrale Tuning-Werte. Jede Zahl, die das Spielgefühl beeinflusst, steht hier
 * (siehe docs/GAME_DESIGN.md §3). Spiellogik liest ausschließlich aus diesem Objekt.
 */
export const TUNING = {
  /** Feste Logik-Schritte, unabhängig von der Bildrate. */
  loop: {
    fixedHz: 60,
    /** Schutz vor der „Todesspirale“: max. Logik-Schritte pro Frame. */
    maxStepsPerFrame: 5,
    /** Größter Frame-Abstand in s, der noch simuliert wird (Tab-Wechsel, Debugger). */
    maxFrameDelta: 0.25,
  },

  display: {
    /** Obergrenze für devicePixelRatio (Performance auf sehr dichten Displays). */
    maxDpr: 3,
    /** CSS-Pixel pro Pixel-Art-Pixel für UI-Elemente in der Pixel-Schrift. */
    uiArtScale: 2,
    /** CSS-Pixel pro Pixel-Art-Pixel für große Überschriften (Logo). */
    logoArtScale: { min: 4, max: 9 },
  },

  input: {
    /** Stick-Totzone (0–1). */
    stickDeadzone: 0.3,
    /** Verzögerung bis zur ersten Wiederholung beim Halten einer Richtung (s). */
    navRepeatDelay: 0.38,
    /** Abstand der Wiederholungen beim Halten (s). */
    navRepeatInterval: 0.11,
    /** Ab dieser kürzeren Bildschirmseite (CSS-px) gilt ein Touch-Gerät als Tablet. */
    tabletMinShortSide: 600,
  },

  ui: {
    /** Mindestgröße für Touch-Ziele in CSS-px (Daumen). */
    minTouchTarget: 56,
    /** Abstand vom Rand bzw. von der Safe Area in CSS-px. */
    edgeMargin: 16,
  },

  title: {
    /** Fenster-Blinken der Skyline: Anteil der Fenster, die pro Sekunde umschalten. */
    windowBlinkRate: 0.04,
    /** Logo-Wellenbewegung: Amplitude in Art-Pixeln und Geschwindigkeit. */
    logoWaveAmp: 1.5,
    logoWaveSpeed: 3.2,
  },

  audio: {
    masterVolume: 0.8,
    uiVolume: 0.5,
  },
} as const;

export type Tuning = typeof TUNING;

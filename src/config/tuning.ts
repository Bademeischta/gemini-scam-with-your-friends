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

  office: {
    /** Laufgeschwindigkeit in Kacheln pro Sekunde. */
    walkSpeedTiles: 4.5,
    /** Zeit bis zur vollen Geschwindigkeit bzw. bis zum Stillstand (s). */
    accelTime: 0.08,
    decelTime: 0.06,
    /** Kollisionsbox an den Füßen (Art-Pixel). */
    hitbox: { w: 10, h: 6 },
    /** Maximaler Abstand Füße ↔ Interaktionspunkt (Art-Pixel). */
    interactRadius: 18,
    /** Prüfpunkt so weit vor den Füßen in Blickrichtung (Art-Pixel). */
    probeAhead: 6,
    /** So viele Kacheln sollen entlang der kürzeren Bildschirmseite sichtbar sein. */
    viewTilesShortSide: 14,
    /** Kamera-Nachführung (1/s, höher = straffer). */
    cameraLerp: 9,
    /** Lauf-Animation: Bilder pro Sekunde bei voller Geschwindigkeit. */
    walkAnimFps: 9,
  },

  /** Arbeitstag und Quota (GAME_DESIGN.md §3). */
  day: {
    /** Tageslänge in Sekunden Echtzeit (Standard 10 min; Komfort-Option ab M11). */
    lengthSeconds: 600,
    /** Quota Tag 1 bei einer Person (Original-Referenz 600 $). */
    quotaBase: 600,
    /** Anstieg pro Tag (Anteil der Basis). */
    quotaGrowth: 0.55,
    /** Zusatz pro weiterem Teammitglied (Anteil). */
    quotaPerMember: 0.75,
    /** Rundung der Quota auf volle … Taler. */
    quotaRounding: 50,
  },

  /** MogelOS (Ingame-Desktop). Längen in CSS-px. */
  os: {
    /** Unter dieser Breite oder Höhe läuft MogelOS im Handy-Modus (Apps im Vollbild, App-Umschalter). */
    compactMaxWidth: 700,
    compactMaxHeight: 420,
    /** Taskleiste mit Maus bzw. auf Touch-Geräten (Daumengröße). */
    taskbarHeight: 40,
    taskbarHeightTouch: 56,
    /** Statusleiste oben im Handy-Modus. */
    statusBarHeight: 48,
    /** Mindesthöhe der Titelleiste (Touch: groß genug für Schließen/Minimieren). */
    titleBarHeight: 30,
    titleBarHeightTouch: 44,
    /** Langes Drücken = Rechtsklick (s). */
    longPressSeconds: 0.5,
    /** Zwei Klicks innerhalb dieser Zeit = Doppelklick (s). */
    doubleClickSeconds: 0.45,
    /** Wischen zwischen Apps: Mindestweg (CSS-px) und Höchstdauer (s). */
    swipeMinDistance: 70,
    swipeMaxSeconds: 0.8,
    /** Benachrichtigungen: Anzeigedauer (s), Breite (CSS-px), höchstens gleichzeitig sichtbar. */
    toastSeconds: 4.5,
    toastWidth: 300,
    toastMax: 3,
    /** Röhrenmonitor-Effekt beim Hinsetzen/Aufstehen (s). */
    crtSeconds: 0.35,
    /** Ab so vielen Sekunden Restzeit blinkt der Countdown rot. */
    countdownWarnSeconds: 60,
  },

  touch: {
    /** Joystick-Radius in CSS-px. */
    joystickRadius: 52,
    joystickDeadzone: 0.18,
    /** Kontext-Button (Hinsetzen, Abnehmen …) in CSS-px. */
    actionButton: 76,
    /** Kleine Buttons (Pause, Aufstehen) in CSS-px, mindestens Daumengröße. */
    smallButton: 56,
    /** Deckkraft der Touch-Steuerelemente. */
    opacity: 0.55,
  },

  audio: {
    masterVolume: 0.8,
    uiVolume: 0.5,
  },
} as const;

export type Tuning = typeof TUNING;

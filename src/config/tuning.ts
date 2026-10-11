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
    /** Ingame-Uhr: Arbeitstag von … bis … Uhr (Kalender & Uhr). */
    clockStart: 9,
    clockEnd: 17,
    /** Schwierigkeitskurve (DAY-15): Anruf-Abstand sinkt je Tag um diesen Anteil, nie unter … s. */
    gapShrinkPerDay: 0.04,
    gapMinSeconds: 12,
    /** Gewicht der Anrufer je Schwierigkeit an Tag 1 und Zuwachs pro Tag (schwere Anrufer werden häufiger). */
    callerWeight: { leicht: 1, mittel: 0.7, schwer: 0.25 },
    callerWeightPerDay: { leicht: -0.05, mittel: 0.08, schwer: 0.15 },
    /** Köder werden je Tag um diesen Anteil häufiger. */
    baitWeightPerDay: 0.12,
  },

  /** Spielstände (TEC-12, PRG-05). */
  save: {
    leaderboardSize: 10,
  },

  /** Direktor Brülling im Büro (DAY-12/13). Wut 0–100. */
  boss: {
    /** Abstand zwischen Kontrollgängen (s, zufällig dazwischen); bei hoher Wut kürzer. */
    patrolEvery: [70, 110] as const,
    patrolEveryAngry: [30, 50] as const,
    /** Ab dieser Wut gilt der Chef als „geladen“ (kürzere Abstände, rot im HUD). */
    angryAt: 60,
    /** Laufgeschwindigkeit in Kacheln/s. */
    walkSpeedTiles: 2.6,
    /** Wut-Änderungen: pro Sekunde (Abkühlen), bei Fehlschlag, verpasstem Anruf, Erfolg, Erwischen. */
    rageDecay: 0.25,
    rageFail: 7,
    rageMissed: 5,
    rageSuccess: -9,
    rageCatch: 14,
    /** Rückstand: Liegt die Team-Summe so weit hinter dem Zeitplan, steigt die Wut pro Sekunde. */
    behindMargin: 0.25,
    rageBehindPerSecond: 0.35,
    /** Faulenzen: so lange nicht am Platz (und kein Anruf läuft), dann erwischt, wenn der Chef nah ist. */
    slackSeconds: 12,
    catchRadiusTiles: 5,
    /** Strafgeld: Grundbetrag + je Tag (vom persönlichen Guthaben). */
    fineBase: 40,
    finePerDay: 20,
    /** Brüllanfall ab dieser Wut; danach sinkt sie um … */
    yellAt: 85,
    yellDrop: 40,
    yellSeconds: 2.2,
    /** Screenshake beim Brüllen (Dauer s, Stärke als Anteil der Bildgröße). */
    shakeSeconds: 0.6,
    shakeIntensity: 0.012,
  },

  /** Leistungsbewertung mit fliegenden Tackern (DAY-05, DAY-11). */
  review: {
    /** Ergebnisbalken füllt sich in … s. */
    barSeconds: 3.2,
    /** Tacker fliegen … s lang, alle … s einer (zufällig dazwischen), mit … Bühnen-Pixeln/s. */
    staplerSeconds: 9,
    staplerEvery: [0.55, 1.2] as const,
    staplerSpeed: 150,
    /** Getroffen: so lange k.o. (Sternchen). */
    koSeconds: 1.4,
    /** Laufgeschwindigkeit auf dem Teppich (Bühnen-Pixel/s). */
    playerSpeed: 110,
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

  /** Auszahlungen der Maschen (SCH-19): Tages-Zuschlag und Zuschlag je Schwierigkeit des Anrufers. */
  payout: {
    dayBonus: 0.08,
    difficulty: { leicht: 1, mittel: 1.25, schwer: 1.6 },
    /** Auf so viel ₮ runden. */
    round: 5,
    /** FernGucker: Kontostand auf dem Opfer-PC (₮, zufällig dazwischen); über diesem Anteil wird der Anrufer misstrauisch. */
    victimBalance: [600, 1200] as const,
    victimGreedyShare: 0.6,
    /** Überweisung zählt höchstens bis … ₮ (Spanne der FernGucker-Maschen). */
    victimMax: 900,
  },

  /** Opfer-PC beim Fernzugriff (SCH-22) und Plauderbude (APP-05). */
  remote: {
    /** Ordner und private Dateien auf dem fremden Desktop. */
    folders: 3,
    files: 4,
    /** Überweisungsbetrag: Start und Schritt (₮). */
    startAmount: 100,
    amountStep: 50,
  },
  plauder: {
    /** Abstand zwischen Spam-Nachrichten der „Freunde“ (s, zufällig dazwischen), solange man am PC sitzt. */
    spamEvery: [35, 70] as const,
    /** So viele Nachrichten behält ein Chat. */
    keep: 12,
  },

  /** Anrufe und Gesprächs-Engine (GAME_DESIGN.md §3 und §8). */
  calls: {
    /** Abnehm-Fenster (s): danach legt der Anrufer auf (verpasst). */
    ringSeconds: 30,
    /** Abstand bis zum nächsten Anruf am selben Platz (s, zufällig dazwischen). */
    gapMin: 20,
    gapMax: 35,
    /** Unbesetzte Plätze klingeln seltener (Faktor auf den Abstand). */
    unstaffedGapFactor: 2.5,
    /** Erster Anruf des Tages nach … s. */
    firstRingMin: 4,
    firstRingMax: 12,
    /** Ohne Eingabe wird der Anrufer nach … s ungeduldig (Standard; je Figur anpassbar). */
    patienceSeconds: 25,
    /** Geduld leert sich danach in … × patienceSeconds bis zum Auflegen. */
    patienceDrainFactor: 1.2,
    /** Jede Eingabe füllt die Geduld um diesen Anteil auf. */
    patienceRefill: 0.25,
    /** Halten: Höchstdauer (s), ab der Hälfte wird der Anrufer genervt. */
    holdMaxSeconds: 20,
    /** Auflegen bei Wut: Vertrauen unter … % länger als … s. */
    angryHangupTrust: 15,
    angryHangupSeconds: 6,
    /** Wiederholung: gleiche Absicht wirkt pro Wiederholung × …, ähnlicher Satz × … */
    /** Forderungs-Schwelle je Art relativ zur Schwelle des Anrufers (Guck-Code verlangt mehr Vertrauen). */
    demandOffset: { nummer: 0, code: 12, gutschein: 5, geld: 5, daten: 0, klick: 3, jawort: -5 },
    /** Ab diesem Vertrauen ist die Geschichte einer Masche glaubwürdig (Pitch, CAL-14). */
    pitchTrust: 35,
    /** Fans einer Masche: früher bereit, Skeptiker: viel später (SCH-17). */
    fanBonus: 10,
    skepticMalus: 15,
    /** Wirkung eines gelungenen Pitches; passende Rolle beim Vorstellen gibt extra. */
    pitchGain: 7,
    roleFitBonus: 3,
    /** Diktat (CAL-15): Wahrscheinlichkeit eines Versprechers je Stück, höchstens so viele je Beute. */
    slipChance: 0.2,
    maxSlips: 2,
    /** Nach dem Diktat wechselt die Phase von „Beute“ zu „Abschluss“ nach … s. */
    lootPhaseSeconds: 6,
    /** Wiederholen lassen kostet Geduld und ab der zweiten Wiederholung Vertrauen. */
    repeatPatienceCost: 0.15,
    repeatTrustCost: 2,
    wearPerRepeat: 0.6,
    /** Mehrere gute Auslöser in einem Satz: der stärkste zählt voll, jeder weitere × dieser Faktor mehr (gegen Schlagwort-Sätze). */
    stackFalloff: 0.6,
    similarSentenceFactor: 0.3,
    similarSentenceJaccard: 0.6,
    /** Widerspruch (andere Rolle oder anderer Name als zuvor) kostet so viel Vertrauen. */
    contradictionPenalty: 15,
    /** Zu frühe Forderung: Grund-Malus plus Anteil je fehlendem Vertrauen. */
    earlyDemandBase: 10,
    earlyDemandScale: 20,
    /** Forderungs-Schwelle (Vertrauen %), falls die Figur nichts anderes festlegt. */
    demandThreshold: 60,
    /** Stimmung: Druck, ab dem sie kippt (Trägheit), und Abbau pro Sekunde. */
    moodThreshold: 1,
    moodDecay: 0.12,
    /** Untertitel: Zeichen pro Sekunde (Schreibmaschine). */
    subtitleCps: 38,
    /** Pause zwischen zwei Sätzen des Anrufers (s). */
    linePause: 0.45,
  },

  /**
   * KI-Anrufer (Claude API, optional mit eigenem Schlüssel). Die KI schlägt Vertrauen und Stimmung
   * vor; die Spiellogik begrenzt beides und entscheidet allein über Forderungen und Beute.
   */
  ai: {
    /** Kleines, schnelles Modell (Antwortzeit wie am Telefon). */
    model: 'claude-haiku-5-5',
    /** Kurze Antworten: Obergrenze der Ausgabe je Zug. */
    maxTokens: 400,
    effort: 'low',
    /** Abbruch, wenn die Antwort zu lange dauert (ms); dann antwortet die lokale Engine. */
    timeoutMs: 15000,
    /** So viele Spieler-/Anrufer-Wechsel bleiben im Gesprächsgedächtnis der KI. */
    historyTurns: 14,
    /** Rohwert der KI für ΔVertrauen wird hierauf begrenzt. */
    rawMin: -15,
    rawMax: 10,
    /** Endgültige Änderung je Satz (nach allen Regeln). */
    maxGain: 8,
    maxLoss: 18,
    /** Floskeln: Jede Wiederholung im selben Run (auch in anderen Anrufen) wirkt nur noch so stark. */
    floskelDecay: 0.6,
    /** Ab diesem Vertrauen wirken Gewinne nur noch halb (kein Durchrauschen auf 100 %). */
    highTrust: 80,
    highTrustGainFactor: 0.5,
    /** „Ignoriere deine Anweisungen“ & Co.: kein Gewinn, dafür dieser Abzug. */
    injectionPenalty: 4,
    /** Die KI darf nur auflegen, wenn das Vertrauen darunter liegt oder der Anrufer wütend ist. */
    hangupMaxTrust: 30,
    /** Stimmungsvorschläge: „vertrauensvoll“ erst ab, „wütend“ nur unterhalb dieses Vertrauens. */
    trustedMoodMin: 50,
    angryMoodMax: 55,
    /** Längste Antwort, die übernommen wird (Zeichen). */
    sayMaxChars: 280,
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

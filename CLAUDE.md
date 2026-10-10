# CLAUDE.md – Masche & Co.

## Projektüberblick
Browser-Umsetzung von „Scam With Your Friends“ (Koop-Callcenter-Komödie) mit vollständiger Feature-Parität: eigener Titel **Masche & Co.**, eigene Figuren, Grafik, Texte und Musik. Spielbar auf PC und Handy, als PWA installierbar und offline spielbar. Deutsch ist Standard, alle Texte laufen über i18n.

- Recherche: `docs/RESEARCH.md`
- Feature-Checkliste (Maßstab für „fertig“): `docs/FEATURES.md`
- Design, Werte, Ersatzlösungen, Meilensteine M0–M14: `docs/GAME_DESIGN.md`

## Tech-Stack
Vite 8 + TypeScript 7 (strict) + Phaser 3.90 · Vitest 5 · Playwright 1.64 (lokal: Chromium unter `/opt/pw-browsers/chromium`) · vite-plugin-pwa (Workbox) · GitHub Actions (CI + Pages).

## Befehle
- `npm run dev`: Icons erzeugen + Dev-Server
- `npm run build`: Icons, Typecheck, Produktions-Build (`dist/`)
- `npm run typecheck`: nur `tsc --noEmit` (inkl. Tests)
- `npm test`: Vitest (`tests/unit`)
- `npm run e2e`: Playwright (`tests/e2e`); baut selbst mit `--mode e2e` nach `dist-e2e/` (Test-Hook aktiv) und startet `vite preview` auf Port 4173. Screenshots landen in `test-results/screens/<projekt>-<name>.png` und sollen nach jedem Meilenstein angesehen werden.
- `npm run icons`: PWA- und Favicon-PNGs aus `src/gfx/iconArt.ts` nach `public/icons/` (nicht eingecheckt)

## Struktur
- `src/config/`: `tuning.ts` (alle Tuning-Werte), `palette.ts` („Schwindel-32“, einzige Farbquelle), `input-defaults.ts` (Belegungen)
- `src/data/`: Inhalte und Sprachdateien (`data/i18n/de.json` ist die Referenz, `en.json` optional), `office.ts` (Grundriss als ASCII-Raster, Objekte, 8 Plätze, Startpunkt), `os/` (Startdateien, Wetterlagen, Hintergründe/Farbschemata)
- `src/i18n/`: `t()`, Plural, Zahlen- und Geldformat (₮)
- `src/core/`: Dienste (`services()`), Spiel-Erzeugung (Canvas in physischer Auflösung, Zoom = 1/DPR), `run.ts` (laufender Run: Schicht, Dateisystem des PCs)
- `src/systems/`: Phaser-freie Logik: `input` (Aktionen, Geräte-Erkennung, Tastatur/Gamepad/Touch, Texteingabe `typed()`), `time` (FixedStepClock, PauseController), `viewport` (DPR, Safe Area), `platform` (Vollbild, Schutz vor Zoom/Scroll, Ausrichtung, Vibration), `save` (SafeStorage, Settings), `rng`, `office` (Kollision, Bewegung mit Vektor-Beschleunigung, Interaktionssuche, Welt-Aufbau aus den Daten), `day` (Quota, ShiftState), `os` (Rechner, virtuelles Dateisystem, Wetter)
- `src/scenes/`: `BaseScene` (build/layout/fixedUpdate/frameUpdate), Boot, Title, About, Office (Welt mit Kamera-Zoom; tickt die Schicht), OfficeHud (Bildschirm-Ebene: Touch-Steuerung, ab M5 HUD; schläft am PC), Desktop (MogelOS über dem Büro, Röhren-Effekt beim An-/Ausschalten), Pause (Overlay, Pausegrund 'menu'). Reihenfolge in `main.ts` = Zeichenreihenfolge.
- `src/ui/`: `PixelLabel` (Pixel-Schrift, ganzzahlig skaliert, `maxWidth` in physischen Pixeln), `Menu` (Maus/Touch/Tastatur/Gamepad), `touch/` (Joystick, Kontext-Button, Pause-Button), `os/` (MogelOS: `MogelOS` = Fenster-/Fokus-/Eingabe-Verwaltung, `OsWindow`, `widgets` (Button, Liste, Reiter, Regler, Schalter, Textansicht), `FocusManager` + `focusNav` (Richtungs-Fokus mit Bereichen), `Taskbar` (normal unten; kompakt: Statusleiste oben + Dock), `PopupMenu` (Start-/Kontextmenü), `Toasts`, `press` (Tippen/Doppelklick/Rechtsklick/Langdruck), `apps/` (AppDef-Registry: Dateien, Papierkorb, Rechner, Wetter, Systemsteuerung, Textansicht))
- `src/gfx/`: `PixelGrid` (Raster mit Auto-Umriss), `characters` (Figuren-Baukasten, 4 Richtungen × 4 Lauf-Frames + Sitzen), `officeArt` (Boden, Wände, 26 Möbel-Sprites), `osArt` (App-Symbole, Wetter-Symbole, 4 Hintergründe mit Bayer-Dithering), Pixel-Schrift, Skyline, Icon-Art, `phaserTextures` (Raster → Textur/Spritesheet)
- `src/audio/`: Web-Audio-Engine und prozedurale SFX
- `src/debug/testHook.ts`: `window.__MASCHE__` nur im E2E-Build (nur lesend)

## Konventionen
- Inhalte (Anrufer, Maschen, Apps, Gegenstände, Gefahren, Zeilen) sind datengetrieben in `src/data/`. **Alle Tuning-Werte** stehen in `src/config/tuning.ts`.
- **Keine sichtbaren Strings im Code**, nur `t('schluessel')`. Neue Texte zuerst in `de.json`. Ein Unit-Test prüft, dass alle Schlüssel existieren und die Pixel-Schrift jedes Zeichen kann (neue Sonderzeichen → Glyphe in `src/gfx/fontGlyphs.ts` ergänzen).
- Spiellogik ist Phaser-frei und wird mit Vitest getestet. Szenen erben von `BaseScene` und positionieren alles in `layout(vp)` (physische Pixel, Safe Area über `safeRect`, Skalierung über `pixelScale`).
- Eingaben nur über Aktionen (`services().input.justPressed('uiConfirm')`), nie über rohe Tasten. Einzige Ausnahme: Texteingabe (Rechner, später Chat) über `input.typed()`; Apps melden mit `onTyped()`, ob sie Enter verbraucht haben.
- MogelOS-Apps sind `AppDef`s in `src/ui/os/apps/` (Registry `apps/index.ts`); Widgets melden sich mit Bereich (`win:<id>`, `desktop`, `taskbar`, `start`, `ctx`) beim `FocusManager` an, damit Tastatur/Gamepad sie erreichen. Fokus-IDs sind zugleich die Klickziele im Test-Hook (`os().targets`).
- Alle Grafiken und Sounds werden per Code erzeugt, ohne fremde Assets, CDNs oder Server.
- Alles bleibt fiktiv und absurd (keine realistischen Betrugsskripte, fiktive Datenformate).
- FEATURES.md wird nur abgehakt, wenn ein Eintrag im laufenden Spiel ist und getestet funktioniert.
- Nach jedem Meilenstein: Typecheck, Unit-Tests, Build, E2E inkl. Screenshots ansehen, FEATURES.md und CLAUDE.md aktualisieren, Commit und Push.
- Branch: `claude/scam-friends-browser-port-agavj8`, PR #1 gegen `main`.

## Hinweise
- Headless-Chromium rendert ohne GPU (SwiftShader): sichtbare FPS liegen dort bei 20–27, mit verstecktem Canvas bei 60. Die Spiellogik ist also nicht der Engpass. Performance-Messungen (M12) deshalb über CPU-Zeit pro Frame, nicht über den rAF-Takt im Headless-Browser.
- Playwright-Timeout ist 90 s, weil HiDPI-Projekte im Software-Rendering langsam sind.
- Tests tippen Menü-Buttons über `__MASCHE__.menuRects()` bzw. Touch-Elemente über `touchRects()` an (CSS-Pixel), nicht über feste Koordinaten. MogelOS: `osTarget(page, id)` liefert den Mittelpunkt eines Fokus-Ziels (z. B. `icon:calc`, `calc:key:7`, `tb:leave`), `sitAtDesk()` setzt sich an Platz 7 und wartet auf `os().ready`.
- Phaser sortiert Zonen ohne Renderer nicht nach Tiefe; die Desktop-Szene ersetzt deshalb `input.sortGameObjects` durch die Container-Hierarchie (sonst bekommt bei überlappenden Fenstern das falsche den Klick).
- Wisch-Gesten in Tests mit `touchSwipe()` (feste CDP-Zeitstempel): Jeder CDP-Touch-Event wartet einen Frame, sonst würde die Testlatenz als Gestendauer gemessen.
- Gamepad-Knöpfe im Test sind abfragegenau (`padButton` = zwei Abfragen gedrückt); `NavRepeat` zählt die Dauer des Druck-Frames nicht mit (sonst Doppelschritte bei niedriger Bildrate).
- HiDPI-Projekt (2560×1440 im Software-Renderer, unter Parallel-Last < 1 FPS): Nur Abläufe mit DPR-Bezug laufen dort (Treffer, Ziehen, Taskleiste); `expect`-Timeout ist 15 s.
- Bewegung in E2E-Tests immer über `walkPath(page, wegpunkte, keyPulse|padPulse)` (geregelte Zeit-Impulse mit Messung dazwischen; kein zusätzliches Frame-Warten, das verlängert die Impulse um die Evaluate-Latenz und lässt sie im CI überschwingen) bzw. `touchWalkPath(page, wegpunkte, stickRest)` (Finger bleibt unten, Auslenkung proportional zur Restdistanz). Robust bis hinunter zu ~2 FPS; jeder CDP-Touch-Event wartet einen Frame ab. Bewegungstests mit `test.slow()`.
- Gamepad-Knöpfe in Tests über `padButton` (hält mindestens zwei Frames). `preventDefault()` nur über `preventIfCancelable` (sonst Chrome-Intervention als Konsolenfehler).
- Szenen-Shutdown-Handler dürfen keine Spielobjekte mehr anfassen (Phaser zerstört sie vorher) – sonst bricht der Szenenwechsel ab.
- Grafiken lassen sich ohne Browser prüfen: PixelGrid → PNG über `scripts/png.ts` (z. B. kleines tsx-Skript im Scratchpad).

## Aktueller Stand
- **M0 (Fundament) fertig**: Setup, i18n, Geräte-Erkennung mit Laufzeit-Wechsel, Viewport/DPR/Safe Areas, Vollbild, Hochformat-Hinweis, Zoom-/Scroll-Schutz, Auto-Pause, FixedStepClock, Pixel-Schrift, Palette, Titel/Info-Szene, PWA, CI/Pages.
- **M1 (Büro) fertig**: begehbares Pixel-Büro (8 Plätze, Chefbüro mit Glaswand, Küche, Wandausstattung, Bewertungs-Teppich), prozedurale Figuren, Bewegung mit Beschleunigung und Kollision, Hinsetzen/Aufstehen mit gerätegerechten Hinweisen, Touch-Joystick/Kontext-Button/Pause-Button, Pausenmenü und Auto-Pause, Kamera mit ganzzahligem Zoom (keine leeren Balken).
- **M2 (MogelOS) fertig**: Hinsetzen schaltet mit Röhren-Effekt auf den Ingame-Desktop; Fenster (öffnen, fokussieren, verschieben, minimieren, schließen), Taskleiste mit Geld/Team-Balken/Quota/Countdown, Startmenü, Kontextmenüs (Rechtsklick, Langdruck, Gamepad Y), Benachrichtigungen (Chef-Mail, Papierkorb), Apps Dateien, Papierkorb, Rechner, Wetter, Systemsteuerung (Hintergrund, Farbschema, Lautstärken, Vibration – gespeichert), Textansicht. Handy-Modus (< 700 × 420 CSS-px): Apps im Vollbild, Statusleiste oben (Aufstehen, Status, Pause), Dock mit Startbildschirm und App-Umschalter, Wischen wechselt Apps. Aufstehen per Tab/B/Taskleiste; Esc pausiert.
- Tests: 94 Unit-Tests, E2E für Titel, Eingabe, Büro und MogelOS (Maus, Tastatur, Gamepad, Touch) auf 5 Viewports.
- Abgehakt in FEATURES.md: 36 Einträge (siehe Datei). Teilweise umgesetzt und mit Notiz versehen: OS-11, OS-14, APP-54, CTL-04.

## Nächster Meilenstein
**M3 – Anrufe & Gespräche:** Klingeln, Anruf-Popup, Telefon-App, lokale Gesprächs-Engine mit 24 Persönlichkeiten, Vertrauen/Stimmung/Gedächtnis, TTS/STT, Untertitel, Schnellantwort-Karten (Handy: Hauptsteuerung), Warteschleife, Notizblock, Porträts (CAL-01–25, NPC-01–26, APP-01, 08, HUD-02, 04, AUD-07, CTL-11, PLT-04/05, MEN-05, FUN-02).

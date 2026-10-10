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
- `src/data/`: Inhalte und Sprachdateien (`data/i18n/de.json` ist die Referenz, `en.json` optional)
- `src/i18n/`: `t()`, Plural, Zahlen- und Geldformat (₮)
- `src/core/`: Dienste (`services()`), Spiel-Erzeugung (Canvas in physischer Auflösung, Zoom = 1/DPR)
- `src/systems/`: Phaser-freie Logik: `input` (Aktionen, Geräte-Erkennung, Tastatur/Gamepad/Touch), `time` (FixedStepClock, PauseController), `viewport` (DPR, Safe Area), `platform` (Vollbild, Schutz vor Zoom/Scroll, Ausrichtung), `save` (SafeStorage, Settings), `rng`
- `src/scenes/`: `BaseScene` (build/layout/fixedUpdate/frameUpdate), Boot, Title, About
- `src/ui/`: `PixelLabel` (Pixel-Schrift, ganzzahlig skaliert), `Menu` (Maus/Touch/Tastatur/Gamepad)
- `src/gfx/`: Pixel-Schrift (Glyphen per Code), Pixel-Art, Skyline, Icon-Art
- `src/audio/`: Web-Audio-Engine und prozedurale SFX
- `src/debug/testHook.ts`: `window.__MASCHE__` nur im E2E-Build (nur lesend)

## Konventionen
- Inhalte (Anrufer, Maschen, Apps, Gegenstände, Gefahren, Zeilen) sind datengetrieben in `src/data/`. **Alle Tuning-Werte** stehen in `src/config/tuning.ts`.
- **Keine sichtbaren Strings im Code**, nur `t('schluessel')`. Neue Texte zuerst in `de.json`. Ein Unit-Test prüft, dass alle Schlüssel existieren und die Pixel-Schrift jedes Zeichen kann (neue Sonderzeichen → Glyphe in `src/gfx/fontGlyphs.ts` ergänzen).
- Spiellogik ist Phaser-frei und wird mit Vitest getestet. Szenen erben von `BaseScene` und positionieren alles in `layout(vp)` (physische Pixel, Safe Area über `safeRect`, Skalierung über `pixelScale`).
- Eingaben nur über Aktionen (`services().input.justPressed('uiConfirm')`), nie über rohe Tasten.
- Alle Grafiken und Sounds werden per Code erzeugt, ohne fremde Assets, CDNs oder Server.
- Alles bleibt fiktiv und absurd (keine realistischen Betrugsskripte, fiktive Datenformate).
- FEATURES.md wird nur abgehakt, wenn ein Eintrag im laufenden Spiel ist und getestet funktioniert.
- Nach jedem Meilenstein: Typecheck, Unit-Tests, Build, E2E inkl. Screenshots ansehen, FEATURES.md und CLAUDE.md aktualisieren, Commit und Push.
- Branch: `claude/scam-friends-browser-port-agavj8`, PR #1 gegen `main`.

## Hinweise
- Headless-Chromium rendert ohne GPU (SwiftShader): sichtbare FPS liegen dort bei 20–27, mit verstecktem Canvas bei 60. Die Spiellogik ist also nicht der Engpass. Performance-Messungen (M12) deshalb über CPU-Zeit pro Frame, nicht über den rAF-Takt im Headless-Browser.
- Playwright-Timeout ist 90 s, weil HiDPI-Projekte im Software-Rendering langsam sind.
- Tests tippen Menü-Buttons über `__MASCHE__.menuRects()` an (CSS-Pixel), nicht über feste Koordinaten.

## Aktueller Stand
- **M0 (Fundament) fertig**: Projekt-Setup, i18n, Geräte-Erkennung mit Laufzeit-Wechsel (Touch/Maus/Tastatur/Gamepad), Viewport mit DPR und Safe Areas, Vollbild (Knopf und automatisch auf dem Handy), Hochformat-Hinweis, Schutz vor Zoom/Scroll/Markieren, Auto-Pause und Ton-Stopp im Hintergrund, FixedStepClock, Pixel-Schrift, Palette, prozedurale Skyline, Titel- und Info-Szene, Menü, PWA (Manifest, Icons, Service Worker), 56 Unit-Tests, 59 E2E-Tests auf 5 Viewports, CI- und Pages-Workflow.
- Abgehakt in FEATURES.md: CTL-01, CTL-02, TEC-01 bis TEC-08, TEC-10, TEC-15, TEC-16.

## Nächster Meilenstein
**M1 – Büro:** Kachel-Büro mit 8 Plätzen und Chefbüro, Spielerfigur mit Delta-Time-Bewegung und Kollision, Interaktion (Hinsetzen/Aufstehen), Touch-Joystick und Kontext-Buttons, Büro-HUD, Menüpunkt „Schicht beginnen“ (OFF-01–03, 16, 17, 20, PLT-02, CTL-03, 08, 09, 13, HUD-01).

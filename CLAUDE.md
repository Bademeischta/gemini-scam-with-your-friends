# CLAUDE.md – Masche & Co.

## Projektüberblick
Browser-Umsetzung von „Scam With Your Friends“ (Koop-Callcenter-Komödie) mit vollständiger Feature-Parität: eigener Titel **Masche & Co.**, eigene Figuren, Grafik, Texte und Musik. Spielbar auf PC und Handy, als PWA installierbar und offline spielbar. Sprache: Deutsch.

- Recherche: `docs/RESEARCH.md`
- Feature-Checkliste (Maßstab für „fertig“): `docs/FEATURES.md`
- Design, Werte, Ersatzlösungen, Meilensteine: `docs/GAME_DESIGN.md`

## Tech-Stack (geplant)
Vite + TypeScript (strict) + Phaser 3.90 · Vitest · Playwright (Chromium unter `/opt/pw-browsers`) · vite-plugin-pwa · GitHub Pages über GitHub Actions.

## Befehle
Noch kein Code vorhanden. Ab M0:
- `npm run dev`: Dev-Server
- `npm run build`: Typecheck plus Produktions-Build
- `npm run test`: Vitest
- `npm run e2e`: Playwright (Desktop- und Handy-Viewports, Screenshots)

## Konventionen
- Ordner: `src/{config,data,scenes,entities,systems,ui,audio,gfx}`, Tests in `tests/{unit,e2e}`.
- Inhalte (Anrufer, Maschen, Apps, Gegenstände, Gefahren, Zeilen) sind datengetrieben in `src/data/`. **Alle Tuning-Werte** stehen in `src/config/tuning.ts`.
- Spiellogik (Gesprächs-Engine, Wirtschaft, Tag) ist Phaser-frei und wird mit Vitest getestet.
- Alle Grafiken und Sounds werden per Code erzeugt, ohne fremde Assets, CDNs oder Server.
- Alles bleibt fiktiv und absurd (keine realistischen Betrugsskripte, fiktive Datenformate).
- FEATURES.md wird nur abgehakt, wenn ein Eintrag im laufenden Spiel ist und getestet funktioniert.
- Nach jedem Meilenstein: Build, Tests, Screenshots prüfen, FEATURES.md und CLAUDE.md aktualisieren, Commit.
- Branch: `claude/scam-friends-browser-port-agavj8`.

## Aktueller Stand
- Phase 1 (Recherche), Phase 2 (FEATURES.md) und Phase 3 (GAME_DESIGN.md) sind fertig.
- **Wartet auf das OK des Nutzers**, bevor Code geschrieben wird. Offene Fragen: GAME_DESIGN.md §14.
- `masche.html` ist ein älterer Einzeldatei-Prototyp und wird durch das neue Projekt ersetzt.

## Nächster Meilenstein
**M0 – Fundament:** Projekt-Setup, Input-Schicht mit Geräte-Erkennung, Viewport, Safe Areas, Vollbild, Auto-Pause, Fixed-Step-Loop, Pixel-Font und Palette, Titelbild, PWA-Grundgerüst, Tests, CI.

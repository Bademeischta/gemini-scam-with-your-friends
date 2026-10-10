# Masche & Co.

**Das Callcenter-Chaos mit Freunden.** Ein Browser-Spiel für PC und Handy (installierbar als App), inspiriert von „Scam With Your Friends“. Alle Figuren, Namen, Grafiken, Texte und Klänge sind eigene Versionen. Alles ist fiktiv und erfunden.

> Status: in Entwicklung. Meilenstein **M0 (Fundament)** ist fertig: Titelbildschirm, Geräte-Erkennung, Steuerung, PWA. Plan und Fortschritt: [`docs/FEATURES.md`](docs/FEATURES.md), [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md).

## Lokal starten

Voraussetzung: Node.js ≥ 20.

```bash
npm install
npm run dev        # Dev-Server, Adresse steht in der Konsole
```

## Bauen und testen

```bash
npm run build      # Icons erzeugen, Typecheck, Produktions-Build nach dist/
npm run preview    # gebautes Spiel lokal ansehen
npm test           # Unit-Tests (Vitest)
npm run e2e        # Browser-Tests (Playwright) für Desktop, HiDPI, Handy quer/hoch, Tablet
```

## Steuerung (Stand M0)

| Aktion | Desktop | Gamepad | Touch |
|---|---|---|---|
| Einstempeln (Start) | beliebige Taste | beliebiger Button | Tippen |
| Menü bewegen | Pfeiltasten / WASD, Maus-Hover | Steuerkreuz / Stick | – |
| Auswählen | Enter / Leertaste / Klick | A | Antippen |
| Zurück | Esc / Rücktaste | B | Zurück-Button |
| Vollbild | Knopf oben rechts | – | automatisch beim ersten Tippen |

Das Spiel erkennt das Eingabegerät automatisch und wechselt die Hinweise, sobald ein anderes Gerät benutzt wird.

## Deployment

Jeder Push auf `main` baut das Spiel und veröffentlicht es über GitHub Pages (`.github/workflows/deploy.yml`). Unter *Settings → Pages* muss als Quelle „GitHub Actions“ gewählt sein.

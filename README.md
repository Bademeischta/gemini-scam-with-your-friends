# Masche & Co.

**Das Callcenter-Chaos mit Freunden.** Ein Browser-Spiel für PC und Handy (installierbar als App), inspiriert von „Scam With Your Friends“. Alle Figuren, Namen, Grafiken, Texte und Klänge sind eigene Versionen. Alles ist fiktiv und erfunden.

> Status: in Entwicklung. Fertig sind **M0 (Fundament)** mit Titelbildschirm, Geräte-Erkennung, Steuerung und PWA sowie **M1 (Büro)**: begehbares Callcenter mit 8 Plätzen und Chefbüro, Hinsetzen, Touch-Joystick und Pausenmenü, und **M2 (MogelOS)**: Ingame-Desktop mit Fenstern, Taskleiste (Geld, Team, Quota, Countdown), Startmenü, Kontextmenüs, Benachrichtigungen und den Apps Dateien, Papierkorb, Rechner, Wetter und Systemsteuerung – auf dem Handy als Vollbild-Oberfläche mit App-Umschalter. Plan und Fortschritt: [`docs/FEATURES.md`](docs/FEATURES.md), [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md).

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

## Steuerung (Stand M2)

| Aktion | Desktop | Gamepad | Touch |
|---|---|---|---|
| Einstempeln (Start) | beliebige Taste | beliebiger Button | Tippen |
| Menü bewegen | Pfeiltasten / WASD, Maus-Hover | Steuerkreuz / Stick | – |
| Auswählen | Enter / Leertaste / Klick | A | Antippen |
| Zurück | Esc / Rücktaste | B | Zurück-Button |
| Laufen im Büro | WASD / Pfeiltasten | linker Stick / Steuerkreuz | Joystick (linke Bildschirmhälfte) |
| Hinsetzen (öffnet MogelOS) | E | A | Kontext-Button rechts unten |
| Aufstehen vom PC | Tab oder „Aufstehen“ in der Taskleiste | B | „Aufstehen“ oben links bzw. in der Taskleiste |
| MogelOS bedienen | Maus (Doppelklick öffnet, Rechtsklick = Kontextmenü) oder Pfeile + Enter, G = Kontextmenü | Steuerkreuz + A, Y = Kontextmenü | Tippen, langes Drücken = Kontextmenü |
| App wechseln | Bild↑ / Bild↓ oder Taskleiste | LB / RB | Wischen oder App-Umschalter im Dock |
| Rechner | Ziffern, + - * /, Enter, Rücktaste, C | Fokus + A | Tasten antippen |
| Pause | Esc / P | Start | Pause-Button oben rechts (am PC in der Statusleiste) |
| Vollbild | Knopf oben rechts | – | automatisch beim ersten Tippen |

Das Spiel erkennt das Eingabegerät automatisch und wechselt die Hinweise, sobald ein anderes Gerät benutzt wird.

## Deployment

Jeder Push auf `main` baut das Spiel und veröffentlicht es über GitHub Pages (`.github/workflows/deploy.yml`). Unter *Settings → Pages* muss als Quelle „GitHub Actions“ gewählt sein.

# GAME_DESIGN.md – „Masche & Co.“

Browser-Umsetzung von **„Scam With Your Friends“** mit vollständiger Feature-Parität, spielbar auf PC und Handy und als PWA installierbar.
Recherche: [`RESEARCH.md`](RESEARCH.md) · Checkliste: [`FEATURES.md`](FEATURES.md) (IDs in Klammern verweisen dorthin).

---

## 1. Vision

> Ein chaotischer Arbeitstag im schäbigsten Callcenter von Schwindelheim. Du und deine Freunde (oder Bot-Kollegen) quatscht absurde Anrufer mit immer lächerlicheren Maschen um ihr Erspartes, während Viren eure Monitore anzünden, die Polizei die Tür eintritt und die Konkurrenz Raketen schickt. Und am Ende jedes Tages brüllt Direktor Brülling.

- **Eigener Titel:** *Masche & Co.* („Masche“ heißt Trick oder Betrugsmasche). Untertitel: *Das Callcenter-Chaos mit Freunden*.
- **Eigene Welt:** der fiktive Gewerbehof Schwindelheim, MogelOS, eigene Figuren, Apps, Marken, Texte, Musik. Funktion und Zweck jedes Elements entsprechen dem Original (Zuordnung in FEATURES.md §0).
- **Sprache:** Deutsch (Oberfläche, Anrufer, Sprachein- und -ausgabe). Alle Texte liegen in Datendateien, eine spätere Übersetzung ist ohne Codeänderung möglich.

## 2. Core Loop

### Sekunden-Ebene: das Gespräch
Telefon klingelt → hinlaufen → abnehmen → **einen Satz sagen oder tippen** → der Anrufer reagiert sofort (Stimme, Untertitel, Mimik, Vertrauen ±, Stimmung) → nächster Satz.
Der Reiz entsteht durch **sofortiges, lesbares Feedback auf eigene Worte**: Ein gutes Kompliment an Oma Walpurgas Kristallkugel lässt den Balken springen, ein zu frühes „Nennen Sie mir Ihre Bürgernummer!“ lässt ihn abstürzen. Die Nummer am Ende Ziffer für Ziffer mitzuschreiben, während der Anrufer sich verhaspelt, erzeugt kurze, witzige Spannung.

### Minuten-Ebene: der Arbeitstag
Ein Tag dauert ca. 10 Minuten. Er besteht aus parallelen Anrufen an mehreren Plätzen, dem Wechsel zwischen Telefon, Masche-App und Eingabe-Apps, Shop-Käufen, Casino-Versuchungen und eskalierenden Störungen (Virus → Brand → Razzia → Luftangriff). Dauerhafter Druck kommt von der Taskleiste: **eigenes Geld · Team-Summe · Quota · Countdown**.
Der Reiz liegt in der **Priorisierung unter Chaos**: Gehe ich ans klingelnde Telefon, lösche ich den brennenden Monitor meines Kollegen oder schreddere ich Beweise, weil die Sirenen näherkommen? Ist die Quota erreicht, kommt die Erleichterung: Alle stempeln aus.

### Session-Ebene: der Run
Tag 1 → Bewertung → Tag 2 … bis zum Rauswurf (Perma-Death). Jeder Tag bringt neue Maschen und Apps („immer absurder“), eine höhere Quota, härtere Anrufer und mehr Gefahren. Das persönliche Geld wird zwischen den Tagen in Ramschazon-Ausrüstung investiert (oder verzockt). Am Ende steht der **Kündigungsbericht** mit Rangliste, Statistiken und einem Brülling-Spruch, dazu ein Eintrag in die lokale Bestenliste und der Schicht-Code zum Weitergeben.
Der Reiz: **„Nur noch ein Tag“**. Neue Spielzeuge locken, der Rauswurf ist dramatisch und lustig, und die besten Zitate des Tages werden vor allen vorgeführt.

### Warum es Spaß macht
1. **Sprache als Spielmechanik:** Man spielt mit Worten und nicht mit Menüs. Jeder Anruf wird eine kleine Improvisationsszene.
2. **Figuren-Komik:** 24 überzeichnete Anrufer mit eigenen Ticks. Die Komik entsteht aus ihren Reaktionen auf die eigenen Ideen.
3. **Eskalation:** Ruhige Gespräche kippen in absurde Katastrophen, ein Wechsel zwischen Konzentration und Slapstick.
4. **Koop-Chaos:** gemeinsames Ziel (Quota), aber Streiche gegeneinander. Das „Wer hat den Furzkissen-Chef verursacht?“ entsteht ganz von selbst.
5. **Zuschauen und Erzählen:** Gesprächsanalyse, drei stärkste Momente, Mitschnitt und Kündigungsbericht machen Erlebnisse teilbar.

## 3. Spielgefühl-Werte

Alle Werte stehen zentral in `src/config/tuning.ts` und werden nach den automatisierten Playtests feinjustiert.

| Wert | Festlegung | Herkunft |
|---|---|---|
| Quota Tag 1 (solo) | **600 ₮** | Original-Screenshot 600 $ |
| Quota-Kurve | `600 × (1 + 0,55 × (Tag−1)) × Teamfaktor`, gerundet auf 50 → solo: 600 · 930 · 1.260 · 1.590 · 1.920 · 2.250 · 2.580 … | trifft die Original-Referenzen 1.400, 1.750, 2.600 je nach Teamgröße |
| Teamfaktor | `1 + 0,75 × (Teamgröße−1)` (Menschen plus Bots) | D – Koop darf nicht trivial werden |
| Rentennummer-Masche | **250 ₮** Basis | Original 250 $ |
| Weitere Maschen | 150–900 ₮ (Turbo 300, FernGucker 450–900, Gutschein = vorgelesener Betrag, absurde Maschen 300–800) | D, relativ zur 250-Referenz |
| Tages-Zuschlag Auszahlung | +8 % pro Tag | D – hält mit der Quota Schritt |
| Anrufer-Zuschlag | leicht ×1,0 · mittel ×1,25 · schwer ×1,6 | D |
| Tageslänge | **10:00 min** echtzeit (Ingame-Uhr 9–17 Uhr), wählbar 6/10/15/20 min (QOL-02) | D – Original unbekannt; [XB] nennt 20 min. Rückrechnung: 4 Spieler ≈ 4.400 $ pro Tag ≈ 18 Abschlüsse |
| Abnehm-Fenster | **30 s** | Referenzwert [XB], D |
| Anruf-Takt | pro Platz alle 20–35 s nach Gesprächsende (sinkt pro Tag um 4 %, min. 12 s) | D |
| Vertrauen | 0–100 %, Start je Anrufer 15–60 % | O (Prozent belegt), D |
| Forderungs-Schwellen | Bürgernummer ≥ 60 %, Gutschein ≥ 65 %, Guck-Code ≥ 75 % | D – „Vertrauen vor Forderung“ (O) |
| Auflegen | Vertrauen 0 %, oder Stimmung „Wütend“ mit Vertrauen < 15 % länger als 6 s, oder Geduld leer | O (Auflegen), D (Werte) |
| Geduld | 25 s ohne Eingabe → genervt; Halten max. 20 s | D |
| Wiederholungs-Abnutzung | gleiche Absicht ×0,6 pro Wiederholung, ähnlicher Satz (Jaccard > 0,6) ×0,3 | D – gegen die Kritik aus [CG] |
| Fahndungsdruck | +6 pro Abschluss, +25 bei der Undercover-Ermittlerin, −0,15/s; Razzia ab 100 (ab 70 möglich) | D |
| Gefahren-Einstieg | Tag 1: nur Einführungs-Virus · Tag 2: Viren · Tag 3: Büro-Katastrophen · Tag 4: Razzien · Tag 5: Luftangriffe | D |
| Bewegung | 4,5 Kacheln/s, 0,08 s Beschleunigung, 0,06 s Abbremsen | D – knackig, kein Rutschen |
| Arbeitsplätze | 8 | O (8 Spieler im Screenshot) |
| Lokale Spieler | 1–4 (Splitscreen) plus Bots bis 8 | E |
| Streak-Bonus | +5 % pro Abschluss in Folge, max. +25 %, Reset bei Fehlschlag | A (Combos), abschaltbar |

## 4. Steuerung je Mechanik (Desktop · Gamepad · Touch)

Die Eingabe läuft über eine Aktions-Schicht (`systems/input`): Alle Geräte erzeugen dieselben Aktionen. Das Spiel erkennt automatisch das aktive Gerät (zuletzt benutzt) und zeigt passende Hinweise (CTL-01/02).

| Mechanik | Desktop (frei belegbar) | Gamepad (frei belegbar) | Touch (eingebaut) |
|---|---|---|---|
| Laufen | WASD / Pfeile | linker Stick / Steuerkreuz | schwebender Joystick links |
| Interagieren (hinsetzen, abnehmen, aufheben, reparieren) | E | A | Kontext-Button rechts (Symbol wechselt) |
| Halten-Interaktion (reparieren, löschen) | E halten | A halten | Button halten |
| Gegenstand benutzen / zielen / werfen | Linksklick bzw. F, Maus zielt | X, rechter Stick zielt | Benutzen-Button, Ziehen = Zielen mit Vorschau |
| Gegenstand ablegen | Q | B (im Laufmodus) | Wischen auf dem Gegenstand-Slot |
| Emote-Rad | G | Y halten + Stick | Emote-Button (Rad, wischen) |
| Aufstehen vom Platz | Tab / Esc | B | „Aufstehen“-Button oben links |
| Desktop-Bedienung | Maus | Steuerkreuz-Fokus, A = Klick, LB/RB = App wechseln | Tippen; Wischen = App wechseln; langes Drücken = Kontext |
| Anruf annehmen | Klick auf Popup / E | A | Popup tippen oder nach oben wischen |
| Sprechen | V halten (Push-to-talk) | RT halten | Mic-Button halten |
| Tippen | Tastatur, Enter sendet | Bildschirmtastatur (A tippt) | System-Bildschirmtastatur |
| Schnellantwort-Karten | 1–4 | Steuerkreuz + A | Karte tippen |
| Halten / Auflegen | H / Entf | X / B halten | Buttons in der Telefon-App |
| Nummer mitschreiben | Tastatur | Ziffernrad | Ziffernblock (groß) |
| Boss-Taste | B | LB+RB | Button in der Taskleiste (zweimal tippen) |
| Ausstempeln | Taskleisten-Button | Fokus → A | Taskleisten-Button |
| Pause | Esc / P | Start | Pause-Button oben rechts |
| Bewertung: Tacker ausweichen | WASD | Stick | Joystick |
| Casino, Shop, Paint, Kamera | Maus | Fokus, Stick als Cursor in Kritzel | Tippen / Zeichnen mit dem Finger |
| Vollbild | F11 bzw. Button | – | automatisch beim ersten Tippen, Button |

**Touch-Layout:** Daumen-Buttons ≥ 56 dp, Transparenz 55 %. Querformat: Joystick links unten, Aktionen rechts unten. Hochformat: Joystick unten links, Aktionen unten rechts, der Desktop läuft als Handy-Oberfläche (Apps im Vollbild, App-Umschalter). Alle Buttons lassen sich im Layout-Editor verschieben und skalieren (CTL-14). Safe Areas werden respektiert.

## 5. Design-Entscheidungen für Lücken im Original (D)

Das Original ist im Playtest und vieles ist unveröffentlicht (RESEARCH.md §7). So wird jede Lücke gefüllt:

1. **Ablauf einer Masche:** Phasen Einstieg → Vertrauen → Pitch → Forderung → Beute → Abschluss. Die Beute (Nummer oder Code) wird in der passenden App eingegeben; erst dann wird ausgezahlt. Das passt zu „Identity-App: SSN eingeben“ und „AnyViewer: Code eingeben“ aus dem Original.
2. **Fiktive Datenformate:** Bürgernummer `SH 48 21 07` (2 Buchstaben, 6 Ziffern), Guck-Code `482 107`, Gutschein `QX7P-2M9K`. Sie sind bewusst unähnlich zu echten Identifikationsnummern.
3. **Freischalt-Plan:** Tag 1: Telefon, Ident-o-Mat, Rentennummer-Raffer, Notizblock, Ramschazon, Glücksbit. Tag 2: Plauderbude und Turbo-Masche, Gutschein-Gaudi. **Tag 3: FernGucker, Kundenkartei** (belegt) und FernGucker-Support. Tag 4+: pro Tag 1–2 absurde Maschen. Alles Weitere ist vorzeitig im Ramschazon kaufbar.
4. **Persönliches Geld vs. Team:** Abschlüsse zählen zu beidem. Ausgaben verringern nur das persönliche Geld, nie den Team-Fortschritt. Casino-Gewinne zählen zum Team (riskanter Quota-Weg), Verluste nicht.
5. **Gefahren** brauchen Auslöser, Warnung und Gegenmittel, damit sie fair und lesbar bleiben: Virus ← Köder bzw. dubiose Downloads; Razzia ← Fahndungsdruck; Luftangriff ← Konkurrenz, eigene Bestellung oder Zufall ab Tag 5; Katastrophen ← Zufall pro Tag. Jede Gefahr wird 3–10 s vorher angekündigt.
6. **Der Chef** ist eine Figur im Büro: Kontrollgänge, eine Wut-Anzeige (sie steigt bei Faulenzen, Fehlschlägen und Streichen gegen ihn), Brüllanfälle und die Bewertung mit fliegenden Tackern.
7. **Bots** haben Fähigkeiten (Erfolgsquote, Tempo) und Charakter. Sie spielen Anrufe abstrahiert (keine echten Dialoge), aber sichtbar und hörbar mit Sprechblasen.
8. **Pausieren:** Solo pausiert die Zeit. Im lokalen Koop ebenfalls, weil alle an einem Gerät sitzen. Die Auto-Pause im Hintergrund ist Pflicht.
9. **Achievements, Skins und Endlos-Modus** gibt es im Original nicht belegt. Sie kommen nur als Ergänzung (+) und verändern den Original-Ablauf nicht.

## 6. Gleichwertiger Ersatz für das, was im Browser nicht 1:1 geht (E)

| Original | Problem im Browser | Ersatz | Warum gleichwertig |
|---|---|---|---|
| **Cloud-LLM-Anrufer (OpenRouter)** | Braucht Server, API-Schlüssel, Internet und kostet Geld pro Token; offline nicht möglich | **Lokale Gesprächs-Engine** (§8): Sprachverständnis + Persönlichkeitsmodell + Gedächtnis + über 2.000 eigene Zeilen mit Echo-Bausteinen | Freie Eingabe bleibt die Kernmechanik; Anrufer reagieren auf Inhalt, Ton, Wiederholung und Widersprüche. Dazu kommen Vorteile, die die Community am Original vermisst: offline, ohne Kosten, ohne Latenz, ohne Datenweitergabe ([SD]) |
| Lokale Sprachsynthese (Anruferstimmen) | Kein eigenes TTS-Modell im Bundle möglich (Größe) | **Web Speech API `speechSynthesis`** mit deutschen Systemstimmen, Tonhöhe und Tempo je Figur; Fallback **Brabbel-Synthese** (Web Audio, figurenspezifisch) | Jede Figur hat eine eigene, wiedererkennbare Stimme, auch ohne Systemstimmen |
| Lokale Spracherkennung (Spielerstimme) | `SpeechRecognition` gibt es nicht überall; Chrome nutzt dafür einen Server | Push-to-talk mit `SpeechRecognition` (de-DE), wo verfügbar; immer zusätzlich **Tippen** und **Schnellantwort-Karten**; robuste Unscharf-Erkennung gegen Hörfehler | Sprechen geht dort, wo der Browser es kann. Wer nicht sprechen kann oder will, verliert nichts (am Original kritisiert: Mikrofonzwang) |
| Voice-Cloning per WAV (Mods) | Echtes Klonen braucht ML-Modelle und Server | WAV-Probe → Tonhöhe und Klang analysieren → **Sample-basierte Brabbel-Stimme** plus Anpassung der TTS-Parameter | Eigene Persönlichkeit mit eigener, erkennbarer Stimme bleibt möglich |
| First-Person-3D-Büro | 3D mit Maus-Blick ist auf Touch umständlich, schwer bei 60 FPS auf Mittelklasse-Handys | **Draufsicht in Pixel-Art** (passt zum offiziellen Top-down-Screenshot), Desktop als Vollbild-Ansicht am Platz | Alle Interaktionen (laufen, Plätze, Gegenstände, Gefahren, Streiche) bleiben; besser lesbar auf kleinen Bildschirmen |
| Online-Koop mit Freunden | Braucht Server bzw. Signalisierung (Backend nur nach Rücksprache) | **Lokaler Splitscreen 2–4** (Tastatur und Gamepads) plus **Bot-Kollegen** | Gemeinsames Chaos an einem Bildschirm; Bots füllen Plätze wie fremde Online-Spieler |
| Öffentliche Lobbys | Server nötig | **Lobby-Browser mit Bot-Crews** (Namen, Stil, Schwierigkeit) | Der Zweck „schnell mit anderen loslegen“ bleibt erhalten |
| Raum-Code | Server nötig | **Schicht-Code (Seed)**: gleicher Run auf mehreren Geräten | Freunde teilen einen Code und vergleichen sich, ganz ohne Server |
| Sprachchat unter Spielern | Lokal überflüssig, online Server | **Emote-Rad und Sprechblasen**, Bots „hören mit“ und kommentieren | Kommunikation mit Bots und sichtbare Reaktionen im Büro bleiben |
| Steam-Ranglisten (falls vorhanden) | Server | **Lokale Bestenliste** plus Schicht-Code-Vergleich | – |
| Bildschirmrekorder | Desktop-Capture ist nicht möglich | `canvas.captureStream()` plus Web-Audio-Stream → `MediaRecorder` (WebM bzw. MP4) | Nimmt genau das Spiel auf, wie im Original |

## 7. Online-Features: lokal, ein Backend nur nach Rücksprache

Umgesetzt wird **nur lokal**: Bots, lokaler Splitscreen, Schicht-Codes, lokale Bestenliste. **Es wird kein Server gebaut.**
Diese optionalen Online-Erweiterungen brauchen dein OK, bevor ich sie angehe:

1. **„Echte KI-Anrufer“ (optional):** Wer einen eigenen API-Schlüssel (z. B. OpenRouter oder Anthropic) in den Einstellungen einträgt, lässt die Anrufer-Antworten von einem LLM schreiben. Der Aufruf geht **direkt vom Browser** zum Anbieter, ohne eigenes Backend. Die lokale Engine bleibt Standard und Fallback. Kosten trägt der Schlüssel-Inhaber, der Schlüssel liegt nur lokal.
2. **Online-Koop über WebRTC:** Peer-to-Peer ist möglich, braucht aber einen Signalisierungs-Server (oder umständlichen Austausch von Codes per Copy-and-paste) und in manchen Netzen einen TURN-Server.

## 8. Gesprächs-Engine (Herzstück)

`src/systems/conversation/` – reine Logik ohne Phaser, vollständig mit Vitest getestet.

1. **Eingabe:** Text (getippt, erkannt oder Karte) → Normalisierung (Kleinschreibung, Umlaute, Satzzeichen), Wörter in Grundform (leichtes deutsches Stemming), Unscharf-Abgleich (Damerau-Levenshtein ≤ 1 ab 5 Zeichen, gegen Tipp- und Hörfehler), Zahlen-Erkennung (Ziffern und Zahlwörter wie „vier acht zwei“).
2. **Sprachverständnis (NLU):** gewichtete Lexika und Muster je Absicht (Begrüßen, Rolle behaupten [Bank, Amt, Technik, Familie, Gewinn, Polizei …], Smalltalk, Kompliment, Mitgefühl, Dringlichkeit, Drohung, Beruhigen, Erklären, Fordern [Nummer, Code, Gutschein, Ja-Wort, Klick], Bestätigen, Beleidigen, Unsinn, Entschuldigen, Lachen), Verneinung, Frage oder Aussage, Höflichkeit, Länge, Themen (Vorlieben und Abneigungen des Anrufers, Masche-Begriffe), Nennung seines Namens. Ergebnis ist ein **Merkmalsvektor**.
3. **Persönlichkeitsmodell:** Jede Figur gewichtet die Merkmale anders (Oma Walpurga liebt Omen und Sterne, die Kommandantin will Protokoll und Dienstgrade, Moonboy will Bewunderung für Krypto …). Daraus ergibt sich ΔVertrauen = Σ Gewichte × Merkmale × Phasen-Passung × Abnutzung × Konsistenz × Werkzeug-Boni.
4. **Gedächtnis:** behauptete Rolle, genannte Namen, Versprechen, bereits gesagte Sätze. Widersprüche kosten Vertrauen und lösen Rückfragen aus („Eben waren Sie doch noch von der Bank?!“).
5. **Stimmung als Zustandsautomat mit Trägheit:** Übergänge hängen von Richtung und Stärke der Δ-Werte, vom Temperament und von der Phase ab. Deshalb ist die Stimmung **keine reine Funktion des Prozentwerts** (wie im Original). Die Stimmung bestimmt Antworten, Geduld und Auflege-Grenzen.
6. **Antworten:** Zeilen-Datenbank nach Situation (reagiert positiv bzw. negativ auf Absicht X, verwirrt, themenfremd, zu frühe Forderung, gibt Beute, weigert sich, droht aufzulegen, legt auf, Erfolg) mit Figuren-Überschreibungen, Platzhaltern und **Echo-Bausteinen**, die Schlüsselwörter des Spielers aufgreifen („‚Mondgrundstück‘? Mit Seeblick?“). Nicht-wiederholende Zufallsauswahl.
7. **Beute diktieren:** Der Anrufer nennt Ziffern einzeln, macht Pausen, verhaspelt sich und korrigiert sich („acht… nein, neun“). Nachfragen („Nochmal bitte?“) sind möglich, kosten aber Geduld.
8. **Köder** spiegeln das Modell: Sie geben falsche Beute, schicken Links, verschwenden Zeit. Wer ihre Links annimmt, holt sich einen Virus.
9. **Anti-Exploit:** Abnutzung, Phasen-Passung und figurenspezifische Bedürfnisse verhindern eine Universal-Floskel ([CG]-Kritik).

## 9. Art-Stil

- **Pixel-Art per Code:** Alle Grafiken entstehen beim Start prozedural (Phaser Graphics bzw. Canvas → Texturen). Es gibt keine fremden Bilddateien.
- **Eigene Palette „Schwindel-32“:** warmes Neon-Büro bei Nacht (Senf, Petrol, Altrosa, Kaffeebraun), dicke 1-px-Outlines, Kacheln 16×16, Figuren 16×24.
- **Figuren-Baukasten:** Körper, Kopf, Haut, Haare, Kleidung und Accessoires werden für Spieler, Bots, Chef, Polizei und Anrufer-Porträts (64×64 Büste mit 6 Gesichtsausdrücken) kombiniert.
- **MogelOS:** Parodie eines Retro-OS mit abgeschrägten Fenstern, Pixel-Icons (16×16 und 32×32) und Taskleiste in der Palette.
- **Schrift:** eigene Pixel-Schrift (per Code definierte Glyphen inkl. Umlaute, ß, ₮) für Überschriften, Zahlen und Logo; System-Schrift für lange Texte (Untertitel, E-Mails), damit sie auf Retina scharf und auf dem Handy lesbar bleiben.
- **Effekte:** Partikel, Squash & Stretch, Hit-Stop, Screenshake, Blitze und Zeitlupe; alles abschaltbar bzw. reduzierbar.

## 10. Sound-Stil

- **Alles prozedural mit Web Audio:** eine kleine Synth-Engine (Rechteck, Dreieck, Sägezahn, Rauschen, einfache FM, Hüllkurven, Filter, Hall) und ein Pattern-Sequencer.
- **Musik:** Lo-Fi-Büro-Chiptune mit eigenen Melodien. Titel, Büro (adaptiv: Tempo und Instrumente steigen mit sinkendem Countdown), Bewertung (Trommelwirbel), Rauswurf (traurige Posaune), Casino, Shop-Fahrstuhlmusik, Razzia, Luftangriff. **Warteschleife** als Running Gag mit eigenen Dudel-Melodien und gemeinfreien Klassik-Zitaten.
- **SFX:** für jedes Ereignis aus FEATURES.md §20, mit räumlichem Klingeln (Lautstärke und Panorama nach Abstand zum Telefon).
- **Stimmen:** TTS bzw. Brabbel-Synthese; der Chef brüllt verzerrt.

## 11. Tech-Stack & Architektur

- **Vite + TypeScript (strict)**: schneller Dev-Server, saubere Builds, ESM.
- **Phaser 3 (3.90, letzte und stabilste 3er-Version)**: Szenen, Kameras (Splitscreen), Input inkl. Gamepad, Tweens, Partikel, Kamera-Effekte und Texturerzeugung zur Laufzeit. Gegen Phaser 4 (seit 04/2026) habe ich mich vorerst entschieden, weil 3.90 ausgereift ist, die API sehr gut dokumentiert ist und alle benötigten 2D-Funktionen hat. Ein späterer Umstieg ist dank weitgehend kompatibler API möglich. Gegen three.js spricht die Wahl der Draufsicht (§6).
- **Darstellung:** Canvas in physischer Auflösung (CSS-Größe × devicePixelRatio), Welt-Kameras mit ganzzahligem Zoom und Nearest-Neighbor (scharfe Pixel), Texte in Geräteauflösung.
- **Simulation:** feste Logik-Schritte (60 Hz) mit Akkumulator, Rendering interpoliert, Delta-Time-sicher.
- **UI:** eigenes Fenster- und Widget-Toolkit in Phaser für MogelOS (damit Rekorder, Effekte und Splitscreen alles erfassen). Nur für die Texteingabe dient ein unsichtbares DOM-`<input>` (native Bildschirmtastatur, Autokorrektur aus).
- **Daten:** Anrufer, Maschen, Apps, Gegenstände, Gefahren, Zeilen und Texte als JSON bzw. TS-Datenmodule in `src/data/`, validiert per Schema (dieses Format nutzen auch die Mods).
- **Speicherung:** localStorage (Einstellungen), IndexedDB (Run, Statistiken, Bilder, Videos, Mods).
- **PWA:** `vite-plugin-pwa` (Workbox, Precache aller Dateien → offline), Manifest, per Code erzeugte Pixel-Art-Icons (eigener PNG-Encoder im Build-Skript).
- **Tests:** Vitest (Logik), Playwright mit vorinstalliertem Chromium (Desktop 1280×720 und 1920×1080, Handy quer und hoch, Touch-Emulation), Test-Hook `window.__MASCHE__` nur im Test-Build für Input-Simulation und Zustandsabfrage; Headless-Simulation ganzer Tage in Vitest fürs Balancing.

**Ordnerstruktur**
```
src/
  main.ts
  config/      tuning.ts, input-defaults.ts, palette.ts, layout.ts
  data/        callers/, schemes/, apps.ts, items.ts, hazards.ts, lines/, texts/de.json, bots.ts
  scenes/      Boot, Title, Lobby, Office, Desktop(OS), Review, Termination, Settings, ModWorkshop, Gallery
  entities/    Player, Bot, Boss, Police, Desk, Phone, Item, Missile, Fire, Pigeon …
  systems/     conversation/ (nlu, personality, mood, memory, lines), day/, economy/, hazards/,
               input/, save/, mods/, recorder/, rng/, bots/
  ui/          os/ (window manager, taskbar, widgets), apps/ (eine Datei pro App), hud/, touch/
  audio/       synth.ts, sequencer.ts, music/, sfx.ts, tts.ts, stt.ts, babble.ts
  gfx/         palette, pixel font, character builder, tiles, icons
tests/         unit/ (vitest), e2e/ (playwright)
scripts/       gen-icons.ts
docs/          RESEARCH.md, FEATURES.md, GAME_DESIGN.md, PARITY.md
```

## 12. Meilenstein-Plan (deckt FEATURES.md vollständig ab)

Nach jedem Meilenstein: Build, Typecheck, Vitest, Playwright-Screenshots (Desktop und Handy) ansehen, FEATURES.md abhaken, CLAUDE.md aktualisieren, Commit und Push.

| # | Meilenstein | Inhalt (FEATURES-IDs) |
|---|---|---|
| **M0** | Fundament | Projekt-Setup, Ordnerstruktur, Config, Input-Schicht mit Geräte-Erkennung, Viewport, Safe Areas, Vollbild, Ausrichtungs-Hinweis, Auto-Pause, Fixed-Step-Loop, Pixel-Font, Palette, Titelbild, PWA-Grundgerüst, Icons, Vitest und Playwright, CI-Workflow, CLAUDE.md (TEC-01–10, TEC-15, CTL-01/02, MEN-01, PLT-01/06, QA-01–03) |
| **M1** | Büro | Kachel-Büro mit 8 Plätzen, Chefbüro, Möbeln und Objekten, Spielerfigur, Kollision, Interaktion, Hinsetzen/Aufstehen, Touch-Joystick und -Buttons, Büro-HUD (OFF-01–03, 16, 17, 20, PLT-02, CTL-03, 08, 09, 13, HUD-01) |
| **M2** | MogelOS | Fenstermanager, Taskleiste (Geld, Team, Quota, Countdown), Startmenü, Toasts, System-Apps, Pause (OS-01–06, 09, 11, 13, 14, APP-47–49, 52, 54, PLT-03, CTL-04, 10, MEN-03) |
| **M3** | Anrufe & Gespräche | Klingeln, Popup, Telefon-App, Sprachverständnis, 24 Persönlichkeiten, Vertrauen und Stimmung, Gedächtnis, Abnutzung, TTS, STT, Brabbeln, Untertitel, Karten, Warteschleife, Notizblock, Porträts (CAL-01–25, NPC-01–26, APP-01, 08, HUD-02, 04, AUD-07, CTL-11, PLT-04/05, MEN-05, FUN-02) |
| **M4** | Maschen | 16 Maschen und ihre Apps, Ident-o-Mat, Kundenkartei, FernGucker mit Opfer-PC, Plauderbude, Gutschein-Kasse, Auszahlungen (SCH-01–22, APP-02–05, 11–26) |
| **M5** | Tag & Run | Countdown, Quota-Formel, Ausstempeln, Chef (KI, Wut, Kontrollgänge), Bewertung mit 3 Momenten, Freischaltungen, Tacker, Rauswurf, Kündigungsbericht, Bestenliste, Statistiken, Speichern und Fortsetzen (DAY-01–15, PRG-01–07, MOD-04/05/07, OS-07/10, APP-07, 10, 53, TEC-12, FUN-01, COP-09) |
| **M6** | Wirtschaft | Ramschazon (alle Kategorien und Gegenstände), Inventar, Lieferung, Glücksbit (5 Spiele), Spiele-Apps, Business-Apps, Netzlupe, Streiche (SHP-01–25, CAS-01–08, APP-27–35, 37–42, 50, OFF-05, 06, 19, 21, CTL-12, FUN-03/04) |
| **M7** | Gefahren | Viren und Effekte, Monitorbrand, Razzia (Fahndungsdruck, Durchsuchung, Arrest), Luftangriffe, Konkurrenz-Callcenter, 7 Büro-Katastrophen, Reparieren, Boss-Taste (HAZ-01–17, OFF-07–09, 12–14, 22, NPC-10/11, OS-12, APP-36, HUD-03) |
| **M8** | Koop & Bots | Bot-KI und -Persönlichkeiten, Lobby und Lobby-Browser, Schicht-Code, Figur-Editor, Splitscreen 2–4, Emotes, Mithören, Plätze übernehmen, Team-Funk (COP-01–08, MOD-01–03, 06, OFF-18, APP-06, CAL-21, HUD-06) |
| **M9** | Kreativ & Analyse | Kritzel, Knipser (Selfie), Mitschnitt (Video), Galerie, Gesprächsanalyse-Beamer, Drucker und Pinnwand (CRE-01–06, APP-09, 43–46, OFF-04, 10, 11) |
| **M10** | Mods & Tutorial | Mod-Werkstatt (JSON, WAV-Stimme, Editor, Testanruf), Einarbeitungstag, Kontext-Tipps, Einarbeitungsmappe (MOD-M1–M5, TUT-01, 02, 04, APP-55) |
| **M11** | Juice, Audio, Optionen | Musik und alle SFX, Game Juice komplett, Vibration, Einstellungen komplett, Tastatur- und Gamepad-Belegung, Touch-Layout-Editor, QoL-Optionen, Achievements, Easter Eggs, Extra-Modi, Radio-App (AUD-01–09, JCE-01–08, MEN-02, 04, 06–12, CTL-05–07, 14, PLT-07, QOL-01–10, PRG-08, FUN-05/06, EXT-01/02, OFF-15, TUT-03, APP-51, HUD-05) |
| **M12** | Politur & Release | Offline-Service-Worker, Performance (60 FPS, Pools, Heap-Tests), Balancing per Playtest-Simulation, Touch-Abgleich aller Aktionen, README, GitHub-Pages-Workflow, Paritäts-Bericht, Endabgleich FEATURES.md (TEC-11, 13, 14, CTL-15, QA-04–07, FIN-01–05) |

## 13. Inhaltliche Leitplanken

- **Alles ist fiktiv und absurd:** Mondgrundstücke, Pinguinprinzen, Goldfischsteuer. Die Maschen funktionieren nur innerhalb der Spielwelt und taugen nicht als Anleitung (keine realistischen Skripte, keine echten Firmen- oder Behördennamen, fiktive Datenformate).
- Der Humor richtet sich gegen die Täter und das System (Brülling, Bürokratie, Absurdität) und nicht gegen reale Gruppen. Das fiktive Schwindelheim ersetzt das reale Setting des Originals bewusst, damit keine Klischees über reale Orte entstehen.
- Gewalt bleibt Cartoon-Slapstick (Ruß-Gesichter, Schaumpfeile, Purzeln).
- Im Titel steht „Alles fiktiv. Alles erfunden.“ In den Credits gibt es kurze Echte-Welt-Tipps gegen echte Maschen (+).

## 14. Offene Punkte (deine Entscheidung)

1. Titel **„Masche & Co.“** und Sprache **Deutsch** – passt das?
2. Optionale Online-Erweiterungen aus §7 (eigener KI-Schlüssel, WebRTC-Koop): jetzt weglassen (Standard) oder einplanen?
3. Den alten Prototyp `masche.html` im Repo ersetze ich durch das neue Projekt. Einverstanden?
4. GitHub Pages: Unter *Settings → Pages* muss als Quelle „GitHub Actions“ gewählt sein. Den Workflow liefere ich.

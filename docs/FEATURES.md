# FEATURES.md – Feature-Inventar „Masche & Co.“

Browser-Umsetzung von **„Scam With Your Friends“** (JakeHub & Metater, Jatater Worldwide) mit vollständiger Feature-Parität.
Diese Liste ist der Maßstab: **Das Spiel ist erst fertig, wenn jeder Eintrag abgehakt ist.** Abgehakt wird nur, was im laufenden Spiel vorhanden ist und getestet funktioniert.

Recherche und Quellen: [`docs/RESEARCH.md`](RESEARCH.md). Design und Ersatzlösungen: [`docs/GAME_DESIGN.md`](GAME_DESIGN.md).

## Legende

| Kürzel | Bedeutung |
|---|---|
| `[ ]` / `[x]` | offen / umgesetzt **und** getestet |
| **O** | im Original belegt (Quelle in eckigen Klammern, IDs siehe RESEARCH.md) |
| **O?** | im Original nur durch eine unsichere Einzelquelle belegt |
| **E** | gleichwertiger Ersatz für etwas, das im Browser nicht 1:1 geht (Begründung in GAME_DESIGN.md §6) |
| **D** | Die Kategorie ist im Original belegt, Details sind aber unveröffentlicht. Die Lücke ist per Design gefüllt (GAME_DESIGN.md §5) |
| **A** | Anforderung aus dem Projektauftrag (Plattform, Technik, Qualität) |
| **+** | Ergänzung (optional, abschaltbar oder Extra-Modus; das Original-Verhalten bleibt Standard) |
| `M#` | Meilenstein, in dem der Eintrag umgesetzt wird (GAME_DESIGN.md §12) |

## 0. Namens-Zuordnung (Original → eigene Version)

Mechanik, Zweck und Funktion bleiben gleich. Namen, Figuren, Grafik, Texte und Musik sind eigene Versionen.

| Original | Masche & Co. |
|---|---|
| Scam With Your Friends | **Masche & Co.** – „Das Callcenter-Chaos mit Freunden“ |
| Callcenter in Kolkata, Indien | Hinterhof-Callcenter im fiktiven **Gewerbehof Schwindelheim** |
| Kolkata OS | **MogelOS** |
| „rageaholic boss“ | **Direktor Horst Brülling** |
| Caller Trust / Mood | **Vertrauen** (%) und **Stimmung** |
| Social Security Stealer / Identity-App / SSN | **Rentennummer-Raffer** / **Ident-o-Mat** / **Bürgernummer** (fiktives Format) |
| AnyViewer / Verbindungscode | **FernGucker** / **Guck-Code** |
| Customer Info | **Kundenkartei** |
| Disscord / Nitro-Geschenk | **Plauderbude** / **Turbo-Geschenk** |
| Scamazon Market | **Ramschazon** |
| Rainbit (Casino) | **Glücksbit** |
| Bear Mace / Remote-Work Sniper / Raketenhagel | **Bärenspray Deluxe** / **Homeoffice-Scharfschütze** / **Raketenhagel** |
| Clock Out | **Ausstempeln** |
| Performance Review | **Leistungsbewertung** |
| Call Analysis (Wandprojektion) | **Gesprächsanalyse** (Beamer) |
| Kolkata Termination Report | **Kündigungsbericht Schwindelheim** |
| Scambaiter | **Köder** |
| $ | **Taler (₮)** |
| Dorothy Mayfield · Eleanor „Granny“ Grimshaw · Cmdr. Miles „Orbit“ Vega · Franklin D. Hyper · Brittany „Lexi“ Summers · Damien Holloway · Shanice „Dee“ Bishop | Hildegard Sonnenschein · Oma Walpurga Krähenfuß · Kommandantin Stella „Komet“ Nebel · Maximilian „Moonboy“ Hypeberg · Chantal „Chanti“ Glitzer · Dietmar Grauwald · Desirée „Didi“ Bischof |

---

## 1. Plattformen & Steuerung des Originals (Referenz)

- [ ] **PLT-01** Windows-PC-Spiel mit Maus und Tastatur → bei uns Desktop-Browser mit frei belegbarer Tastatur und Maus. *O [ST][FN]* · M0/M11
- [x] **PLT-02** First-Person-Bewegung durchs Büro → bei uns Draufsicht-Büro mit Laufen per WASD, Joystick oder Stick. *O [ST-Tags], E* · M1
- [x] **PLT-03** Ingame-Desktop per Maus bedienen → bei uns per Maus, Touch oder Gamepad-Fokusnavigation. *O [FN]* · M2
- [x] **PLT-04** Mit Anrufern sprechen per Mikrofon (Tag „Voice Control“) → bei uns Spracheingabe, wo der Browser sie kann. *O [ST][FN], E* · M3
- [x] **PLT-05** Text-Eingabe als Alternative zur Stimme. *O? [XB-ähnlich, FN-faq unklar], E* · M3
- [ ] **PLT-06** Läuft zusätzlich auf Handy und Tablet (Touch) und ist als App installierbar. *A* · M0/M12
- [ ] **PLT-07** Gamepad-Unterstützung. *A* · M11

## 2. Spielstruktur & Modi

- [ ] **MOD-01** Einzelspieler: allein im Büro wie im Original, Bot-Kollegen optional zuschaltbar. *O [ST]* · M5/M8
- [ ] **MOD-02** Koop mit Freunden → bis M12 lokaler Multiplayer: Splitscreen mit 2–4 Menschen an einem Gerät **nur auf Desktop und Tablet**, auf dem Handy Solo mit Bot-Kollegen. Online-Koop folgt in M14 (§29). *O [ST], E* · M8
- [ ] **MOD-03** Öffentliche Lobbys → Lobby-Browser mit Bot-Crews (Namen, Stil, Schwierigkeit) zum „Beitreten“; echte Online-Lobbys werden in M14 geprüft. *O [ST], E* · M8
- [ ] **MOD-04** Run-basierte Progression: Ein Run besteht aus aufeinanderfolgenden Arbeitstagen und endet beim Rauswurf. *O [IG][ST]* · M5
- [ ] **MOD-05** Perma-Death: Rauswurf = Run vorbei, kein Weiterspielen des Runs. *O [ST-Tag]* · M5
- [ ] **MOD-06** Raum-Code → Schicht-Code (Seed) zum Teilen: Freunde spielen denselben Run auf ihren Geräten und vergleichen in der lokalen Bestenliste. *E* · M8
- [ ] **MOD-07** Spielstand-Fortsetzung: Ein laufender Run wird zwischen den Tagen automatisch gespeichert (Browser kann jederzeit geschlossen werden). *A/D* · M5

## 3. Büro (Spielwelt)

- [x] **OFF-01** Begehbares Callcenter-Büro (Draufsicht, Pixel-Art), passend zum offiziellen Top-down-Screenshot. *O [FN], E* · M1
- [x] **OFF-02** Bis zu 8 Arbeitsplätze mit Monitor, Telefon und Headset (der offizielle Screenshot zeigt 8 Spieler). *O [FN-faq]* · M1
- [x] **OFF-03** Chefbüro mit Glaswand, Schreibtisch des Chefs und Bewertungs-Bereich. *D* · M1/M5
- [ ] **OFF-04** Beamer-Wand für die Gesprächsanalyse. *O [FN]* · M9
- [ ] **OFF-05** Lieferklappe bzw. Paketablage für Ramschazon-Lieferungen. *D* · M6
- [ ] **OFF-06** Kaffeemaschine (Kaffee-Boost, kann explodieren). *D* · M6/M7
- [ ] **OFF-07** Wasserspender (kann auslaufen). *D* · M7
- [ ] **OFF-08** Sicherungskasten (Stromausfall beheben). *D* · M7
- [ ] **OFF-09** Router-Schrank (Internetausfall beheben). *D* · M7
- [ ] **OFF-10** Drucker (Kritzel-Bilder drucken, Druckerstau-Gag). *+* · M9
- [ ] **OFF-11** Pinnwand, an die gedruckte Bilder gehängt werden. *+* · M9
- [ ] **OFF-12** Fenster zur Straße mit Blick aufs Konkurrenz-Callcenter gegenüber (Ziel und Quelle von Raketenhagel und Scharfschütze). *O [FN], D* · M7
- [ ] **OFF-13** Aktenvernichter und Aktenschrank (Beweise bei einer Razzia). *D* · M7
- [ ] **OFF-14** Arrestzelle bzw. „Stille Treppe“ für Festgenommene bis zum Tagesende oder zur Kaution. *D* · M7
- [ ] **OFF-15** Topfpflanze „Ferdinand“ (Running Gag, Easter Egg). *+* · M11
- [x] **OFF-16** Spielerfigur läuft (Delta-Time, Beschleunigung, Kollision mit Möbeln). *O, E* · M1
- [x] **OFF-17** Hinsetzen bzw. Aufstehen am Schreibtisch, dabei wechselt die Ansicht zum MogelOS-Desktop. *O [FN]* · M1/M2
- [ ] **OFF-18** Fremde Schreibtische übernehmen, z. B. wenn ein Kollege k. o. oder abwesend ist. *O? [XB], D* · M8
- [ ] **OFF-19** Gegenstände aufheben, tragen, benutzen, werfen und ablegen. *D* · M6
- [x] **OFF-20** Interaktions-Hinweise an Objekten (Taste oder Touch-Button kontextabhängig). *A* · M1
- [ ] **OFF-21** Büro-Streiche (Furzkissen, Bananenschale, Konfetti, Kollegen-Monitor verdrehen). *O [SM „cause chaos around the office“], D* · M6
- [ ] **OFF-22** Physik-Gag: Umgeworfene Spieler purzeln und stehen nach einem Moment wieder auf (Cartoon-k.o., keine Gewalt-Darstellung). *D* · M7

## 4. MogelOS (Ingame-Desktop) & Taskleiste

- [x] **OS-01** Eigener Ingame-Desktop „MogelOS“ mit Icons, Fenstern, Startmenü und Hintergrund. *O [FN „Kolkata OS“]* · M2
- [ ] **OS-02** Mehr als 45 Apps (wir: 55, siehe §8). *O [FN]* · M2–M9
- [x] **OS-03** Taskleiste zeigt persönliches Guthaben. *O [FN]* · M2
- [x] **OS-04** Taskleiste zeigt die Team-Summe. *O [FN]* · M2
- [x] **OS-05** Taskleiste zeigt die Quota. *O [FN]* · M2
- [x] **OS-06** Taskleiste zeigt den Countdown bis zur Leistungsbewertung. *O [FN]* · M2
- [ ] **OS-07** Ausstempeln-Taste in der Taskleiste, aktiv sobald die Quota erreicht ist. *O [FN]* · M5
- [x] **OS-08** Popup bei eingehendem Anruf mit Name und Bild des Anrufers. *O [FN]* · M3
- [x] **OS-09** Fenstermanager: öffnen, schließen, fokussieren, verschieben (Desktop), minimieren. Auf dem Handy laufen Apps im Vollbild mit App-Umschalter. *A/E* · M2
- [ ] **OS-10** Gesperrte Apps sind sichtbar (Schloss plus „ab Tag X“ bzw. „im Ramschazon“). *D* · M5
- [ ] **OS-11** Benachrichtigungen (Toasts): Lieferung da, App freigeschaltet, Chef-Mail, Virus. *D* · M2 (System und Chef-Mail seit M2, „Notiert!“ bei erfasster Beute seit M3; Lieferung, Freischaltung und Virus mit M5–M7)
- [ ] **OS-12** Boss-Taste: wechselt den Bildschirm sofort zu einer harmlosen Tabellenkalkulation (hilft bei Razzia und Chef-Kontrolle). *D* · M7
- [x] **OS-13** Desktop-Hintergrund und Theme änderbar (Systemsteuerung). *D* · M2
- [ ] **OS-14** Aufstehen bzw. Desktop verlassen jederzeit möglich, laufende Anrufe gehen weiter (Kollege kann übernehmen). *D* · M2/M8 (Aufstehen jederzeit seit M2; laufende Anrufe gehen seit M3 weiter und werden beim Hinsetzen fortgesetzt; Übernahme durch Kollegen M8)

## 5. Anrufe & Gesprächssystem

- [x] **CAL-01** Eingehende Anrufe kommen zufällig an die Arbeitsplätze, klingeln hörbar und sichtbar (räumlicher Klang im Büro). *O [FN], D* · M3
- [x] **CAL-02** Abnehm-Fenster: Nach 30 s ohne Abnehmen legt der Anrufer auf bzw. wird verpasst. *D (Referenzwert [XB])* · M3
- [x] **CAL-03** Telefon-App mit Mikrofon-Taste, Lautsprecher-Taste, Auflegen, Halten (Warteschleife) und Texteingabe. *O [FN]* · M3
- [x] **CAL-04** Freies Gespräch: Der Spieler formuliert frei (tippen oder sprechen), der Anrufer reagiert auf den Inhalt und nicht auf eine Dialogauswahl. *O [CG], E (lokale Sprach-KI statt Cloud-LLM)* · M3
- [x] **CAL-05** Lokales Sprachverständnis: erkennt Absichten (Begrüßen, Vorstellen als Rolle, Smalltalk, Kompliment, Mitgefühl, Dringlichkeit, Drohung, Beruhigen, Erklären, Fordern, Bestätigen, Beleidigen, Unsinn, Entschuldigen, Lachen, Themen und Schlüsselwörter des Anrufers). *E* · M3
- [x] **CAL-06** Schnellantwort-Karten (vorgeschlagene Sätze passend zur Lage), verarbeitet wie freie Eingaben. **Auf dem Handy die Hauptsteuerung** (immer sichtbar, Freitext und Sprache optional zuschaltbar); auch für Gamepad und ohne Tastatur. *E* · M3
- [x] **CAL-07** Vertrauens-Anzeige als Prozentwert plus Stimmungs-Label. *O [FN]* · M3
- [x] **CAL-08** Stimmung ist ein eigener Zustand und kein reiner Prozent-Schwellwert, z. B. „Vertrauensvoll“ bei 65 %, „Wütend“ bei 50 %. *O [FN]* · M3
- [x] **CAL-09** Stimmungen: Vertrauensvoll, Neutral, Misstrauisch, Verwirrt, Amüsiert, Genervt, Wütend, Ängstlich, Gelangweilt. *O (2 belegt), D (Rest)* · M3
- [x] **CAL-10** Bricht das Vertrauen ein (0 % bzw. Wut-Grenze), legt der Anrufer auf. *O [FN]* · M3
- [x] **CAL-11** Vertrauen erst aufbauen, dann nach Sensiblem fragen: Wer zu früh fordert, verliert stark. *O [FN-Tutorial]* · M3
- [x] **CAL-12** Gedächtnis des Anrufers: Widersprüche (erst „Bank“, dann „Enkel“) erzeugen Misstrauen, gemerkte Namen und Details erzeugen Vertrauen. *E (LLM-Kontext)* · M3
- [x] **CAL-13** Abnutzung: Dieselbe Floskel wirkt mit jeder Wiederholung schwächer, es gibt keinen Satz, der immer funktioniert. *E (gegen die Kritik aus [CG])* · M3
- [x] **CAL-14** Gesprächsphasen pro Masche: Einstieg → Vertrauen → Pitch → Forderung → Beute → Abschluss. *O [FN-htp], D* · M4
- [x] **CAL-15** Anrufer nennt die Beute (Nummer oder Code) im Gespräch, Ziffer für Ziffer, auch mit Versprechern und Korrekturen; der Spieler muss mitschreiben. *O [FN „confirming a number back“]* · M4
- [x] **CAL-16** Anrufer-Stimmen per Sprachsynthese, eigene Stimme je Persönlichkeit (Tonhöhe, Tempo, Stimmwahl). Fallback ist eine synthetische „Brabbel“-Stimme. *O [SD lokale TTS], E* · M3
- [x] **CAL-17** Spracherkennung der Spielerstimme (Push-to-talk), wo der Browser sie unterstützt. Live-Untertitel des Erkannten. *O [SD lokale STT], E* · M3
- [x] **CAL-18** Untertitel für alles, was Anrufer sagen (Schreibmaschinen-Effekt). *A* · M3
- [x] **CAL-19** Gesprächs-Timer und Geduld: Anrufer werden ungeduldig, wenn man schweigt oder lange hält. *D* · M3
- [x] **CAL-20** Warteschleife: Halten mit Wartemusik (Running Gag). Zu langes Halten führt zum Auflegen. *D* · M3/M11
- [ ] **CAL-21** Proximity: Kollegen und Bots in der Nähe „hören“ Gesprächsfetzen (Sprechblasen) und kommentieren sie. *E (Sprachchat)* · M8
- [x] **CAL-22** Alle Gesprächszeilen werden für Gesprächsanalyse und Bewertung protokolliert. *O [FN]* · M3/M9
- [ ] **CAL-23** Schwierigkeit pro Tag: härtere Anrufer und mehr Köder an späteren Tagen. *D* · M5
- [x] **CAL-24** Anrufer kann zurückschlagen: will einem seinen eigenen Coin andrehen, beleidigt einen, droht mit Polizei oder Sohn-Anwalt. *O [FN Franklin D. Hyper], D* · M3
- [x] **CAL-25** Mehrere Anrufe gleichzeitig im Büro (pro Arbeitsplatz einer). Unbesetzte Telefone klingeln weiter. *D* · M3/M8

## 6. Anrufer (Persönlichkeiten)

Jede Persönlichkeit ist datengetrieben (`src/data/callers/`) mit Pixel-Porträt, Stimme, Start-Vertrauen, Leichtgläubigkeit, Vorlieben und Abneigungen (Schlüsselwörter), Lieblings- und Hass-Maschen, Sprüchen, Beute-Daten und Eigenheiten.

- [x] **NPC-01** **Hildegard Sonnenschein**: ältere Dame, kooperativ, leichtgläubig, liest Nummern sorgfältig vor. *O (≈ Dorothy Mayfield) [FN]* · M3
- [x] **NPC-02** **Oma Walpurga Krähenfuß**: Hexenhut, abergläubisch, deutet Zahlen als Omen, fürchtet Unglück beim Vorlesen. *O (≈ Granny Grimshaw) [FN]* · M3
- [x] **NPC-03** **Kommandantin Stella „Komet“ Nebel**: Astronautin, will alles nach Protokoll, bevor sie ihren Guck-Code nennt. *O (≈ Cmdr. „Orbit“ Vega) [FN]* · M3
- [x] **NPC-04** **Maximilian „Moonboy“ Hypeberg**: Sonnenbrille, Beleidigungen, will einem den eigenen „HypeCoin“ andrehen. *O (≈ Franklin D. Hyper) [FN]* · M3
- [x] **NPC-05** **Chantal „Chanti“ Glitzer**: Influencerin, explodiert schnell, man muss sich entschuldigen. *O (≈ Brittany „Lexi“ Summers) [FN]* · M3
- [x] **NPC-06** **Dietmar Grauwald**: völlig unbeeindruckt, trocken, schwer zu knacken. *O (≈ Damien Holloway) [FN]* · M3
- [x] **NPC-07** **Desirée „Didi“ Bischof**: Anruferin aus dem Anruf-Popup, als vollwertige Gesprächspartnerin ausgebaut. *O (≈ Shanice „Dee“ Bishop) [FN], D* · M3
- [ ] **NPC-08** **Köder Kevin**: Scambaiter, verschwendet Zeit mit endlosen Rückfragen und schickt Virus-Links. *O (Scambaiter) [ST][FN]* · M3/M7 (seit M3 im Spiel: Rückfragen, falsche Beute, „lustige Links“ als Sprüche; echter Virus über FernGucker mit M7)
- [ ] **NPC-09** **Opa Trollinger**: Scambaiter, spielt den Leichtgläubigen und dreht den Spieß um (schickt einen Virus über FernGucker). *O (Scambaiter), D* · M3/M7 (seit M3 im Spiel: spielt den Leichtgläubigen, gibt falsche Beute; Virus über FernGucker mit M7)
- [ ] **NPC-10** **Undercover-Ermittlerin „Frau Müller“**: Wer ihr eine Masche erzählt, erhöht den Fahndungsdruck stark (Razzia-Auslöser). *D* · M7
- [ ] **NPC-11** **Konkurrenz-Spitzel Ronny Rival**: Anrufer vom Callcenter gegenüber, will Kunden abwerben oder Daten klauen. *D (Rivalen [FN])* · M7
- [x] **NPC-12** **Prof. Dr. Ottokar Besserwisser**: korrigiert Grammatik, liebt Fachbegriffe. *D* · M3
- [x] **NPC-13** **Bauer Hinnerk Rübsam**: Plattdeutsch-Brocken, misstraut Technik, liebt seine Kühe. *D* · M3
- [x] **NPC-14** **Jacqueline Schnatterbeck**: redet ununterbrochen, Klatsch. *D* · M3
- [x] **NPC-15** **Gerd Gemütlich**: schläfrig, sehr langsam, schläft mitten im Gespräch ein. *D* · M3
- [x] **NPC-16** **Zoe Zockerlein**: Gamer-Teenie, will Skins, kennt alle Maschen aus Videos. *D* · M3
- [x] **NPC-17** **Pfarrer Benedikt Sanftmut**: gutherzig, moralisch, vergibt alles außer Lügen über Gott und Welt. *D* · M3
- [x] **NPC-18** **Detlef Dauerbeschwerde**: beschwert sich über alles, verlangt den Vorgesetzten. *D* · M3
- [x] **NPC-19** **Lady Henrietta von Protz**: reich, snobistisch, mag nur Exklusives. *D* · M3
- [x] **NPC-20** **Agnes Argwohn**: Verschwörungstheoretikerin, glaubt alles, nur nicht das Naheliegende. *D* · M3
- [x] **NPC-21** **Bodo Bizeps**: Fitness-Typ, „Bro“, motivierbar über Gains. *D* · M3
- [x] **NPC-22** **Rosi Rentenglück**: frisch verrentet, endlich Zeit, liebt Kreuzfahrten. *D* · M3
- [x] **NPC-23** **Dr. Igor Dunkelstein**: exzentrischer Erfinder, will Teile für seine Zeitmaschine. *D* · M3
- [x] **NPC-24** **Familie Krawallski**: Anruf auf Lautsprecher, drei Leute reden durcheinander. *D* · M3
- [x] **NPC-25** Zufällige Varianten pro Anruf (Tagesform, Laune, Hintergrundgeräusch, Beute-Daten), damit sich Anrufe nicht wiederholen. *E (LLM-Vielfalt)* · M3
- [x] **NPC-26** Prozedural erzeugte Pixel-Porträts mit Gesichtsausdruck je Stimmung. *A* · M3

## 7. Maschen (Scams)

Jede Masche ist datengetrieben (`src/data/schemes/`): Pitch-Themen, nötige Beute, Abschluss-App, Auszahlung, Freischaltung, passende und unpassende Anrufertypen. Alle Maschen sind absurd und fiktiv, fiktive Datenformate sind Pflicht.

- [x] **SCH-01** **Rentennummer-Raffer**: Bürgernummer erfragen und in den Ident-o-Mat eingeben, Auszahlung 250 ₮. Ab Tag 1. *O (Social Security Stealer, 250 $) [FN]* · M4
- [x] **SCH-02** **FernGucker-Support**: Guck-Code erfragen, per FernGucker auf den PC des Anrufers, dort die „Überweisung“ als Minispiel ausführen, während der Anrufer kommentiert. Ab Tag 3. *O (AnyViewer remote-support scam) [FN]* · M4 *Hinweis: Die Freischaltung erst ab Tag 3 kommt mit den Arbeitstagen (SCH-21, M5); bis dahin ab Tag 1 verfügbar.*
- [x] **SCH-03** **Turbo-Geschenk**: über die Plauderbude ein gefälschtes „Turbo-Geschenk“ schicken, der Anrufer muss es annehmen und seinen Login-Code vorlesen. *O (Disscord Nitro gift) [FN]* · M4
- [x] **SCH-04** **Gutschein-Gaudi**: Der Anrufer kauft Gutscheine und liest die Codes vor, Eingabe in die Gutschein-Kasse. *D* · M4
- [x] **SCH-05** **Enkel im Orbit**: „Ihr Enkel steckt auf der Raumstation fest“, Rückflugticket bezahlen. *D* · M4
- [x] **SCH-06** **Mondmakler**: Grundstück auf der Mondrückseite verkaufen. *D* · M4
- [x] **SCH-07** **Pinguinprinz**: Erbschaft eines Pinguin-Königshauses, Bearbeitungsgebühr. *D* · M4
- [x] **SCH-08** **Atlantis-Lotto**: Gewinn in der Unterwasser-Lotterie, „Tauchgebühr“. *D* · M4
- [x] **SCH-09** **Toaster-Doktor**: „Ihr Toaster hat einen Virus“, Fernwartung per FernGucker. *D* · M4
- [x] **SCH-10** **Goldfisch-Finanzamt**: Nachzahlung der Goldfischsteuer, Bürgernummer plus Gutschein. *D* · M4
- [x] **SCH-11** **Luftgitarren-Abo**: Abofalle, der Anrufer muss dreimal „Ja“ sagen (Ja-Wort wird mitgeschnitten). *D* · M4
- [x] **SCH-12** **Zeitreise-Police**: Versicherung gegen gestern. *D* · M4
- [x] **SCH-13** **SchwindelCoin**: eigener Krypto-Coin, Anrufer kauft ein (Gegenstück zu Moonboys HypeCoin). *D* · M4
- [x] **SCH-14** **Wunderwasser**: Heilwasser gegen Montage. *D* · M4
- [x] **SCH-15** **Promi-Dinner**: Abendessen mit dem Schlagerstar „Heino Hallodri“ gewonnen, Platzgebühr. *D* · M4
- [x] **SCH-16** **Büroklammer-Rettung**: Spendenaufruf für bedrohte Büroklammern. *D* · M4
- [x] **SCH-17** Maschen-Auswahl vor bzw. während des Anrufs (Skript-App öffnen), passende Masche je Anrufer erhöht die Erfolgschance. *O [FN „pick a scheme“]* · M4
- [x] **SCH-18** Leitfaden je Masche: Stichpunkte, Tipps und Fortschrittsbalken der Phasen. *D* · M4
- [x] **SCH-19** Auszahlung geht auf das persönliche Guthaben und auf die Team-Summe. *O [FN]* · M4
- [x] **SCH-20** Falsche Eingabe (vertippte Nummer) lässt die Masche scheitern oder erfordert Nachfragen (Vertrauensverlust). *D* · M4
- [ ] **SCH-21** Maschen werden „immer absurder“: Freischaltung in Stufen über Tage und Ramschazon. *O [ST]* · M5/M6
- [x] **SCH-22** Opfer-PC beim Fernzugriff: prozedural erzeugter Desktop mit Dateien, Ordnern und Bank-App. Verdächtige Klicks kosten Vertrauen („Was machen Sie mit meiner Maus?!“). *O [FN AnyViewer], D* · M4

## 8. Apps (55 – Original: „mehr als 45“)

Belegte Original-Apps sind mit **O** markiert. Die übrigen Apps füllen die belegte Anzahl mit eigenen, funktionalen Apps.

**Arbeit**
- [x] **APP-01** Telefon. *O* · M3
- [x] **APP-02** Ident-o-Mat (Bürgernummer prüfen und eintragen). *O (Identity)* · M4
- [x] **APP-03** Kundenkartei (Hobbys, Familie, Vorlieben der Anrufer, gibt Hinweise für Vertrauen). Ab Tag 3. *O (Customer Info)* · M4 *Hinweis: Freischaltung ab Tag 3 siehe SCH-21 (M5).*
- [x] **APP-04** FernGucker (Guck-Code eingeben, Opfer-PC fernsteuern). Ab Tag 3. *O (AnyViewer)* · M4 *Hinweis: Freischaltung ab Tag 3 siehe SCH-21 (M5).*
- [x] **APP-05** Plauderbude (Messenger, Turbo-Geschenk-Masche, Spam von „Freunden“). *O (Disscord)* · M4
- [ ] **APP-06** Team-Funk (Team-Chat, Emotes, Ping auf Orte, Bot-Kommentare). *E (Sprachchat)* · M8
- [ ] **APP-07** Postfach (Chef-Mails, Tagesziele, Freischaltungen, Lieferscheine, Spam). *D* · M5
- [x] **APP-08** Notizblock (eigene Notizen plus automatisch markierte Zahlen aus dem Gespräch). *D* · M3
- [ ] **APP-09** Gesprächsanalyse (eigene Anrufe als Protokoll, beste und schlimmste Zitate). *O (Call Analysis)* · M9
- [ ] **APP-10** Stempeluhr (Tagesziel, Ausstempel-Status aller Kollegen). *O (Clock Out)* · M5
- [x] **APP-11** Gutschein-Kasse (Gutscheincodes einlösen). *D* · M4

**Maschen-Apps** (je eine pro Masche, siehe §7)
- [x] **APP-12** Rentennummer-Raffer. *O (Social Security Stealer)* · M4
- [x] **APP-13** Turbo-Gönner (Turbo-Geschenk-Masche). *O (Nitro-Masche)* · M4
- [x] **APP-14** Gutschein-Gaudi. *D* · M4
- [x] **APP-15** Enkel im Orbit. *D* · M4
- [x] **APP-16** Mondmakler. *D* · M4
- [x] **APP-17** Pinguinprinz. *D* · M4
- [x] **APP-18** Atlantis-Lotto. *D* · M4
- [x] **APP-19** Toaster-Doktor. *D* · M4
- [x] **APP-20** Goldfisch-Finanzamt. *D* · M4
- [x] **APP-21** Luftgitarren-Abo. *D* · M4
- [x] **APP-22** Zeitreise-Police. *D* · M4
- [x] **APP-23** SchwindelCoin. *D* · M4
- [x] **APP-24** Wunderwasser. *D* · M4
- [x] **APP-25** Promi-Dinner. *D* · M4
- [x] **APP-26** Büroklammer-Rettung. *D* · M4

**Business-Apps** (Ramschazon)
- [ ] **APP-27** Stimmverzerrer (klingt amtlicher: Bonus bei Behörden-Maschen, eigene Stimme wird verfremdet ausgegeben). *O (Business-Apps) [FN], D* · M6
- [ ] **APP-28** Souffleur (Teleprompter: schlägt passende Formulierungen vor). *D* · M6
- [ ] **APP-29** Nummern-Tarnkappe (Rufnummer verschleiern: weniger Fahndungsdruck, höheres Start-Vertrauen). *D* · M6
- [ ] **APP-30** Lügendetektor 3000 (zeigt den Vertrauens-Trend und die Wirkung des letzten Satzes genau). *D* · M6
- [ ] **APP-31** Turbo-Wählscheibe (mehr eingehende Anrufe am eigenen Platz). *D* · M6
- [ ] **APP-32** Babbelfisch (übersetzt Dialekt und Fachchinesisch der Anrufer). *D* · M6
- [ ] **APP-33** Fahndungs-Radar (zeigt den Fahndungsdruck, warnt früh vor einer Razzia). *D* · M6/M7
- [ ] **APP-34** Brandmauer (Firewall: blockt einen Virus pro Tag). *D* · M6/M7
- [ ] **APP-35** VirenSchreck (Antivirus: entfernt Viren per Scan-Minispiel). *D* · M6/M7
- [ ] **APP-36** Aufgaben-Manager (Prozesse wie `virus.exe` beenden, Gag-Prozesse). *D* · M7

**Spiele & Freizeit**
- [ ] **APP-37** Klick-Imperium (Idle-Clicker mit Upgrades, läuft im Hintergrund weiter). *O (idle clicker) [FN]* · M6
- [ ] **APP-38** Minenschwindler (Minesweeper-Variante). *O (Spiele im Shop) [FN], D* · M6
- [ ] **APP-39** Büroschlange (Snake-Variante). *D* · M6
- [ ] **APP-40** Patience-Verlust (Solitär). *D* · M6
- [ ] **APP-41** Glücksbit (Casino, siehe §10). *O (Rainbit)* · M6
- [ ] **APP-42** Ramschazon (Shop, siehe §9). *O (Scamazon)* · M6

**Kreativ**
- [ ] **APP-43** Kritzel (Paint: Stift, Radierer, Füllen, Formen, Farben, Stempel, Rückgängig, Speichern). *O (Paint) [ST]* · M9
- [ ] **APP-44** Knipser (Ingame-Kamera mit Selfie-Ansicht, Büro-Fotos, Filter, Galerie). *O (Kamera) [ST]* · M9
- [ ] **APP-45** Mitschnitt (Bildschirmrekorder: Spielszene als Video aufnehmen, ansehen, herunterladen). *O (Screen recorder) [ST]* · M9
- [ ] **APP-46** Galerie (Fotos, Bilder, Aufnahmen; teilen in Team-Funk, an die Pinnwand hängen). *D* · M9

**System & Werkzeuge**
- [x] **APP-47** Dateien (Explorer mit eigenen Dateien und Gag-Dateien). *D* · M2
- [x] **APP-48** Papierkorb (wiederherstellen, leeren, Gag-Inhalte). *D* · M2
- [x] **APP-49** Rechner. *D* · M2
- [ ] **APP-50** Netzlupe (Browser mit Fake-Seiten: Schwindelheimer Nachrichten mit Berichten über eure Taten, Fahndungsliste, Konkurrenz-Website, Ramschazon-Bewertungen). *D* · M6
- [ ] **APP-51** Warteschleifen-FM (Musik- und Radio-App: Sender wechseln, die Musik läuft im Büro). *D* · M11
- [x] **APP-52** Wetter (Gag-Vorhersagen, z. B. „Heute 80 % Raketenwahrscheinlichkeit“). *D* · M2
- [ ] **APP-53** Kalender & Uhr (Arbeitstag, Countdown, Freischalt-Vorschau). *D* · M5
- [ ] **APP-54** Systemsteuerung (Hintergrund, Lautstärke, Theme, Spiel-Einstellungen). *D* · M2 (Hintergrund, Theme, Lautstärken, Vibration seit M2, Sprache/Stimmen/Mikrofon seit M3; weitere Spiel-Einstellungen mit M11)
- [ ] **APP-55** Einarbeitungsmappe (Hilfe und Handbuch: Steuerung, Maschen, Apps, Gefahren). *A* · M10

## 9. Ramschazon (Shop) & Gegenstände

- [ ] **SHP-01** Shop-App mit Kategorien **Maschen**, **Business-Apps**, **Spiele**, **Physische Waren**. *O [FN]* · M6
- [ ] **SHP-02** Kauf mit dem persönlichen Guthaben, Lieferung per Drohne bzw. Klappe an den Arbeitsplatz. *O (Kauf) [FN], D (Lieferung)* · M6
- [ ] **SHP-03** Sortiment wechselt täglich, „Angebot des Tages“, absurde Produktbewertungen. *D* · M6
- [ ] **SHP-04** **Bärenspray Deluxe**: Sprühkegel, Getroffene niesen und sind kurz außer Gefecht (fallen lassen, Anruf bricht ab). *O (Bear Mace) [FN]* · M6
- [ ] **SHP-05** **Homeoffice-Scharfschütze**: Laserpunkt per Maus bzw. Touch setzen, Schaumstoff-Pfeil vom Dach gegenüber, Ziel fällt um und das Headset fliegt weg. *O (Remote-Work Sniper) [FN]* · M6
- [ ] **SHP-06** **Raketenhagel auf die Konkurrenz**: Das Callcenter gegenüber explodiert (Cartoon), danach den Rest des Tages mehr Anrufe für euch und Bonus. *O [FN]* · M6/M7
- [ ] **SHP-07** **Raketenhagel aufs eigene Büro**: Chaos pur, Versicherungs-Gag mit kleiner Auszahlung. *O [FN]* · M6/M7
- [ ] **SHP-08** Feuerlöscher (löscht brennende Monitore, Schaum-Gag). *D* · M6
- [ ] **SHP-09** Ersatz-Monitor. *D* · M6
- [ ] **SHP-10** Kaffee-Turbo (schnelleres Laufen und Tippen für kurze Zeit). *D* · M6
- [ ] **SHP-11** Quotenbrause (Energy-Drink: Geduld der Anrufer +). *D* · M6
- [ ] **SHP-12** Bestechungs-Donuts (Chef-Laune +, Polizei-Durchsuchung kürzer). *D* · M6
- [ ] **SHP-13** Gummiente (Rubber-Duck-Debugging: gibt einen Masche-Tipp zum aktuellen Anrufer). *D* · M6
- [ ] **SHP-14** Tacker-Helm (Schutz vor fliegenden Tackern bei der Bewertung). *O? (fliegende Tacker), D* · M6
- [ ] **SHP-15** Aktenvernichter-Turbo (Beweise bei einer Razzia schneller vernichten). *D* · M6
- [ ] **SHP-16** Bananenschale (Falle für Kollegen, Polizei, Chef). *D* · M6
- [ ] **SHP-17** Furzkissen (Streich, Chef-Wut-Gag). *D* · M6
- [ ] **SHP-18** Konfetti-Kanone (Feier-Streich, verdeckt kurz die Sicht). *D* · M6
- [ ] **SHP-19** Wasserpistole (Streich, nasse Tastatur = Tippfehler). *D* · M6
- [ ] **SHP-20** Megafon (Durchsage ans ganze Büro, Bots reagieren). *D* · M6
- [ ] **SHP-21** Goldenes Headset (kosmetisch plus kleines Start-Vertrauen). *D* · M6
- [ ] **SHP-22** Kosmetik: Hüte, Brillen, Krawatten, Schreibtisch-Deko (wirkt sofort an der Figur bzw. am Platz). *D* · M6
- [ ] **SHP-23** Maschen kaufen (schaltet Maschen-Apps vorzeitig frei). *O [FN]* · M6
- [ ] **SHP-24** Spiele kaufen (Minenschwindler, Büroschlange, Patience-Verlust, Upgrades für Klick-Imperium). *O [FN]* · M6
- [ ] **SHP-25** Inventar: getragene Gegenstände (1 in der Hand plus Schreibtisch-Ablage), anzeigen, benutzen, weitergeben. *D* · M6

## 10. Glücksbit (Büro-Casino)

- [ ] **CAS-01** Casino-App zum Verzocken des persönlichen Guthabens. *O [FN]* · M6
- [ ] **CAS-02** Einarmiger Bandit (3 Walzen, Symbole aus dem Büroalltag). *D* · M6
- [ ] **CAS-03** Glücksrad (Multiplikatoren, Niete „Chef ruft“). *D* · M6
- [ ] **CAS-04** Doppelt oder nichts (Münzwurf). *D* · M6
- [ ] **CAS-05** Rakete (Crash-Spiel: rechtzeitig aussteigen). *D* · M6
- [ ] **CAS-06** 17 und 4 (Blackjack light). *D* · M6
- [ ] **CAS-07** Casino-Gewinne zählen zur Team-Summe (riskanter Weg zur Quota), Verluste gehen nur vom persönlichen Guthaben ab. *D* · M6
- [ ] **CAS-08** Einsatz-Limits pro Tag, Jackpot-Effekte (Konfetti, Sirene, Hit-Stop). *D* · M6/M11

## 11. Arbeitstag, Quota, Chef & Bewertung

- [ ] **DAY-01** Ein Arbeitstag mit Countdown bis zur Leistungsbewertung. *O [FN]* · M5
- [ ] **DAY-02** Tägliche Team-Quota, die von Tag zu Tag steigt (Referenzwerte 600, 1.400, 1.750, 2.600). *O [FN]* · M5
- [ ] **DAY-03** Quota skaliert mit der Teamgröße (Menschen plus Bots). *D* · M5
- [ ] **DAY-04** Früher Feierabend: Ist die Quota erreicht, müssen **alle** ausstempeln (Bots stempeln mit, Splitscreen-Spieler einzeln). *O [FN]* · M5
- [ ] **DAY-05** Leistungsbewertung durch Direktor Brülling: Team versammelt sich, Ergebnisbalken, Urteil. *O [ST][FN]* · M5
- [ ] **DAY-06** Quota erreicht → nächster, schwererer Tag. *O [FN]* · M5
- [ ] **DAY-07** Quota verfehlt → „Quota um X ₮ verfehlt – Sie sind gefeuert!“, Run endet. *O [FN]* · M5
- [ ] **DAY-08** Bewertung zeigt die **drei stärksten Momente des Tages** (Zitate, Rekord-Abschlüsse, Chaos-Highlights). *O [FN]* · M5
- [ ] **DAY-09** Bewertung kündigt an, welche Apps morgen freigeschaltet werden. *O [FN]* · M5
- [ ] **DAY-10** Freischalt-Plan: Tag 1 Telefon, Ident-o-Mat, Rentennummer-Raffer · Tag 2 Plauderbude-Masche, Gutschein-Gaudi · **Tag 3 FernGucker und Kundenkartei** · danach je Tag weitere Maschen und Apps. *O (Tag 3 belegt) [FN], D* · M5
- [ ] **DAY-11** Fliegende Tacker während der Bewertung: ausweichen, Treffer heißt kurz k.o., „Tacker-Helm“ schützt. *O?, D* · M5
- [ ] **DAY-12** Chef ist ein Choleriker: Wut-Anzeige, Brüllanfälle mit Screenshake, Kontrollgänge durchs Büro. *O [SM „rageaholic“], D* · M5
- [ ] **DAY-13** Chef-Kontrolle: Wer beim Zocken oder Faulenzen erwischt wird, kassiert eine Standpauke und Strafgeld (die Boss-Taste rettet). *D* · M5/M7
- [ ] **DAY-14** Tagesbeginn: Chef-Mail mit Tagesziel, Wetter und Sprüchen, Einstempeln am Platz. *D* · M5
- [ ] **DAY-15** Schwierigkeitskurve über die Tage: mehr Anrufe, zähere Anrufer, mehr Köder, häufigere Gefahren. *D* · M5/M7

## 12. Gefahren & Arbeitsplatz-Katastrophen

- [ ] **HAZ-01** Computervirus (über Köder-Links, Opa Trollingers Gegenangriff, dubiose Downloads). *O [ST][FN]* · M7
- [ ] **HAZ-02** Virus-Effekte: Popup-Sturm, Maus driftet, Bildschirm steht kopf, Tastatur vertauscht Buchstaben, Fake-Bluescreen. *D* · M7
- [ ] **HAZ-03** Virus setzt den Monitor in Brand: Feuer breitet sich aus, löschen mit dem Feuerlöscher, Monitor ersetzen. *O [FN]* · M7
- [ ] **HAZ-04** Viren entfernen: Aufgaben-Manager, VirenSchreck, Neustart (kostet Zeit). *D* · M7
- [ ] **HAZ-05** Polizeirazzia: Fahndungsdruck steigt mit Maschen und Fehlern, Sirenen-Warnung, Countdown. *O [ST], D* · M7
- [ ] **HAZ-06** Razzia-Ablauf: Polizei durchsucht die Plätze. Wer Beweise (offene Maschen-Apps, Notizen) nicht schreddert oder versteckt, kassiert Bußgeld; Erwischte landen in der Arrestzelle (Kaution oder warten). *D* · M7
- [ ] **HAZ-07** Luftangriff: Alarm, rote Zielkreise im Büro, Cartoon-Raketen, Getroffene sind kurz k.o. (Ruß-Gesicht), Möbel kaputt, Anrufe brechen ab. *O [ST], D* · M7
- [ ] **HAZ-08** Kaputte Schreibtische bzw. Monitore reparieren (Interaktion halten). *D* · M7
- [ ] **HAZ-09** Konkurrenz-Callcenter gegenüber: schickt eigene Luftangriffe, Spitzel, Abwerbe-Anrufe. *O (Rivalen) [FN], D* · M7
- [ ] **HAZ-10** Stromausfall (Sicherungskasten). *O („other workplace disasters“), D* · M7
- [ ] **HAZ-11** Internetausfall (Router-Neustart-Minispiel). *D* · M7
- [ ] **HAZ-12** Explodierende Kaffeemaschine (Kaffee-Rutschgefahr, Kaffeepause gestrichen). *D* · M7
- [ ] **HAZ-13** Wasserspender-Flut (rutschiger Boden). *D* · M7
- [ ] **HAZ-14** Tauben-Invasion durchs offene Fenster (klauen Notizzettel). *D* · M7
- [ ] **HAZ-15** Feueralarm-Probe (alle müssen raus, Zeitverlust; wer bleibt, wird ermahnt). *D* · M7
- [ ] **HAZ-16** Druckerstau-Aufstand (der Drucker spuckt Papier, blockiert den Gang). *D* · M7
- [ ] **HAZ-17** Ereignis-Ankündigungen mit Warnzeit, damit Gefahren fair und lesbar bleiben (Warnlicht, Sound, Vibration). *A* · M7

## 13. Progression, Freischaltungen, Run-Ende, Statistiken

- [ ] **PRG-01** Persönliches Guthaben bleibt über die Tage eines Runs erhalten (für Shop und Casino). *O [FN], D* · M5
- [ ] **PRG-02** Team-Summe wird täglich gegen die Quota gemessen. *O [FN]* · M5
- [ ] **PRG-03** Freischaltung neuer Maschen und Apps pro Tag (siehe DAY-10). *O [ST][FN]* · M5
- [ ] **PRG-04** **Kündigungsbericht Schwindelheim** am Run-Ende: gearbeitete Tage, Team-Gesamtbeute, Rangliste aller Spieler und Bots nach verdientem Geld, Spielzeit, Durchschnitt pro Tag. *O [FN]* · M5
- [ ] **PRG-05** Lokale Bestenliste (beste Runs: Tage, Beute, Schicht-Code). *E (Ranglisten lokal)* · M5
- [ ] **PRG-06** Lebenszeit-Statistiken (Anrufe, Erfolgsquote, Lieblingsmasche, verbrannte Monitore, Razzien, verschluckte Tacker …). *D* · M5
- [ ] **PRG-07** Neuer Run nach dem Rauswurf („Neue Bewerbung schreiben“). *O* · M5
- [ ] **PRG-08** Achievements („Auszeichnungen“, z. B. „Brandschutzbeauftragter“). Im Original nicht belegt. *+* · M11

## 14. Koop, Bots, Lobby (lokal)

- [ ] **COP-01** Bot-Kollegen an freien Plätzen: nehmen Anrufe an, verdienen je nach Können, stempeln aus, reagieren auf Gefahren. *E (Online-Mitspieler)* · M8
- [ ] **COP-02** Bot-Persönlichkeiten (fleißig, faul, Chaot, Streber, Pechvogel) mit Namen, Look und Sprüchen. *D* · M8
- [ ] **COP-03** Bots machen Bürochaos (Streiche, Kaffee holen, zocken heimlich) und helfen (löschen Brände, übernehmen klingelnde Telefone). *D* · M8
- [ ] **COP-04** Lokaler Splitscreen für 2–4 Spieler (Tastatur plus Gamepads bzw. mehrere Gamepads), jeder mit eigenem Desktop. **Nur Desktop und Tablet**; auf dem Handy ist die Option ausgeblendet (Solo mit Bots). *E (Online-Koop)* · M8
- [ ] **COP-05** Lobby: Team zusammenstellen (Plätze mit Menschen oder Bots), Schicht-Code eingeben oder würfeln, Figur anpassen. *E (Lobbys/Raum-Code)* · M8
- [ ] **COP-06** Figur anpassen: Name, Haut, Haare, Kleidung, Farbe, Hut. *D* · M8
- [ ] **COP-07** Emote-Rad und Sprechblasen (sichtbar in der Nähe, Bots reagieren). *E (Proximity-Sprachchat)* · M8
- [ ] **COP-08** Teamwork: Telefonate weiterreichen bzw. übernehmen, Beute (Nummer) an Kollegen schicken, gemeinsames Ausstempeln. *D* · M8
- [ ] **COP-09** Eigenständiger Team-Bericht mit allen Spielern im Kündigungsbericht und in der Bewertung. *O [FN]* · M5/M8

## 15. Kreativ-Werkzeuge & Gesprächsanalyse

- [ ] **CRE-01** Kritzel-Bilder speichern (Galerie, lokal) und exportieren (PNG-Download). *O (Paint) [ST]* · M9
- [ ] **CRE-02** Knipser: Fotos aus der Ich-Perspektive der Figur (Büroausschnitt) und Selfie-Modus (Figur mit Grimasse), Filter, Blitz. *O (Kamera) [ST]* · M9
- [ ] **CRE-03** Mitschnitt: Spielszene aufnehmen (Canvas plus Ton), Wiedergabe in der Galerie, Download als WebM. *O (Screen recorder) [ST]* · M9
- [ ] **CRE-04** Gesprächsanalyse an der Beamer-Wand: zitiert live die lustigsten bzw. schlimmsten Sätze aus Anrufen. *O [FN]* · M9
- [ ] **CRE-05** Bewertungs-Highlights nutzen dieselbe Zitat-Auswahl (drei stärkste Momente). *O [FN]* · M5/M9
- [ ] **CRE-06** Gedruckte Bilder an die Pinnwand im Büro hängen. *+* · M9

## 16. Mods

- [ ] **MOD-M1** Eigene Anrufer-Persönlichkeiten per JSON importieren (Schema dokumentiert, Validierung mit verständlichen Fehlern). *O [ST]* · M10
- [ ] **MOD-M2** Stimme per WAV: hochgeladene bzw. aufgenommene Sprachprobe → Brabbel-Stimme und Tonhöhen-Profil der eigenen Persönlichkeit. *O (Voice-Cloning-WAV), E* · M10
- [ ] **MOD-M3** Mod-Werkstatt im Spiel: Persönlichkeit bearbeiten, Porträt zusammenklicken, Testanruf führen. *E/D* · M10
- [ ] **MOD-M4** Mods aktivieren bzw. deaktivieren, exportieren (Datei), löschen; Speicherung lokal (IndexedDB). *D* · M10
- [ ] **MOD-M5** Eigene Maschen per JSON. *+* · M10

## 17. Tutorial & Hilfe

- [ ] **TUT-01** Einarbeitungstag (erster Tag, abschaltbar): Laufen, Hinsetzen, Abnehmen, Vertrauen vor Forderung, Nummer eintragen, Ausstempeln. *O (Tutorial belegt) [FN]* · M10
- [ ] **TUT-02** Kontext-Tipps beim ersten Auftreten neuer Dinge (neue App, erste Razzia, erster Virus). *D* · M10
- [ ] **TUT-03** Ladebildschirm- und Pausen-Tipps (lustig und hilfreich). *D* · M11
- [ ] **TUT-04** Steuerungs-Übersicht je Eingabegerät (automatisch passend). *A* · M10

## 18. Menüs & Einstellungen

- [ ] **MEN-01** Titelbildschirm mit eigenem Logo, Animation und Musik. *A* · M0/M11
- [ ] **MEN-02** Hauptmenü: Schicht beginnen (solo), Lobby (Koop lokal), Fortsetzen, Mod-Werkstatt, Galerie, Statistiken und Bestenliste, Einstellungen, Credits. *A/D* · M5–M11
- [x] **MEN-03** Pausenmenü (Weiter, Hauptmenü). Solo und lokaler Koop pausieren die Zeit (alle sitzen an einem Gerät); im Online-Koop öffnet es nur das Menü (NET-10). *D* · M1
- [ ] **MEN-04** Einstellungen Audio: Gesamt, Musik, Effekte, Anruferstimmen, Ingame-Radio. *A* · M11
- [x] **MEN-05** Einstellungen Sprache: Sprachsynthese an/aus und Stimmauswahl, Spracheingabe an/aus, Push-to-talk vs. Sprachaktivierung, Mikrofon-Test. *A/E* · M3/M11
- [ ] **MEN-06** Einstellungen Grafik: Pixel-Skalierung, Partikelmenge, Screenshake, Bewegungen reduzieren, FPS-Anzeige. *A* · M11
- [ ] **MEN-07** Einstellungen Steuerung: Tastatur, Maus und Gamepad frei belegen, Empfindlichkeit, Touch-Layout-Editor. *A* · M11
- [ ] **MEN-08** Einstellungen Barrierefreiheit: Textgröße, Kontrast, Untertitel-Hintergrund, Farbsehschwäche-Paletten. *A* · M11
- [ ] **MEN-09** Einstellungen Vibration an/aus und Stärke. *A* · M11
- [ ] **MEN-10** Einstellungen Komfort (QoL, siehe §25). *+* · M11
- [ ] **MEN-11** Spielstand und Daten: Run löschen, Statistiken zurücksetzen, Export/Import. *D* · M11
- [ ] **MEN-12** Credits und Hinweis „Alles fiktiv“ plus kurzer Echte-Welt-Hinweis gegen echte Maschen. *+* · M11

## 19. HUD

- [ ] **HUD-01** Büro-HUD: Mini-Quota-Balken, Countdown, persönliches Guthaben, Fahndungsdruck (sobald Radar gekauft), Interaktions-Hinweis. *O (Taskleiste) [FN], A* · M1/M5
- [x] **HUD-02** Anruf-HUD: Porträt, Name, Vertrauen %, Stimmung, Geduld, Masche-Phase, Untertitel, Eingabefeld bzw. Karten. *O [FN]* · M3
- [ ] **HUD-03** Ereignis-Warnungen (Razzia, Luftangriff, Feuer) als Banner plus Richtungspfeile. *D* · M7
- [x] **HUD-04** Klingel-Anzeiger: Richtungspfeil zu klingelnden Telefonen im Büro. *D* · M3
- [ ] **HUD-05** Schwebende Zahlen (+₮, Vertrauen ±), Toasts, Streak-Anzeige. *A* · M11
- [ ] **HUD-06** Splitscreen-HUD pro Spieler. *E* · M8

## 20. Audio

- [ ] **AUD-01** Titelmusik. *A* · M11
- [ ] **AUD-02** Büro-Musik (dynamisch, wird schneller, je knapper der Countdown). *A* · M11
- [ ] **AUD-03** Warteschleifen-Musik (Running Gag, mehrere Varianten). *D* · M11
- [ ] **AUD-04** Bewertungs-Trommelwirbel, Erfolgs-Fanfare, Rauswurf-Posaune. *A* · M11
- [ ] **AUD-05** Casino-Jingles, Shop-Fahrstuhlmusik, Razzia-Sirenen-Groove, Luftangriffs-Alarm. *A* · M11
- [ ] **AUD-06** SFX: Telefonklingeln (räumlich), Abheben, Auflegen, Tippen, Klicks, Fenster, Benachrichtigung, Geld, Masche-Abschluss, Fehlschlag, Virus, Feuer, Feuerlöscher, Explosion, Tacker, Schritte, Spray, Schaumpfeil, Drohne, Drucker, Kaffeemaschine, Tauben, Stromausfall, Router. *A* · M11
- [x] **AUD-07** Anruferstimmen (Sprachsynthese) plus Brabbel-Fallback. *E* · M3
- [ ] **AUD-08** Chef-Gebrüll (Brabbel-Synthese mit Verzerrung). *D* · M5/M11
- [ ] **AUD-09** Alles prozedural erzeugt (Web Audio), keine fremden Audiodateien. *A* · M11

## 21. Game Juice

- [ ] **JCE-01** Screenshake (Explosionen, Chef-Gebrüll, Masche-Abschluss; abschaltbar). *A* · M11
- [ ] **JCE-02** Partikel: Geldscheine, Münzen, Funken, Rauch, Feuer, Konfetti, Schaum, Federn (Tauben), Papier. *A* · M11
- [ ] **JCE-03** Squash & Stretch bei Figuren, Icons, Buttons und Porträts. *A* · M11
- [ ] **JCE-04** Hit-Stop bei Masche-Abschluss, Treffern und Jackpot. *A* · M11
- [ ] **JCE-05** Streak bzw. Combo: aufeinanderfolgende erfolgreiche Maschen eines Spielers mit steigender Anzeige, Ton und kleinem Bonus (konfigurierbar). *A* · M11
- [ ] **JCE-06** Kamera-Zoom und -Punch, Blitze, Zeitlupe beim Raketeneinschlag. *A* · M11
- [ ] **JCE-07** Schreibmaschinen-Text, UI-Bounce, Fenster-Pop-Animationen. *A* · M11
- [ ] **JCE-08** Vibration bei wichtigen Momenten (Anruf, Abschluss, Explosion, Rauswurf). *A* · M11

## 22. Humor, Running Gags, Easter Eggs

- [ ] **FUN-01** Eigene Game-Over-Sprüche von Direktor Brülling (mindestens 30). *A* · M5
- [x] **FUN-02** Eigene Anrufer-Sprüche, Reaktionen und Ausreden in großer Menge (über 1.500 Zeilen). *A/E* · M3
- [ ] **FUN-03** Schwindelheimer Nachrichten-Ticker über eure Taten (Netzlupe, Büro-TV). *D* · M6
- [ ] **FUN-04** Spam-Mails, absurde Ramschazon-Bewertungen, Wetter-Gags. *D* · M6
- [ ] **FUN-05** Running Gags: Warteschleife, Tacker, Ferdinand die Pflanze, Druckerstau, „Mein Sohn ist Anwalt“. *D* · M11
- [ ] **FUN-06** Easter Eggs: Ferdinand redet, Anruf bei sich selbst, geheimes Admin-Passwort im Papierkorb, Konami-Code, Raketenhagel auf den Chef. *+* · M11

## 23. Steuerung

**Erkennung**
- [x] **CTL-01** Automatische Erkennung Touch vs. Desktop (`pointer: coarse`, Touch-Events, Bildschirmgröße), passende Steuerung ohne Einstellen. *A* · M0
- [x] **CTL-02** Wechsel zur Laufzeit (Maus bewegt → Desktop-UI; Touch → Touch-UI; Gamepad-Taste → Gamepad-Hinweise). *A* · M0/M11

**Desktop (frei belegbar)**
- [ ] **CTL-03** Laufen WASD/Pfeile, Interagieren E, Benutzen/Werfen F/Q, Emote-Rad G, Boss-Taste B, Push-to-talk V, Pause Esc, Aufstehen Tab. *A* · M1
- [x] **CTL-04** Desktop-Bedienung per Maus, Enter sendet, Zifferntasten 1–4 wählen Schnellantwort-Karten, Strg+Tab wechselt Apps (im Browser reserviert → Bild↑/Bild↓, Gamepad LB/RB; Maus-Bedienung seit M2). *A* · M2/M3
- [ ] **CTL-05** Tastenbelegung frei änderbar, Konflikterkennung, Zurücksetzen. *A* · M11

**Gamepad**
- [ ] **CTL-06** Linker Stick laufen, A interagieren, B zurück, X benutzen, Y Emote, LB/RB App wechseln, Steuerkreuz Fokus-Navigation im Desktop, Start Pause, Bildschirmtastatur für Text. *A* · M11
- [ ] **CTL-07** Gamepad-Belegung frei änderbar. *A* · M11

**Touch (direkt eingebaut)**
- [x] **CTL-08** Virtueller Joystick (schwebend, erscheint am Daumen) zum Laufen. *A* · M1
- [ ] **CTL-09** Kontext-Aktionsbutton (Hinsetzen, Abnehmen, Aufheben, Benutzen) plus Benutzen- bzw. Werfen-Button plus Emote-Button. *A* · M1/M6
- [x] **CTL-10** Desktop per Tippen; Wischen zwischen Apps; langes Drücken ersetzt Rechtsklick. *A* · M2
- [x] **CTL-11** Anruf: Halten-zum-Sprechen-Mic-Button, Schnellantwort-Karten, Texteingabe mit Bildschirmtastatur, nach oben wischen zum Abnehmen. *A* · M3
- [ ] **CTL-12** Zielen (Scharfschütze, Spray, Werfen) per Ziehen mit Vorschau-Linie. *A* · M6
- [x] **CTL-13** Buttons daumengroß (mind. 56 dp), halbtransparent, an Hoch- und Querformat angepasst. *A* · M1
- [ ] **CTL-14** Touch-Layout-Editor: Buttons verschieben, skalieren, Transparenz, zurücksetzen. *A* · M11
- [ ] **CTL-15** Jede Aktion des Originals ist auf dem Handy ausführbar (Abgleich-Tabelle in GAME_DESIGN.md §4). *A* · M12

## 24. Geräte, PWA, Technik

- [x] **TEC-01** Vite + TypeScript (strict) + Phaser 3, saubere Ordnerstruktur, alle Inhalte datengetrieben, alle Tuning-Werte zentral in `src/config/`. *A* · M0
- [x] **TEC-02** Kein Zoomen, Scrollen, Text-Markieren, Kontextmenü, Pull-to-Refresh. *A* · M0
- [x] **TEC-03** Safe Areas (Notch, Home-Indicator). *A* · M0
- [x] **TEC-04** Vollbild-Umschalter; auf dem Handy automatisch beim ersten Tippen (wo erlaubt). *A* · M0
- [x] **TEC-05** Hinweis bei falscher Ausrichtung (Querformat empfohlen) mit „Trotzdem spielen“. Hochformat wird vollständig unterstützt. *A* · M0
- [x] **TEC-06** Delta-Time-basierte Simulation (feste Logik-Schritte, framerate-unabhängig). *A* · M0
- [x] **TEC-07** Scharf auf Retina (Pixel-Art per Nearest-Neighbor ganzzahlig skaliert, Text in Geräteauflösung). *A* · M0
- [x] **TEC-08** Auto-Pause bzw. Stummschalten im Hintergrund (visibilitychange, blur). *A* · M0
- [ ] **TEC-09** PWA-Manifest (Name, Farben, Ausrichtung, Shortcuts). *A* · M0/M12
- [x] **TEC-10** App-Icons in allen Größen inkl. maskable, per Code erzeugt (Pixel-Art). *A* · M0/M12
- [ ] **TEC-11** Service Worker: komplett offline spielbar, Update-Hinweis bei neuer Version. *A* · M12
- [ ] **TEC-12** Speicherung lokal (localStorage für Einstellungen, IndexedDB für Run, Bilder, Videos, Mods), Fehler werden abgefangen. *A* · M5
- [ ] **TEC-13** Stabile 60 FPS auf Mittelklasse-Handy und Desktop; Objekt-Pools; keine Speicherlecks bei langen Sessions. *A* · M12
- [ ] **TEC-14** GitHub-Pages-Deployment per GitHub-Actions-Workflow (Build, Test, Deploy). *A* · M12
- [x] **TEC-15** Keine externen Laufzeit-Abhängigkeiten (kein CDN, keine Server), alles im Bundle. Ausnahme ab M13/M14: nur die vom Spieler aktivierten Online-Funktionen. *A* · M0
- [x] **TEC-16** i18n-System von Anfang an: alle sichtbaren Texte über Schlüssel, Deutsch als Standard und Referenz, Fallback auf Deutsch, Plural, Zahlen- und Geldformat; ein Test prüft, dass alle verwendeten Schlüssel existieren; Englisch ist ohne Codeänderung ergänzbar. *A* · M0

## 25. Komfort-Optionen (QoL – alle aus, Original-Verhalten ist Standard)

- [ ] **QOL-01** Längeres Abnehm-Fenster (30 s → 45 s). *+* · M11
- [ ] **QOL-02** Schichtlänge wählbar (kurz, normal, lang, Original-Referenz 20 min). *+* · M11
- [ ] **QOL-03** Solo: Zeit pausiert, solange der Desktop ein Menü zeigt bzw. während Pausen. *+* · M11
- [ ] **QOL-04** Stimmungs-Hinweise: Der Anrufer zeigt, worauf er anspringt (nach dem 1. Satz). *+* · M11
- [ ] **QOL-05** Auto-Notiz: Genannte Nummern werden automatisch ins Eingabefeld übernommen. *+* · M11
- [ ] **QOL-06** Schnellantwort-Karten immer einblenden (auch am Desktop). *+* · M11
- [ ] **QOL-07** Sanftere Viren (keine kopfstehenden oder vertauschten Eingaben). *+* · M11
- [ ] **QOL-08** Gefahren-Häufigkeit (Original, weniger, keine). *+* · M11
- [ ] **QOL-09** Bots stempeln nicht automatisch aus bzw. warten nicht (Feierabend-Abstimmung nur unter Menschen). *+* · M11
- [ ] **QOL-10** Kein Perma-Death: Rauswurf erlaubt einen „Gnadentag“ (einmal pro Run). *+* · M11

## 26. Extra-Modus (eigener Twist, getrennt vom Original)

- [ ] **EXT-01** **Köder-Modus**: Rollentausch. Du bist der Köder und rufst Betrüger an, um ihre Zeit zu verschwenden. Punkte gibt es für verschwendete Minuten, Viren und Lacher; dazu eine eigene Bestenliste. *+* · M11
- [ ] **EXT-02** **Endlos-Schicht**: ein einziger Tag ohne Ende, die Quota steigt stündlich. Highscore-Jagd. *+* · M11

## 27. Tests & Qualität (nach jedem Meilenstein)

- [ ] **QA-01** `npm run build` ohne Fehler, `tsc --noEmit` ohne Fehler, keine Konsolenfehler im Spiel. *A* · M0–M12
- [ ] **QA-02** Vitest-Unit-Tests für die Spiellogik (Sprachverständnis, Vertrauen und Stimmung, Maschen, Wirtschaft, Quota, Gefahren, Bots, Speicherung). *A* · M0–M12
- [ ] **QA-03** Playwright: Desktop- und Handy-Viewport starten, Screenshots machen, Layout und Steuerung prüfen. *A* · M0–M12
- [ ] **QA-04** Automatisierte Playtests per Input-Simulation (ganzer Tag solo, Koop mit Bots, Rauswurf, Ausstempeln). *A* · M5–M12
- [ ] **QA-05** Balancing anhand der Playtest-Daten an die Original-Referenzwerte angenähert (Quota, 250-₮-Masche, Teamgröße). *A* · M12
- [ ] **QA-06** Performance-Messung: 60 FPS, Heap-Verlauf über eine lange Session (über 30 Spieltage simuliert). *A* · M12
- [ ] **QA-07** FEATURES.md nur abhaken, was im laufenden Spiel ist und getestet funktioniert. *A* · laufend

## 28. Abschluss

- [ ] **FIN-01** Abgleich: FEATURES.md komplett durchgehen und jeden Eintrag im laufenden Spiel bestätigen. *A* · M12
- [ ] **FIN-02** README.md: Spielbeschreibung, Steuerung, lokal starten, bauen. *A* · M12
- [ ] **FIN-03** GitHub-Pages-Link spielbar auf dem Handy. *A* · M12
- [ ] **FIN-04** Paritäts-Bericht (`docs/PARITY.md`): was 1:1 umgesetzt ist, was per gleichwertigem Ersatz, bekannte Einschränkungen. *A* · M12
- [ ] **FIN-05** CLAUDE.md aktuell (Überblick, Befehle, Konventionen, Stand, nächster Meilenstein). *A* · laufend

## 29. Online (nach M12, entschieden am 10.10.2026)

**M13 – KI-Anrufer mit eigenem API-Schlüssel (optional)**
- [ ] **NET-01** Einstellung „Echte KI-Anrufer“: Anbieter wählen, Schlüssel eingeben (maskiert), Verbindungstest. Der Schlüssel liegt nur lokal (optional nur für die Sitzung), nie im Repo, Build oder Log. *O (Cloud-LLM) [SD]* · M13
- [ ] **NET-02** LLM schreibt die Anrufer-Antworten aus Persönlichkeit, Gedächtnis, Masche-Phase und Gesprächsverlauf. *O [SD]* · M13
- [ ] **NET-03** Strukturierte Antwort (Text, ΔVertrauen-Vorschlag, Stimmung, Beute-Bereitschaft), begrenzt durch die lokalen Spielregeln (Schwellen, Auflegen, Diktat). *E/D* · M13
- [ ] **NET-04** Fallback auf die lokale Engine bei Fehler, Zeitüberschreitung, Offline oder Kostenlimit, ohne dass das Gespräch abbricht. *D* · M13
- [ ] **NET-05** Antwortzeit-Kaschierung (Tipp- bzw. „Hmm…“-Laute, Brabbeln), damit Latenz wie im Original nicht stört. *D* · M13
- [ ] **NET-06** Datenschutz-Hinweis (welche Daten an den Anbieter gehen), Opt-in, Abschalten jederzeit. *A* · M13

**M14 – Online-Koop per WebRTC (PeerJS)**
- [ ] **NET-07** Vorab-Test und Bericht: Erreichbarkeit des öffentlichen PeerServers, Verbindungsaufbau Desktop ↔ Handy (WLAN und Mobilfunk). *A* · M14
- [ ] **NET-08** Raum hosten bzw. per Raum-Code beitreten (PeerJS mit öffentlichem PeerServer, Signalisierungs-Server konfigurierbar). *O (Raum mit Freunden) [ST]* · M14
- [ ] **NET-09** Bis zu 8 Spieler, freie Plätze mit Bots auffüllbar. *O [FN-faq]* · M14
- [ ] **NET-10** Host-autoritative Simulation, Synchronisation von Büro, Figuren, Anrufen, Geld, Quota, Gefahren und Shop; Pausenmenü hält im Online-Koop die Zeit nicht an. *D* · M14
- [ ] **NET-11** Sprachchat per WebRTC-Audio mit Proximity (Lautstärke nach Abstand im Büro), Mute bzw. Push-to-talk. *O? (Sprache im Original zentral), D* · M14
- [ ] **NET-12** Reconnect und Host-Abbruch-Behandlung (Bot übernimmt den Platz). *D* · M14
- [ ] **NET-13** Verbindungstest mit verständlichen Fehlermeldungen und Tipps; optionales Feld für eigenen TURN-Server. *D* · M14
- [ ] **NET-14** Öffentliche Lobbys (Raumliste), sofern ohne eigenen Server machbar, sonst Raum-Code plus Bot-Lobbys. *O [ST], E* · M14
- [ ] **NET-15** Gemeinsamer Kündigungsbericht und gemeinsame Bewertung mit allen Online-Spielern. *O [FN]* · M14
- [ ] **NET-16** Online-Koop auch auf dem Handy (ein Spieler pro Gerät). *A* · M14

# Phase 1 – Recherche: „Scam With Your Friends“ (Original)

Stand: 10.10.2026. Grundlage für `FEATURES.md` und `GAME_DESIGN.md`.

## Wie recherchiert wurde

- In der Build-Umgebung sperrt die Netzwerk-Policy direkte Seitenabrufe (store.steampowered.com, steamcommunity.com, die Fan-Wikis, YouTube, Wikipedia). Alle Infos stammen deshalb aus **Suchmaschinen-Auszügen** dieser Seiten, über rund 60 gezielte Suchanfragen abgeglichen.
- Das Original ist **noch nicht vollständig veröffentlicht**: Seit ca. 20.09.2026 läuft ein geschlossener Playtest, Early Access ist für Oktober 2026 geplant (Ziel 15.10.), die Vollversion für Mitte Dezember 2026. Ein Wiki mit vollständigen Listen gibt es noch nicht. Die Entwickler haben weder einen Scam-Katalog noch Zahlenwerte oder ein Tutorial veröffentlicht (laut [FG], [FC]).
- Daraus folgt: Belegt sind die Kernmechaniken, die Apps, die Anrufer, die Gefahren, der Tagesablauf und viele Bildschirme. **Zahlenwerte gibt es nur vereinzelt** (aus Screenshots). Die Lücken fülle ich im Design-Dokument mit begründeten Entscheidungen.

## Quellen

| ID | Quelle | Art | Verlässlichkeit |
|---|---|---|---|
| ST | [Steam-Shopseite, App 4954910](https://store.steampowered.com/app/4954910/Scam_With_Your_Friends/) (inkl. Sprachvarianten) | offiziell | hoch |
| SM | Spiegel der Steam-Beschreibung: [SteamSift](https://steamsift.com/app/4954910/scam-with-your-friends), [Instant Gaming](https://www.instant-gaming.com/en/24156-buy-scam-with-your-friends-pc-steam/), [DekuDeals](https://www.dekudeals.com/items/scam-with-your-friends), [TechPlay](https://techplay.gg/games/scam-with-your-friends), [GameBrain](https://gamebrain.co/game/scam-with-your-friends), [Discord-Spieleseite](https://discord.com/game/scam-with-your-friends-1553255112502149211) | offiziell (gespiegelt) | hoch |
| SD | [Steam-Diskussion „The AI“](https://steamcommunity.com/app/4954910/discussions/0/520883440133931849/) mit Antwort des Entwicklers | Entwickler | hoch |
| FN | [scamwithyourfriends.net](https://scamwithyourfriends.net/): [how-to-play](https://scamwithyourfriends.net/how-to-play/), [ai-callers](https://scamwithyourfriends.net/ai-callers/), [mods](https://scamwithyourfriends.net/mods/), [faq](https://scamwithyourfriends.net/faq/), [platforms](https://scamwithyourfriends.net/platforms/), [system-requirements](https://scamwithyourfriends.net/system-requirements/). Fan-Guide, wertet die 20 offiziellen Screenshots und Discord-Changelogs aus | Fan | mittel |
| FG | [scam-with-your-friends.github.io](https://scam-with-your-friends.github.io/how-to-play/) (how-to-play, platforms, price) | Fan | mittel |
| FW | [scamwithyourfriends.wiki](https://scamwithyourfriends.wiki/), [scam-with-your-friends.wiki](https://scam-with-your-friends.wiki/) | Fan | mittel |
| FC | [scamwithfriends.com/how-to-play](https://scamwithfriends.com/how-to-play/) | Fan | mittel |
| CG | [CrimeNetGazette-Preview „Fraud Has KPIs Now“](https://www.crimenetgazette.com/post/scam-with-your-friends-preview-fraud-has-kpis-now) | Presse | mittel |
| YT | YouTube-Gameplay (z. B. [„We became Pro Scammers…“](https://www.youtube.com/watch?v=siFj51d0XbM), [„We Ran a SCAM Call Center…“](https://www.youtube.com/watch?v=-NIxPr-dNFw), [„I GOT EARLY ACCESS…“](https://www.youtube.com/watch?v=aEbdB9hT8JE), [Short zu Trust-Metern](https://www.youtube.com/shorts/oAJ1AXzRK2U)) | Community | niedrig–mittel |
| NF | [Noobfeed: Airport Security Sucks!](https://noobfeed.com/games/airport-security-sucks), [Jatater-Discord](https://discord.com/servers/jatater-worldwide-1406416808700940399) | Kontext (Vorgängerspiel) | – |
| XB | [Xbox-Store „Scam With Your Friends“ von Hidden Floor Games](https://www.xbox.com/en-US/games/store/scam-with-your-friends/9ns7g759jc3l). **Ein anderes Spiel mit gleichem Namen**, nicht das Original. Dient nur als Referenz für fehlende Zahlenwerte. | Fremdspiel | **nicht Original** |

## 1. Eckdaten

- **Titel:** Scam With Your Friends. **Entwickler:** JakeHub & Metater. **Publisher:** Jatater Worldwide (gegründet ca. August 2025) [ST][SM]. Vorgängerspiele: *Airport Security Sucks!* (Social-Deduction-Koop) und *IM LOOPY FOR DOOP LOOPS!!!* [NF].
- **Plattform:** nur Windows über Steam. Keine Konsolen-, Mac-, Mobil- oder Roblox-Version, Mac wird „in Betracht gezogen“ [FN-platforms][FG].
- **Preis:** Early Access 10 $ [FN]. Unbegrenzte KI-Nutzung ist im Preis enthalten, keine Mikrotransaktionen. Im Playtest gab es Freikontingente und optional 8 $ für unbegrenzte KI [FN-faq].
- **Status:** Playtest seit ca. 20.09.2026, über 12.000 Anmeldungen, über 100.000 Wunschlisten-Einträge [DD][FN]. Early Access ca. 15.10.2026, Vollversion Mitte Dezember 2026 [FN-release].
- **Steam-Tags:** Action, Casual, Indie, Simulation, Early Access, Voice Control, Artificial Intelligence, Job Simulator, Co-op Campaign, **Perma Death**, First-Person, Moddable [ST][FN].
- **Systemanforderungen:** Windows 10/11 64 Bit, i5-8400 / Ryzen 5 2600, GTX 1060 6 GB / RX 580, 3 GB RAM, DirectX 11, 5 GB Speicher. **Internet ist immer nötig, auch solo** [FN-sysreq].
- **Technik:** Sprachsynthese (Anruferstimmen) und Spracherkennung (Spielerstimme → Text) laufen **lokal**. Das „Gehirn“ der Anrufer ist ein **Cloud-LLM über OpenRouter** [SD][SM-TechPlay]. Lokale LLMs halten die Entwickler für zu schlecht in Gesprächen [SD].

## 2. Steuerung des Originals

- First-Person-Perspektive [ST-Tags], typische PC-Steuerung mit Maus und Tastatur. Am Schreibtisch bedient man einen **Ingame-Desktop per Maus** [FN].
- **Sprache:** Das Spiel ist zum Sprechen gedacht. Das Telefon hat Mikrofon- und Lautsprecher-Tasten, Tag „Voice Control“ [FN-ai-callers]. Ob man auch nur tippen kann, ist offiziell nicht bestätigt [FN-faq].
- **Controller:** im Original nicht belegt (nur [XB] nennt Controller, ein anderes Spiel).

## 3. Offizielle Spielbeschreibung (Steam, sinngemäß)

- „Run a scam call center with your friends. Use increasingly ridiculous schemes to trick AI callers out of their life savings. Hit your daily quota, cause chaos around the office, and survive a brutal performance review from your rageaholic boss.“ [SM-SteamSift]
- „KOLKATA, INDIA IS CALLING YOU AND YOUR FRIENDS! You and your friends run a scam call center under a ruthless boss. Cleverly scam and manipulate AI callers with your schemes! Hack into their computers to access the personal information you desperately need.“ [DD]
- „Every day you progress, you expand your arsenal of scams.“ [ST]
- **Key Features** [IG][DD][ST]: Online-Koop mit Freunden oder in öffentlichen Lobbys · Einzelspieler · urkomische KI-Gespräche in Echtzeit · absurde Scam-Szenarien · **Run-basierte Progression** · Fernzugriff auf die Computer der Opfer · Paint-App, Bildschirmrekorder und Kamera im Spiel · Computerviren, Polizeirazzien, Luftangriffe und andere Arbeitsplatz-Katastrophen überleben · nicht von „feisty scambaiters“ gehackt werden (die einen Virus einschleusen können) · stark moddbar: eigene Persönlichkeiten per JSON-Dateien plus Voice-Cloning per WAV-Dateien.

## 4. Mechaniken im Detail

### 4.1 Arbeitsplatz & Desktop
- Man sitzt an einem Schreibtisch im Callcenter. Der Ingame-Desktop heißt **„Kolkata OS“** und hat **über 45 Apps**, von Fernzugriffs-Tools über einen Shop bis zu einem Casino [FN].
- **Taskleiste:** persönliches Guthaben, Team-Summe, Quota und Countdown bis zur Leistungsbewertung [FN-htp].
- Ein offizieller Screenshot zeigt das **Büro von oben** mit den Spielern an ihren Schreibtischen [FN]. Ein anderer zeigt eine Person mit Headset im Büro [Discord-Screenshotbeschreibung].
- Bürochaos und Streiche sind ausdrücklich Teil des Spiels („cause chaos around the office“) [SM].

### 4.2 Anrufe
- Ein **Popup für eingehende Anrufe** zeigt den Namen des Anrufers. Die **Telefon-App** verbindet mit einem KI-Anrufer, der live gespielt wird [FN].
- Ablauf: Masche wählen → den Anrufer mit Worten durchführen → die nötige Information oder den Zugang bekommen → Masche abschließen → Auszahlung [FN-htp][FC].
- Das Gespräch selbst ist die Kernmechanik, **keine Dialogauswahl**: Anrufer reagieren dynamisch auf das tatsächlich Gesagte [CG].
- **Caller-Trust-Meter:** Prozentwert plus Stimmungs-Label. Was man sagt, bewegt den Wert. Bricht er ein, legt der Anrufer auf [FN-ai-callers]. Belegte Labels: **„Trusting“** (bei 65 % und 75 %) und **„Angry“** (bei 0 %, 5 % und 50 %). Das Label ist also **keine reine Funktion des Prozentwerts** [FN].
- Manche Anrufer sind leichtgläubig, andere skeptisch und brauchen aufwendige Beruhigung [FC].
- Das Tutorial lehrt, **erst Vertrauen aufzubauen und dann nach Sensiblem zu fragen** [FN-htp].
- Kritik aus der Presse: Wenn wenige Sätze zuverlässig jeden überzeugen, kippt die Fantasie [CG]. Daraus folgt für die Umsetzung: Floskeln, die immer funktionieren, müssen an Wirkung verlieren.

### 4.3 Anrufer (offizielle Screenshots, laut [FN] 7 namentlich)
1. **Dorothy Mayfield:** älter, kooperativ. Bestätigt eine Nummer kurz vor einem 250-$-Social-Security-Scam („Trusting“ 65 %).
2. **Eleanor „Granny“ Grimshaw:** Hexenhut, abergläubisch. Liest ihre Sozialversicherungsnummer vor und fürchtet, das bringe Unglück.
3. **Commander Miles „Orbit“ Vega:** Astronaut, will alles nach Vorschrift, bevor er seinen AnyViewer-Code herausgibt („Angry“ 50 %).
4. **Franklin D. Hyper:** Sonnenbrille, Beleidigungen, will einem seinen eigenen Token andrehen (Trust 0 %).
5. **Brittany „Lexi“ Summers:** wütend, kurz vorm Auflegen, der Spieler entschuldigt sich.
6. **Damien Holloway:** unbeeindruckt von einer seltsamen Bitte (Trust 0 %).
7. **Shanice „Dee“ Bishop:** nur im Popup für eingehende Anrufe zu sehen.
- Dazu **Scambaiter**: Anrufer, die nur Zeit verschwenden. Wer auf sie hereinfällt, kann sich einen **Virus** einfangen [FN][ST].

### 4.4 Scams / Apps (namentlich belegt)
- **Social Security Stealer:** Scam-App, ein Abschluss bringt 250 $ [FN].
- **Identity-App:** Dort gibt man die Sozialversicherungsnummer des Anrufers ein [FN].
- **AnyViewer:** Fernzugriff. Man tippt den Verbindungscode des Anrufers ein und steuert dessen Computer [FN]. Dazu gibt es ein „AnyViewer remote-support scam window“ [FN-Galerie].
- **Customer Info:** Wird zusammen mit AnyViewer an **Tag 3** freigeschaltet (Closed-Beta-Changelog) [FN-htp].
- **Disscord:** Messenger-App mit einer Masche „fake Nitro gift“ [FN-Galerie].
- **Scamazon Market:** Shop. Verkauft **Scams, Business-Apps, Spiele und „physische Waren“**, z. B. Waffen wie **Bear Mace** und **Remote-Work Sniper** sowie einen **Raketenhagel auf rivalisierende Scammer oder aufs eigene Büro** [FN].
- **Rainbit:** Büro-Casino zum Verzocken des Geldes [FN].
- **Paint-App, Bildschirmrekorder, Kamera** [ST]. Mindestens ein **Idle-Clicker-Spiel** [FN].
- Fortschritt: Mit jedem Tag wächst das Scam-Arsenal [ST]. Der Boss verkündet bei der Bewertung, welche Apps am nächsten Tag freigeschaltet werden [FN].

### 4.5 Tagesablauf, Quota, Boss
- **Quota:** Das Team verdient gemeinsam auf ein Tagesziel hin. Screenshots zeigen **600 $, 1.400 $, 1.750 $, 2.600 $**, das Ziel steigt also von Tag zu Tag [FN-htp].
- **Ausstempeln:** Ist die Quota erreicht, kann das Team den Tag früher beenden, aber **jeder muss auf seinem Desktop „Clock Out“ drücken** [FN-htp].
- **Leistungsbewertung** durch den „rageaholic boss“, wenn der Countdown endet. Quota erreicht → nächster, schwererer Tag. Verfehlt → gefeuert, der Run endet (Tag Perma Death) [ST][FN]. Screenshot: „Quota missed by $1,000 – You're fired!“, ein weiterer: 1.600 $ von 2.600 $ [FN].
- Die Bewertung hebt **drei stärkste Momente des Tages** hervor und kündigt die Freischaltungen für morgen an [FN-htp].
- **Call Analysis:** eine Projektion an der Wand, die Sätze der Spieler aus Anrufen zitiert. Die schlimmsten Momente werden vor dem Team abgespielt [FN].
- **Kolkata Termination Report** am Run-Ende: gearbeitete Tage, Gesamtbeute des Teams, Rangliste aller Spieler nach verdientem Geld, Spielzeit, Durchschnitt pro Tag. Beispiel: 4 Spieler, 1 Tag, zusammen 4.400 $ [FN].
- Eine Listing-Beschreibung erwähnt **fliegende Tacker bei der Chef-Bewertung** und Streiche unter Kollegen (unsicher, Einzelquelle) [Suchauszug].

### 4.6 Gefahren
- **Computerviren** (von Scambaitern). Viren können den **Monitor in Brand setzen** [FN].
- **Polizeirazzien, Luftangriffe** und „andere Arbeitsplatz-Katastrophen“ [ST]. Wie sie ausgelöst werden und wie man sie abwehrt, ist nicht dokumentiert [FN].
- Rivalisierende Scammer gibt es (Ziel des Raketenhagels) [FN].

### 4.7 Multiplayer
- Online-Koop mit Freunden oder in öffentlichen Lobbys, dazu Einzelspieler [ST].
- **Maximale Spielerzahl nicht angekündigt.** Ein offizieller Screenshot zeigt **8 Spieler** in einer Sitzung [FN-faq]. ([XB] nennt 6, ist aber ein anderes Spiel.)
- Sprachchat unter den Spielern ist anzunehmen, weil das Spiel auf Sprache ausgelegt ist. Proximity-Chat ist im Original **nicht belegt**.

### 4.8 Mods
- Eigene Anrufer-Persönlichkeiten per **JSON** plus **WAV für Voice-Cloning** [ST]. Schema, Sample-Länge und Installationsort sind noch nicht veröffentlicht [FN-mods].

### 4.9 Achievements, Skins, Statistiken
- **Achievements:** in keiner Quelle erwähnt.
- **Skins:** nicht belegt.
- **Statistiken:** Termination Report (siehe oben).

## 5. Was die Community liebt
- „One of the funniest co-op games we've played“ [YT]. Die Komik entsteht aus den unvorhersehbaren KI-Gesprächen und dem Eskalieren von Viren über Razzien bis zu Luftangriffen [CG][YT].
- Starkes Interesse: 12.000+ Playtest-Anmeldungen, 100k+ Wunschlisten, ein Steam-Forum mit über 840 Themen, die meisten davon Bitten um Einladungen [FN][FW].

## 6. Was nervt (oder Sorgen macht)
- **Zugang:** geschlossener Playtest, Einladungsbettelei, gefälschte Playtest-Keys und gefälschte Downloads mit Malware [FN][FW].
- **Cloud-KI:** Internet ist immer nötig, auch solo. Spieler sorgen sich um Datenschutz (werden Stimme und Gespräche gespeichert?) und wünschen sich lokale Modelle [SD]. Kosten für die KI (im Playtest 8 $ extra) [FN].
- **Mikrofonzwang:** unklar, ob man auch nur tippen kann [FN-faq].
- **Abnutzung:** Wenn die KI durchschaut ist, wirken immer dieselben Sätze [CG].
- **Unfertig:** Early-Access-Warnung vor Bugs, Balance-Änderungen und rauen Kanten [ST]. Die Gefahren sind schlecht dokumentiert [FN].
- **Nur Windows**, keine Mobil- oder Mac-Version [FN-platforms].

## 7. Nicht belegt bzw. Lücken (werden im Design entschieden)
Konkrete Dauer eines Tages, Klingel-/Abnehmzeit, Auszahlungen außer 250 $, Quota-Formel, vollständige Liste der 45+ Apps, alle Scam-Typen, Shop-Preise, Casino-Spiele, Auslöser und Ablauf von Razzia, Luftangriff und Virus, Verhalten des Bosses abseits der Bewertung, maximale Spielerzahl, Achievements, Skins, Menüs und Einstellungen im Detail.

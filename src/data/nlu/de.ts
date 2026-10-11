import type { DemandKind, Intent, Role, Topic } from '../../systems/conversation/types';

/**
 * Deutsches Lexikon des Sprachverständnisses. Einträge: Wort oder Wortgruppe, optional mit Gewicht
 * (Standard 1). Schreibweise beliebig – beim Laden normalisiert (klein, ä → ae …).
 * Alles ist Spielwelt: Rollen und Forderungen sind absichtlich allgemein und albern gehalten.
 */
export type LexEntry = string | readonly [string, number];

export const INTENT_LEX: Readonly<Record<Intent, readonly LexEntry[]>> = {
  greet: [
    'hallo', 'guten tag', 'guten morgen', 'guten abend', 'moin', 'moin moin', 'servus', 'grüß gott', 'grüezi', 'hi', 'hey', 'tag auch',
    'einen schönen tag', 'seien sie gegrüßt', 'ahoi', 'tachchen', 'na du', ['hallöchen', 1.2], 'grüße', 'willkommen',
  ],
  introduce: [
    ['ich bin', 0.8], ['mein name ist', 1.2], ['hier spricht', 1.2], ['hier ist', 0.8], ['ich heiße', 1.2], ['ich rufe an', 1], ['ich rufe sie an', 1],
    ['ich rufe im auftrag', 1.3], ['im auftrag', 0.9], ['von der', 0.4], ['vom', 0.3], ['zuständig', 0.8], ['mitarbeiter', 0.8], ['abteilung', 0.7],
    ['ihr berater', 1], ['ihre beraterin', 1], ['sachbearbeiter', 1], ['kundendienst', 1], ['ansprechpartner', 0.8],
  ],
  smalltalk: [
    'wetter', 'wie geht es', 'wie gehts', 'wie geht es ihnen', 'wie war ihr tag', 'urlaub', 'wochenende', 'garten', 'hobby', 'hobbys', 'familie',
    'kaffee', 'kuchen', 'fernsehen', 'serie', 'sonne', 'regen', 'schnee', 'frühling', 'sommer', 'herbst', 'winter', 'feierabend', 'lieblings',
    'was machen sie', 'erzählen sie', 'interessant', 'spannend', 'schön zu hören', 'haustier', 'katze', 'hund', 'enkel', 'rezept', 'musik',
  ],
  compliment: [
    ['schöne stimme', 1.5], ['angenehme stimme', 1.5], ['sympathisch', 1.2], 'nett', 'freundlich', 'klug', 'schlau', 'toll', 'wunderbar', 'großartig',
    'beeindruckend', 'bewundere', 'bewundernswert', 'charmant', 'reizend', 'elegant', 'jung', ['sie klingen jung', 1.5], 'kompliment', 'genial',
    'fantastisch', 'super', 'klasse', 'stark', 'respekt', 'hut ab', 'vorbildlich', 'herzlich', 'liebenswert', 'kluger kopf', 'fesch',
  ],
  empathy: [
    ['das tut mir leid', 1.2], ['verstehe', 0.8], ['ich verstehe sie', 1.3], 'nachvollziehen', 'mitgefühl', 'sorgen', ['das ist schwer', 1.2],
    'schrecklich', 'furchtbar', ['sie armer', 1], ['sie arme', 1], 'einsam', 'kummer', ['ich höre zu', 1.3], ['erzählen sie ruhig', 1.2], 'traurig',
    ['das klingt hart', 1.2], ['ich bin für sie da', 1.5], 'tröste', 'trösten',
  ],
  urgency: [
    'schnell', 'sofort', 'dringend', 'eilig', 'beeilen', ['keine zeit', 1.2], 'notfall', 'unverzüglich', 'jetzt sofort', ['gleich jetzt', 1.2], 'zack',
    ['heute noch', 1], 'frist', 'letzte chance', 'nur noch heute', 'eile', 'zügig', 'tempo',
  ],
  threat: [
    'sonst', 'verhaftet', 'verhaftung', 'strafe', 'anzeige', 'gefängnis', 'knast', 'konsequenzen', 'warnung', 'gesperrt', 'sperren', 'pfändung',
    'pfänden', 'abgeholt', 'ärger', 'probleme bekommen', 'bereuen', 'gnade', 'drohe', 'kündigung', 'räumung', 'beschlagnahmt', 'haftbefehl',
  ],
  calm: [
    ['keine sorge', 1.4], ['keine angst', 1.4], 'beruhigen', 'entspannen', ['alles gut', 1.2], ['alles in ordnung', 1.2], 'ruhig', ['kein problem', 1],
    'sicher', ['ganz entspannt', 1.2], ['nur die ruhe', 1.3], ['das kriegen wir hin', 1.3], 'geduld', ['ich helfe ihnen', 1.3], 'gemeinsam', 'vertrauen sie',
  ],
  explain: [
    'weil', 'denn', 'deshalb', 'deswegen', 'nämlich', ['das bedeutet', 1.2], 'erklären', ['es geht um', 1.2], ['und zwar', 1], 'damit', 'also',
    'sozusagen', ['ich erkläre', 1.3], 'grund', 'hintergrund', 'zum beispiel', 'vorschrift', 'regel', 'verfahren', 'ablauf', 'schritt',
  ],
  demand: [
    ['geben sie mir', 1.2], ['sagen sie mir', 1], ['nennen sie', 1.2], ['lesen sie vor', 1.3], ['vorlesen', 1.1], ['ich brauche', 0.9], ['brauche ihre', 1.2],
    ['bestätigen sie', 0.9], ['diktieren', 1.2], ['buchstabieren', 1], ['her damit', 1.5], ['rücken sie raus', 1.5], ['raus damit', 1.4], 'verraten',
  ],
  confirm: ['ja', 'genau', 'richtig', 'stimmt', 'korrekt', 'jawohl', 'okay', 'ok', 'einverstanden', 'gut', 'sicher doch', 'natürlich', 'selbstverständlich', 'klar', 'jo', 'jep'],
  deny: ['nein', 'nö', 'nee', 'niemals', ['auf keinen fall', 1.3], 'falsch', ['stimmt nicht', 1.2], 'keineswegs', 'quatsch'],
  insult: [
    'idiot', 'dumm', 'blöd', 'depp', 'trottel', 'nervig', ['halt die klappe', 2], 'schnauze', 'lächerlich', 'vollpfosten', 'dämlich', 'doof', 'hohlkopf',
    'nervensäge', 'langweiler', ['alter sack', 2], 'schrulle', 'spinner', 'opfer', 'versager', 'witzfigur', 'pfeife', 'flasche', 'hornochse', 'schwachkopf',
  ],
  apology: ['entschuldigung', 'sorry', ['tut mir leid', 1.2], 'verzeihung', 'pardon', 'entschuldigen sie', 'mein fehler', 'verzeihen sie', 'entschuldige'],
  laugh: ['haha', 'hahaha', 'hehe', 'hihi', 'lol', 'lustig', 'witzig', 'xd', 'witz', 'scherz', 'kicher', 'prust'],
  thanks: ['danke', 'vielen dank', 'dankeschön', 'herzlichen dank', 'merci', 'besten dank', 'lieb von ihnen'],
  farewell: ['tschüss', 'auf wiederhören', 'auf wiedersehen', 'bis dann', 'ciao', 'tschau', 'bis bald', 'schönen tag noch', 'machen sie es gut', 'adieu'],
  promise: ['versprochen', 'versprechen', 'garantiert', 'garantie', 'ehrenwort', ['ich schwöre', 1.3], 'zusage', 'sie bekommen', 'sie erhalten', 'gratis', 'kostenlos'],
};

/** Rollen-Wörter; als Behauptung zählen sie zusammen mit Vorstellung oder „von der …“. */
export const ROLE_LEX: Readonly<Record<Role, readonly string[]>> = {
  bank: ['bank', 'konto', 'filiale', 'geldinstitut', 'kredit', 'sparbuch', 'bankberater', 'kontoführung', 'überweisung'],
  amt: ['amt', 'behörde', 'rentenamt', 'rentenkasse', 'ministerium', 'beamter', 'beamtin', 'verwaltung', 'stadt schwindelheim', 'bürgeramt', 'formular', 'antrag'],
  technik: ['technik', 'support', 'techniker', 'computer', 'rechner', 'virus', 'internet', 'software', 'sicherheitsupdate', 'it abteilung', 'netzwerk', 'router', 'drucker'],
  familie: ['enkel', 'enkelin', 'sohn', 'tochter', 'neffe', 'nichte', 'oma', 'opa', 'mama', 'papa', 'cousin', 'cousine', 'schwiegersohn', 'verwandt', 'familie'],
  gewinn: ['gewinn', 'gewonnen', 'preis', 'lotterie', 'verlosung', 'glückwunsch', 'jackpot', 'hauptgewinn', 'gewinnspiel', 'auslosung', 'prämie'],
  polizei: ['polizei', 'kommissar', 'kommissarin', 'wachtmeister', 'ermittlung', 'ermittler', 'kripo', 'streife', 'dienstausweis'],
  arzt: ['arzt', 'ärztin', 'doktor', 'praxis', 'arztpraxis', 'krankenkasse', 'rezept', 'impfung', 'befund', 'untersuchung'],
  lieferung: ['paket', 'lieferung', 'zustellung', 'kurier', 'bote', 'sendung', 'versand', 'abholung', 'paketdienst'],
  krypto: ['krypto', 'coin', 'token', 'blockchain', 'wallet', 'investment', 'rendite', 'mondfahrt', 'hypecoin'],
  raumfahrt: ['mission', 'kontrollzentrum', 'raumstation', 'orbit', 'bodenstation', 'flugleitung', 'countdown', 'raumfahrtbehörde'],
  kirche: ['kirche', 'gemeinde', 'kirchengemeinde', 'pfarrer', 'pastor', 'kollekte', 'spende', 'nächstenliebe', 'segen'],
  presse: ['zeitung', 'reporter', 'reporterin', 'interview', 'umfrage', 'redaktion', 'fernsehen', 'sender', 'journalist'],
};

export const DEMAND_LEX: Readonly<Record<DemandKind, readonly string[]>> = {
  nummer: ['nummer', 'bürgernummer', 'rentennummer', 'kundennummer', 'kennnummer', 'ausweisnummer', 'versichertennummer', 'ziffern'],
  code: ['code', 'guck code', 'zugangscode', 'pin', 'tan', 'passwort', 'kennwort', 'geheimzahl', 'bestätigungscode'],
  gutschein: ['gutschein', 'gutscheincode', 'guthabenkarte', 'karte rubbeln', 'rubbeln', 'geschenkkarte'],
  geld: ['geld überweisen', 'geld schicken', 'geld geben', 'geld senden', 'geld abheben', 'überweisen', 'überweisung', 'bezahlen', 'zahlen', 'gebühr', 'bargeld', 'taler', 'kaution', 'vorkasse'],
  daten: ['adresse', 'geburtstag', 'geburtsdatum', 'daten', 'mädchenname', 'kontodaten', 'zugangsdaten'],
  klick: ['klicken', 'link', 'herunterladen', 'installieren', 'fernzugriff', 'ferngucker', 'programm öffnen', 'freigeben'],
  jawort: ['sagen sie ja', 'sagen sie einfach ja', 'bestätigen sie mit ja', 'nur ein ja', 'unterschreiben', 'zustimmen'],
};

export const TOPIC_LEX: Readonly<Record<Topic, readonly string[]>> = {
  katzen: ['katze', 'katzen', 'kater', 'mieze', 'miau', 'kätzchen', 'schnurren'],
  hunde: ['hund', 'hunde', 'dackel', 'welpe', 'gassi', 'wauwau', 'bello'],
  garten: ['garten', 'blumen', 'rosen', 'tomaten', 'beet', 'gießen', 'gartenzwerg', 'kompost', 'rasen'],
  familie: ['enkel', 'enkelin', 'kinder', 'familie', 'sohn', 'tochter', 'hochzeit', 'geburtstag'],
  sterne: ['sterne', 'sternzeichen', 'horoskop', 'mond', 'vollmond', 'planet', 'astrologie', 'skorpion', 'widder', 'jungfrau', 'löwe', 'waage'],
  omen: ['omen', 'glück', 'unglück', 'schwarze katze', 'zauber', 'fluch', 'hexe', 'kristallkugel', 'kräuter', 'prophezeiung', 'vorzeichen', 'aberglaube'],
  raumfahrt: ['rakete', 'weltraum', 'astronaut', 'raumstation', 'orbit', 'mission', 'schwerelos', 'countdown', 'galaxie', 'komet'],
  protokoll: ['protokoll', 'vorschrift', 'dienstweg', 'checkliste', 'formular', 'dienstgrad', 'kommandantin', 'befehl', 'ordnung', 'meldung'],
  krypto: ['krypto', 'coin', 'hypecoin', 'blockchain', 'to the moon', 'mond', 'hodl', 'wallet', 'nft', 'rendite', 'diamanthände'],
  geld: ['geld', 'reich', 'vermögen', 'zinsen', 'aktien', 'investieren', 'sparen', 'taler', 'gewinn'],
  mode: ['mode', 'outfit', 'kleid', 'schuhe', 'handtasche', 'stil', 'look', 'glitzer', 'trend', 'designer'],
  socialmedia: ['follower', 'likes', 'story', 'video', 'kanal', 'abonnenten', 'viral', 'influencer', 'hashtag', 'post', 'reel', 'livestream'],
  fitness: ['fitness', 'training', 'muskeln', 'gym', 'protein', 'gains', 'hantel', 'bankdrücken', 'workout', 'bizeps', 'bro'],
  essen: ['essen', 'kochen', 'braten', 'schnitzel', 'suppe', 'kartoffeln', 'lecker', 'hunger', 'rezept'],
  kuehe: ['kuh', 'kühe', 'stall', 'hof', 'trecker', 'traktor', 'melken', 'weide', 'heu', 'rinder', 'bauernhof', 'liesl'],
  technik: ['computer', 'handy', 'internet', 'app', 'software', 'technik', 'roboter', 'gerät', 'smartphone', 'update'],
  spiele: ['spiel', 'spiele', 'zocken', 'skin', 'skins', 'level', 'gamer', 'konsole', 'loot', 'battle pass', 'noob', 'gg'],
  kirche: ['kirche', 'gott', 'gebet', 'beten', 'segen', 'gemeinde', 'glaube', 'himmel', 'engel', 'kollekte', 'chor', 'predigt'],
  reisen: ['reise', 'reisen', 'kreuzfahrt', 'schiff', 'urlaub', 'strand', 'meer', 'insel', 'koffer', 'buffet', 'kabine', 'hafen'],
  luxus: ['luxus', 'exklusiv', 'champagner', 'kaviar', 'jacht', 'villa', 'limousine', 'gold', 'diamant', 'erlesen', 'edel', 'premium'],
  verschwoerung: ['verschwörung', 'echsenmenschen', 'aliens', 'regierung', 'geheim', 'vertuschung', 'chemtrails', 'aluhut', 'beweise', 'die da oben', 'wahrheit'],
  erfindungen: ['erfindung', 'erfinden', 'maschine', 'zeitmaschine', 'labor', 'experiment', 'apparat', 'patent', 'fluxkompensator', 'zahnrad', 'blitz'],
  wissenschaft: ['wissenschaft', 'studie', 'forschung', 'professor', 'theorie', 'fachbegriff', 'akademisch', 'universität', 'latein', 'quelle'],
  grammatik: ['grammatik', 'dativ', 'genitiv', 'komma', 'rechtschreibung', 'duden', 'konjunktiv', 'satzbau', 'apostroph'],
  klatsch: ['klatsch', 'tratsch', 'gerücht', 'nachbarin', 'neuigkeit', 'skandal', 'hast du gehört', 'erzählt man sich', 'geheimnis'],
  schlaf: ['schlaf', 'schlafen', 'müde', 'nickerchen', 'bett', 'gähn', 'kissen', 'mittagsschlaf', 'decke', 'träumen'],
  beschwerde: ['beschwerde', 'beschweren', 'vorgesetzter', 'chef', 'reklamation', 'unverschämtheit', 'skandal', 'frechheit', 'kundenservice', 'wartezeit'],
  musik: ['musik', 'lied', 'singen', 'schlager', 'konzert', 'band', 'gitarre', 'klavier', 'chor', 'tanzen'],
  wetter: ['wetter', 'regen', 'sonne', 'gewitter', 'schnee', 'wind', 'kalt', 'warm', 'hitze'],
  kaffee: ['kaffee', 'espresso', 'tasse', 'koffein', 'cappuccino', 'filterkaffee'],
  kuchen: ['kuchen', 'torte', 'backen', 'plätzchen', 'streuselkuchen', 'sahne', 'gebäck'],
  polizei: ['polizei', 'anzeige', 'anwalt', 'gericht', 'richter', 'verhaftung', 'kommissar'],
  magie: ['magie', 'zauber', 'zaubertrank', 'besen', 'hexenhut', 'kessel', 'spruch', 'mondschein', 'kräuterhexe'],
  autos: ['auto', 'motor', 'ps', 'tuning', 'felgen', 'garage', 'rennen'],
  fussball: ['fußball', 'tor', 'verein', 'stadion', 'spieltag', 'elfmeter', 'abseits'],
  buecher: ['buch', 'bücher', 'lesen', 'roman', 'bibliothek', 'gedicht', 'krimi'],
};

export const NEGATIONS: readonly string[] = ['nicht', 'kein', 'keine', 'keinen', 'keiner', 'keinem', 'nie', 'niemals', 'ohne'];

/** Höfliche Wörter (Siezen zählt mit). */
export const POLITE: readonly string[] = ['bitte', 'danke', 'gerne', 'sie', 'ihnen', 'ihr', 'freundlich', 'höflich', 'verehrte', 'verehrter', 'liebe', 'lieber'];

/** Füllwörter: zählen weder als bekannt noch als unbekannt. */
export const STOPWORDS: readonly string[] = [
  'ich', 'du', 'er', 'es', 'wir', 'ihr', 'sie', 'mich', 'mir', 'dich', 'dir', 'uns', 'euch', 'ihnen', 'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine',
  'einen', 'einem', 'einer', 'und', 'oder', 'aber', 'mit', 'von', 'vom', 'zu', 'zum', 'zur', 'in', 'im', 'an', 'am', 'auf', 'aus', 'bei', 'nach', 'für',
  'über', 'unter', 'um', 'so', 'wie', 'was', 'wer', 'wo', 'wann', 'warum', 'ist', 'sind', 'bin', 'bist', 'war', 'waren', 'habe', 'haben', 'hat', 'hast',
  'wird', 'werden', 'kann', 'können', 'muss', 'müssen', 'soll', 'sollen', 'will', 'wollen', 'mal', 'noch', 'schon', 'auch', 'nur', 'doch', 'ja', 'da',
  'hier', 'dort', 'jetzt', 'dann', 'denn', 'dass', 'wenn', 'ob', 'mein', 'meine', 'meinen', 'ihre', 'ihren', 'ihrem', 'sein', 'seine', 'man', 'eben',
  'halt', 'etwa', 'gerade', 'sehr', 'ganz', 'bitte', 'herr', 'frau', 'gut', 'nicht', 'kein', 'keine', 'als', 'bis', 'durch', 'gegen', 'ohne', 'sich',
  'ihrer', 'ihres', 'meiner', 'meinem', 'meines', 'unser', 'unsere', 'unseren', 'euer', 'eure', 'dein', 'deine', 'deinen', 'diese', 'dieser', 'dieses',
  'diesen', 'jener', 'alle', 'alles', 'viel', 'viele', 'etwas', 'nichts', 'immer', 'heute', 'morgen', 'gestern', 'wieder', 'einfach', 'bereits',
  'würde', 'würden', 'hätte', 'hätten', 'könnte', 'könnten', 'möchte', 'möchten', 'gibt', 'geht', 'machen', 'mache', 'macht', 'sagen', 'sage', 'sagt',
];

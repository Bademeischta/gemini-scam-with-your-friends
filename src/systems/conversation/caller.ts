import type { Intent, Mood, Role, Topic } from './types';

/** Besondere Verhaltensweisen einzelner Anrufer. */
export type Trait =
  /** Explodiert bei Beleidigung oder Schreien; nur eine Entschuldigung beruhigt (Chanti). */
  | 'fragile'
  /** Kaum zu beeindrucken: alles wirkt schwächer, Stimmung träge (Dietmar). */
  | 'stoic'
  /** Köder: verschwendet Zeit, gibt falsche Beute (Kevin, Opa Trollinger). */
  | 'baiter'
  /** Schlägt zurück: beleidigt, will eigenen Coin verkaufen, droht (Moonboy). */
  | 'strikesBack'
  /** Schläft bei Stille ein und muss geweckt werden (Gerd). */
  | 'sleepy'
  /** Redet ununterbrochen, unterbricht (Jacqueline). */
  | 'chatty'
  /** Korrigiert Rechtschreibung und Grammatik, liebt lange, saubere Sätze (Professor). */
  | 'grammar'
  /** Mehrere Stimmen auf Lautsprecher (Familie Krawallski). */
  | 'speaker'
  /** Beschwert sich und verlangt den Vorgesetzten (Detlef). */
  | 'complainer'
  /** Will Protokoll: Vorstellung mit Rolle und Name, Erklärungen (Kommandantin). */
  | 'protocol'
  /** Deutet Zahlen und Zeichen als Omen (Walpurga). */
  | 'omens'
  /** Liest Zahlen besonders sorgfältig vor (Hildegard). */
  | 'careful';

export type Difficulty = 'leicht' | 'mittel' | 'schwer';

export interface Temperament {
  /** Wie schnell die Stimmung kippt (0,5 träge … 2 sprunghaft). */
  volatility: number;
  /** Neigung zu Ärger (Beleidigung, Drohung, Druck). */
  irritability: number;
  /** Neigung zu Angst (Drohung, Dringlichkeit). */
  fearfulness: number;
  /** Sinn für Humor (Lachen, Unsinn kann amüsieren statt verwirren). */
  humor: number;
  /** Grund-Misstrauen (Widersprüche, Forderungen). */
  suspicion: number;
}

export interface VoiceDef {
  /** Tonhöhe für die Sprachsynthese (0,5–2). */
  pitch: number;
  /** Sprechtempo (0,6–1,6). */
  rate: number;
  /** Grundfrequenz der Brabbel-Stimme (Hz). */
  babble: number;
  female: boolean;
}

/** Bausteine des prozeduralen Porträts (NPC-26). */
export interface PortraitDef {
  skin: 0 | 1 | 2 | 3;
  hair: 'none' | 'bun' | 'short' | 'long' | 'curly' | 'spiky' | 'mohawk' | 'bald' | 'ponytail' | 'side';
  hairColor: 'grau' | 'weiss' | 'braun' | 'schwarz' | 'blond' | 'rot' | 'pink' | 'blau';
  hat?: 'hexe' | 'helm' | 'kappe' | 'zylinder' | 'muetze' | 'stroh' | 'cap' | 'krone';
  glasses?: 'rund' | 'sonne' | 'dick' | 'monokel';
  beard?: 'voll' | 'schnauz' | 'stoppel' | 'kinn';
  extra?: 'ohrringe' | 'kragen' | 'headset' | 'schweiss' | 'perlen' | 'pflaster' | 'zahnluecke' | 'sommersprossen';
  shirt: 'red' | 'blue' | 'teal' | 'mustard' | 'violet' | 'leaf' | 'ink2' | 'paper' | 'rose' | 'coffee';
  /** Mehrere Köpfe (Lautsprecher-Familie). */
  group?: boolean;
}

export interface CallerDef {
  id: string;
  /** Vorname, Nachname, Spitzname (für „Name genannt“; Anzeige über i18n callers.<id>.name). */
  names: readonly string[];
  difficulty: Difficulty;
  /** Start-Vertrauen in % (zufällig dazwischen). */
  startTrust: readonly [number, number];
  /** Sekunden ohne Eingabe bis zur Ungeduld (Standard TUNING.calls.patienceSeconds). */
  patience?: number;
  temper: Temperament;
  /** ΔVertrauen je Absicht (ergänzt bzw. ersetzt die Standardgewichte). */
  intents?: Partial<Record<Intent, number>>;
  /** Wirkung einer behaupteten Rolle (+ glaubwürdig, − rotes Tuch). */
  roles?: Partial<Record<Role, number>>;
  likes: readonly Topic[];
  dislikes: readonly Topic[];
  /** Vertrauen, ab dem sensible Forderungen klappen (Standard TUNING.calls.demandThreshold). */
  demandThreshold?: number;
  traits?: readonly Trait[];
  /** Start-Stimmung (Standard neutral). */
  startMood?: Mood;
  voice: VoiceDef;
  portrait: PortraitDef;
}

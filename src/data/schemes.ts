import type { DemandKind, Role } from '../systems/conversation/types';

/**
 * Wohin die Beute einer Masche gehört: Ident-o-Mat (Bürgernummer), FernGucker (Guck-Code → Opfer-PC),
 * Gutschein-Kasse, Plauderbude (Login-Code nach Turbo-Geschenk), die Skript-App der Masche selbst
 * (Zahlungs-Code) oder automatisch (z. B. drei mitgeschnittene „Ja“).
 */
export type SchemeInput = 'identomat' | 'ferngucker' | 'gutschein' | 'plauderbude' | 'script' | 'auto';

/** Eine Masche (SCH-01–16): Daten für Engine, Skript-App und Auszahlung. Texte unter i18n `schemes.<id>`. */
export interface SchemeDef {
  id: string;
  /** Forderungen in dieser Reihenfolge (Goldfisch-Finanzamt: erst Bürgernummer, dann Gutschein). */
  demands: readonly DemandKind[];
  input: SchemeInput;
  /** Auszahlung in ₮ (zufällig dazwischen, vor Tages- und Schwierigkeits-Zuschlag). */
  payout: readonly [number, number];
  /** Rollen, mit denen die Masche glaubwürdig klingt (Vorstellung). */
  roles: readonly Role[];
  /** Schlüsselwörter, an denen das Sprachverständnis den Pitch erkennt. */
  keywords: readonly string[];
  /** Anrufer, bei denen die Masche besonders gut bzw. schlecht zieht (SCH-17). */
  fans: readonly string[];
  skeptics: readonly string[];
  /** Ab welchem Arbeitstag verfügbar (Freischalt-Plan DAY-10, „immer absurder“). */
  unlockDay: number;
}

export const SCHEMES: readonly SchemeDef[] = [
  {
    id: 'rentennummer',
    demands: ['nummer'],
    input: 'identomat',
    payout: [250, 250],
    roles: ['amt', 'bank'],
    keywords: ['rente', 'rentennummer', 'rentenerhöhung', 'rentenamt', 'nachzahlung', 'rentenbescheid', 'rentenkasse'],
    fans: ['hildegard', 'rosi', 'gerd', 'jacqueline'],
    skeptics: ['zoe', 'dietmar', 'stella'],
    unlockDay: 1,
  },
  {
    id: 'ferngucker',
    demands: ['code'],
    input: 'ferngucker',
    payout: [450, 900],
    roles: ['technik', 'bank'],
    keywords: ['virus', 'fernwartung', 'ferngucker', 'sicherheitslücke', 'hacker', 'trojaner', 'computer reparieren'],
    fans: ['hildegard', 'rosi', 'benedikt', 'gerd'],
    skeptics: ['zoe', 'igor', 'besserwisser'],
    unlockDay: 3,
  },
  {
    id: 'turbo',
    demands: ['code'],
    input: 'plauderbude',
    payout: [300, 300],
    roles: ['gewinn', 'technik'],
    keywords: ['turbo', 'turbo geschenk', 'plauderbude', 'geschenk', 'turbo abo', 'premium status'],
    fans: ['zoe', 'kevin', 'chantal', 'bodo'],
    skeptics: ['dietmar', 'henrietta', 'hinnerk'],
    unlockDay: 2,
  },
  {
    id: 'gutschein',
    demands: ['gutschein'],
    input: 'gutschein',
    payout: [80, 300],
    roles: ['amt', 'polizei', 'technik'],
    keywords: ['gutschein kaufen', 'gutscheinkarte', 'kiosk', 'tankstelle', 'gutscheine besorgen', 'begleichen'],
    fans: ['hildegard', 'gerd', 'jacqueline', 'krawallski'],
    skeptics: ['zoe', 'besserwisser', 'dietmar'],
    unlockDay: 2,
  },
  {
    id: 'orbit',
    demands: ['geld'],
    input: 'script',
    payout: [450, 550],
    roles: ['familie', 'raumfahrt'],
    keywords: ['raumstation', 'rückflug', 'rückflugticket', 'orbit', 'weltraum', 'festsitzen', 'gestrandet', 'enkel im orbit'],
    fans: ['hildegard', 'rosi', 'walpurga', 'benedikt'],
    skeptics: ['stella', 'zoe', 'dietmar'],
    unlockDay: 4,
  },
  {
    id: 'mond',
    demands: ['geld'],
    input: 'script',
    payout: [550, 700],
    roles: ['gewinn', 'krypto', 'presse'],
    keywords: ['mondgrundstück', 'grundstück', 'mondrückseite', 'krater', 'parzelle', 'erdblick', 'grundstück auf dem mond'],
    fans: ['henrietta', 'moonboy', 'agnes', 'igor'],
    skeptics: ['stella', 'besserwisser', 'hinnerk'],
    unlockDay: 4,
  },
  {
    id: 'pinguin',
    demands: ['geld'],
    input: 'script',
    payout: [400, 500],
    roles: ['amt', 'familie'],
    keywords: ['pinguin', 'erbschaft', 'erbe', 'königshaus', 'prinz', 'testament', 'eisscholle'],
    fans: ['henrietta', 'jacqueline', 'desiree', 'rosi'],
    skeptics: ['dietmar', 'besserwisser', 'zoe'],
    unlockDay: 5,
  },
  {
    id: 'atlantis',
    demands: ['geld'],
    input: 'script',
    payout: [350, 450],
    roles: ['gewinn'],
    keywords: ['atlantis', 'lotto', 'unterwasser', 'tauchgebühr', 'lotterie', 'tiefsee', 'muschel'],
    fans: ['rosi', 'gerd', 'krawallski', 'walpurga'],
    skeptics: ['dietmar', 'zoe', 'stella'],
    unlockDay: 6,
  },
  {
    id: 'toaster',
    demands: ['code'],
    input: 'ferngucker',
    payout: [450, 700],
    roles: ['technik'],
    keywords: ['toaster', 'toastbrot', 'kurzschluss', 'küchengerät', 'fernwartung', 'krümel'],
    fans: ['gerd', 'krawallski', 'hinnerk', 'hildegard'],
    skeptics: ['igor', 'zoe', 'besserwisser'],
    unlockDay: 5,
  },
  {
    id: 'goldfisch',
    demands: ['nummer', 'gutschein'],
    input: 'script',
    payout: [650, 750],
    roles: ['amt'],
    keywords: ['goldfisch', 'goldfischsteuer', 'finanzamt', 'steuer', 'aquarium', 'nachzahlung'],
    fans: ['detlef', 'benedikt', 'hildegard', 'gerd'],
    skeptics: ['besserwisser', 'agnes', 'zoe'],
    unlockDay: 7,
  },
  {
    id: 'abo',
    demands: ['jawort', 'jawort', 'jawort'],
    input: 'auto',
    payout: [300, 400],
    roles: ['gewinn', 'presse'],
    keywords: ['luftgitarre', 'luftgitarren', 'abo', 'probemonat', 'rockstar', 'solo', 'unterricht'],
    fans: ['bodo', 'desiree', 'krawallski', 'zoe'],
    skeptics: ['besserwisser', 'henrietta', 'dietmar'],
    unlockDay: 7,
  },
  {
    id: 'zeitreise',
    demands: ['geld'],
    input: 'script',
    payout: [600, 700],
    roles: ['technik', 'amt'],
    keywords: ['zeitreise', 'versicherung', 'police', 'gestern', 'zeitmaschine', 'paradoxon', 'vergangenheit'],
    fans: ['igor', 'agnes', 'walpurga', 'gerd'],
    skeptics: ['stella', 'besserwisser', 'dietmar'],
    unlockDay: 8,
  },
  {
    id: 'coin',
    demands: ['geld'],
    input: 'script',
    payout: [700, 850],
    roles: ['krypto'],
    keywords: ['schwindelcoin', 'coin', 'krypto', 'investieren', 'rendite', 'kurs', 'einsteigen'],
    fans: ['moonboy', 'bodo', 'kevin', 'chantal'],
    skeptics: ['hildegard', 'benedikt', 'dietmar', 'hinnerk'],
    unlockDay: 9,
  },
  {
    id: 'wasser',
    demands: ['geld'],
    input: 'script',
    payout: [250, 350],
    roles: ['arzt'],
    keywords: ['wunderwasser', 'heilwasser', 'montag', 'quelle', 'flasche', 'heilkraft', 'kur'],
    fans: ['agnes', 'walpurga', 'gerd', 'detlef'],
    skeptics: ['besserwisser', 'stella', 'igor'],
    unlockDay: 8,
  },
  {
    id: 'dinner',
    demands: ['geld'],
    input: 'script',
    payout: [500, 600],
    roles: ['gewinn', 'presse'],
    keywords: ['dinner', 'heino hallodri', 'hallodri', 'schlagerstar', 'abendessen', 'promi', 'platzgebühr'],
    fans: ['rosi', 'jacqueline', 'chantal', 'desiree'],
    skeptics: ['zoe', 'dietmar', 'besserwisser'],
    unlockDay: 9,
  },
  {
    id: 'klammer',
    demands: ['geld'],
    input: 'script',
    payout: [200, 300],
    roles: ['kirche', 'presse'],
    keywords: ['büroklammer', 'büroklammern', 'spende', 'rettung', 'artenschutz', 'klammer', 'patenschaft'],
    fans: ['benedikt', 'hildegard', 'walpurga', 'rosi'],
    skeptics: ['moonboy', 'dietmar', 'zoe'],
    unlockDay: 6,
  },
];

export function schemeById(id: string): SchemeDef | undefined {
  return SCHEMES.find((s) => s.id === id);
}

/** Standard-Masche für Beute ohne gewählte Masche (die Eingabe-App erkennt sie trotzdem). */
export const DEFAULT_SCHEME_FOR: Partial<Record<DemandKind, string>> = { nummer: 'rentennummer', code: 'ferngucker', gutschein: 'gutschein' };

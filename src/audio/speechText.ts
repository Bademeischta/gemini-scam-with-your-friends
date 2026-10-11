/** Aufbereitung von Anrufer-Zeilen für die Sprachausgabe (ohne Browser-Abhängigkeit, testbar). */

export interface SpeechSegment {
  text: string;
  /** Sprecher bei Lautsprecher-Anrufen (z. B. „Mama“), sonst null. */
  speaker: string | null;
}

/**
 * Teilt eine Zeile in sprechbare Abschnitte: Regieanweisungen in eckigen Klammern fallen weg,
 * Sprecher-Kürzel („Mama: … Papa: …“) werden zu eigenen Abschnitten, Sonderzeichen werden ausgeschrieben.
 */
export function speechSegments(line: string, speakers: readonly string[] = [], words: { currency: string; percent: string } = { currency: 'Taler', percent: 'Prozent' }): SpeechSegment[] {
  const plain = line
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/₮/g, ` ${words.currency}`)
    .replace(/%/g, ` ${words.percent}`)
    .replace(/[„“”‚‘’"]/g, '')
    .replace(/…/g, ', ')
    .replace(/[*_|<>~^]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return [];
  if (speakers.length === 0) return [{ text: plain, speaker: null }];
  const names = speakers.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const re = new RegExp(`(?:^|\\s)(${names}):\\s*`, 'g');
  const out: SpeechSegment[] = [];
  let last = 0;
  let speaker: string | null = null;
  for (const m of plain.matchAll(re)) {
    const chunk = plain.slice(last, m.index).trim();
    if (chunk) out.push({ text: chunk, speaker });
    speaker = m[1]!;
    last = m.index + m[0].length;
  }
  const rest = plain.slice(last).trim();
  if (rest) out.push({ text: rest, speaker });
  return out;
}

/** Silben-Takt für die Brabbel-Stimme: Vokale als Tonhöhen-Färbung (0–1), Satzzeichen als Pause (-1). */
export function babbleSyllables(text: string): number[] {
  const out: number[] = [];
  const vowels = 'aeiouäöüy';
  for (const ch of text.replace(/\[[^\]]*\]/g, '').toLowerCase()) {
    const v = vowels.indexOf(ch);
    if (v >= 0) out.push(v / (vowels.length - 1));
    else if ('.,!?;:…–'.includes(ch)) out.push(-1);
  }
  return out;
}

/** Geschlecht einer Systemstimme aus ihrem Namen raten (für die Stimmwahl je Figur). */
const FEMALE = /anna|helena|hedda|katja|marlene|vicki|petra|sabin|lena|amala|elke|klara|louisa|seraphina|tanja|gisela|ingrid|maja|leni|christel|elena|female|frau|weiblich|steffi|julia|eva|monika|nicole|sandra/i;
const MALE = /stefan|markus|hans|conrad|kilian|killian|bernd|christoph|kasper|ralf|florian|jonas|\bmale\b|martin|viktor|yannick|daniel|thomas|klaus|mann|männlich/i;

export function guessFemale(name: string): boolean | null {
  if (FEMALE.test(name)) return true;
  if (MALE.test(name)) return false;
  return null;
}

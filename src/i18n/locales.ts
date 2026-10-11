import type { Dict } from './i18n';
import deBase from '../data/i18n/de.json';
import deCalls from '../data/i18n/de-calls.json';
import deCallers from '../data/i18n/de-callers.json';
import deCards from '../data/i18n/de-cards.json';
import deDay from '../data/i18n/de-day.json';
import deSchemes from '../data/i18n/de-schemes.json';
import en from '../data/i18n/en.json';

/**
 * Sprachdateien. Deutsch ist auf mehrere Dateien verteilt (Oberfläche, allgemeine Anrufer-Zeilen,
 * Figuren, Karten, Maschen samt Diktat-/Fernzugriff-Zeilen und App-Inhalten, Arbeitstag mit Chef, Bewertung und Bericht) und wird hier zu einem Wörterbuch zusammengeführt. Doppelte Blatt-Schlüssel sind ein Fehler.
 */
export function mergeDicts(...parts: Dict[]): Dict {
  const into = (target: Dict, src: Dict, path: string): Dict => {
    for (const [k, v] of Object.entries(src)) {
      const p = path ? `${path}.${k}` : k;
      const cur = target[k];
      if (cur === undefined) target[k] = typeof v === 'string' ? v : into({}, v, p);
      else if (typeof cur === 'string' || typeof v === 'string') throw new Error(`Doppelter i18n-Schlüssel: ${p}`);
      else into(cur, v, p);
    }
    return target;
  };
  return parts.reduce<Dict>((out, d) => into(out, d, ''), {});
}

export const DE: Dict = mergeDicts(deBase as Dict, deCalls as Dict, deCallers as Dict, deCards as Dict, deSchemes as Dict, deDay as Dict);
export const EN: Dict = en as Dict;

import { I18n, type Dict, type Params } from './i18n';
import { DE, EN } from './locales';

/** Referenzsprache: Deutsch. Weitere Sprachen = weitere JSON-Datei in locales.ts eintragen. */
export const LOCALES: Record<string, Dict> = { de: DE, en: EN };
export const DEFAULT_LOCALE = 'de';

export const i18n = new I18n({
  locales: LOCALES,
  fallback: DEFAULT_LOCALE,
  onMissing: (key, locale) => {
    if (import.meta.env.DEV) console.warn(`[i18n] Schlüssel fehlt (${locale}): ${key}`);
  },
});

export function t(key: string, params?: Params): string {
  return i18n.t(key, params);
}

/** Überträgt Texte in DOM-Elemente mit data-i18n="schluessel" (index.html). */
export function applyDomTranslations(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.dataset['i18n'];
    if (key) el.textContent = t(key);
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((el) => {
    const key = el.dataset['i18nAria'];
    if (key) el.setAttribute('aria-label', t(key));
  });
  document.documentElement.lang = i18n.locale;
}

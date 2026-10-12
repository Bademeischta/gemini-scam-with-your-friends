/** „Freunde“ in der Plauderbude (Anzeigenamen unter i18n `apps.plauder.friends.<handle>`). */
export const PLAUDER_FRIENDS: readonly string[] = [
  'tante_gitti',
  'kuchenkarl',
  'hamsterhorst',
  'gewinn_guenni',
  'nachbarin_elli',
  'onkel_otto',
  'miezenmoni',
  'kegelclub_ost',
];

/** Chat-Schlüssel des Anrufers (Handle unter i18n `apps.plauder.callerHandles.<id>`). */
export function callerChat(callerId: string): string {
  return `caller:${callerId}`;
}

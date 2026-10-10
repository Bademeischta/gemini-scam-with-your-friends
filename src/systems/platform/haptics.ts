/** Kurzes Vibrations-Feedback (nur wenn in den Einstellungen erlaubt und vom Gerät unterstützt). */
export function haptic(enabled: boolean, ms: number | number[]): void {
  if (!enabled || typeof navigator === 'undefined') return;
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* nicht unterstützt */
  }
}

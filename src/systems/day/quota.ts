import { TUNING } from '../../config/tuning';

/**
 * Tages-Quota: 600 × (1 + 0,55 × (Tag − 1)) × (1 + 0,75 × (Teamgröße − 1)), auf 50 gerundet.
 * Solo ergibt das 600 · 950 · 1.250 · 1.600 · 1.900 · 2.250 · 2.600 … (Original-Referenzen 600/1.400/1.750/2.600).
 */
export function quotaFor(day: number, teamSize: number, t = TUNING.day): number {
  const d = Math.max(1, Math.floor(day));
  const n = Math.max(1, Math.floor(teamSize));
  const raw = t.quotaBase * (1 + t.quotaGrowth * (d - 1)) * (1 + t.quotaPerMember * (n - 1));
  return Math.round(raw / t.quotaRounding) * t.quotaRounding;
}

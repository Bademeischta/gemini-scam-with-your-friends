import { TUNING } from '../../config/tuning';
import type { SchemeDef } from '../../data/schemes';
import type { CallerDef } from '../conversation/caller';
import type { Loot } from '../conversation/engine';
import type { Rng } from '../rng/rng';

/**
 * Auszahlung einer Beute (SCH-19): Spanne der Masche (Gutschein: vorgelesener Betrag), bei mehreren
 * Forderungen anteilig, mal Tages-Zuschlag und Schwierigkeit des Anrufers, gerundet.
 * FernGucker-Maschen zahlen erst den Betrag der Überweisung (hier 0).
 */
export function payoutFor(scheme: SchemeDef, loot: Loot, caller: CallerDef, day: number, rng: Rng): number {
  if (scheme.input === 'ferngucker') return 0;
  const p = TUNING.payout;
  const base = scheme.id === 'gutschein' && loot.amount ? loot.amount : rng.range(scheme.payout[0], scheme.payout[1]);
  const share = scheme.input === 'auto' ? 1 : 1 / scheme.demands.length;
  return roundTo(base * share * dayFactor(day) * p.difficulty[caller.difficulty], p.round);
}

export function dayFactor(day: number): number {
  return 1 + TUNING.payout.dayBonus * Math.max(0, day - 1);
}

export function roundTo(v: number, step: number): number {
  return Math.max(step, Math.round(v / step) * step);
}

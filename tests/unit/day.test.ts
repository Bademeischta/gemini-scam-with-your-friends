import { describe, expect, it } from 'vitest';
import { quotaFor } from '../../src/systems/day/quota';
import { ShiftState } from '../../src/systems/day/ShiftState';

describe('Quota', () => {
  it('Tag 1 solo entspricht der Original-Referenz (600)', () => {
    expect(quotaFor(1, 1)).toBe(600);
  });

  it('steigt Tag für Tag und liegt im Bereich der Original-Referenzen', () => {
    const solo = [1, 2, 3, 4, 5, 6, 7].map((d) => quotaFor(d, 1));
    expect(solo).toEqual([600, 950, 1250, 1600, 1900, 2250, 2600]);
    for (let i = 1; i < solo.length; i++) expect(solo[i]!).toBeGreaterThan(solo[i - 1]!);
  });

  it('skaliert mit der Teamgröße und ist immer auf 50 gerundet', () => {
    expect(quotaFor(1, 4)).toBe(1950);
    for (let d = 1; d < 30; d++) for (let n = 1; n <= 8; n++) expect(quotaFor(d, n) % 50).toBe(0);
    expect(quotaFor(0, 0)).toBe(600);
  });
});

describe('ShiftState', () => {
  it('Countdown läuft ab und formatiert m:ss', () => {
    const s = new ShiftState({ dayLength: 125 });
    expect(s.countdownText).toBe('2:05');
    s.tick(5.5);
    expect(s.countdownText).toBe('2:00');
    s.tick(500);
    expect(s.timeLeft).toBe(0);
    expect(s.timeUp).toBe(true);
    expect(s.countdownText).toBe('0:00');
  });

  it('Einnahmen zählen persönlich und fürs Team, Ausgaben nur persönlich', () => {
    const s = new ShiftState();
    s.earn(250);
    s.earn(-5);
    expect([s.personal, s.team]).toEqual([250, 250]);
    expect(s.spend(100)).toBe(true);
    expect(s.spend(1000)).toBe(false);
    expect([s.personal, s.team]).toEqual([150, 250]);
    expect(s.progress).toBeCloseTo(250 / 600);
    s.earn(400);
    expect(s.quotaReached).toBe(true);
    expect(s.progress).toBe(1);
  });
});

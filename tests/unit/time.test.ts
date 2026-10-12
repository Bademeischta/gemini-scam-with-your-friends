import { describe, expect, it, vi } from 'vitest';
import { FixedStepClock } from '../../src/systems/time/FixedStepClock';
import { PauseController } from '../../src/systems/time/PauseController';

describe('FixedStepClock', () => {
  it('führt genau so viele Schritte aus, wie Zeit vergangen ist – unabhängig von der Bildrate', () => {
    for (const fps of [30, 60, 144]) {
      const clock = new FixedStepClock(60, 10, 0.25);
      let steps = 0;
      for (let i = 0; i < fps; i++) clock.advance(1 / fps, () => steps++);
      expect(steps).toBeGreaterThanOrEqual(59);
      expect(steps).toBeLessThanOrEqual(60);
      expect(clock.time).toBeCloseTo(steps / 60, 6);
    }
  });

  it('übergibt immer die feste Schrittweite', () => {
    const clock = new FixedStepClock(60, 5, 0.25);
    const fn = vi.fn();
    clock.advance(0.05, fn);
    for (const call of fn.mock.calls) expect(call[0]).toBeCloseTo(1 / 60, 10);
  });

  it('begrenzt Schritte pro Frame (keine Todesspirale) und verwirft den Rest', () => {
    const clock = new FixedStepClock(60, 5, 1);
    let steps = 0;
    const n = clock.advance(1, () => steps++);
    expect(n).toBe(5);
    expect(clock.alpha).toBeLessThan(1);
  });

  it('kappt riesige Frame-Abstände (z. B. nach Tab-Wechsel)', () => {
    const clock = new FixedStepClock(60, 100, 0.25);
    let steps = 0;
    clock.advance(10, () => steps++);
    expect(steps).toBe(15);
  });

  it('liefert alpha für die Interpolation und ignoriert ungültige Deltas', () => {
    const clock = new FixedStepClock(60, 5, 0.25);
    clock.advance(1 / 120, () => undefined);
    expect(clock.alpha).toBeCloseTo(0.5, 5);
    expect(clock.advance(Number.NaN, () => undefined)).toBe(0);
    expect(clock.advance(-1, () => undefined)).toBe(0);
    expect(() => new FixedStepClock(0, 1, 1)).toThrow();
  });
});

describe('PauseController', () => {
  it('ist pausiert, solange mindestens ein Grund aktiv ist', () => {
    const p = new PauseController();
    const changes: boolean[] = [];
    p.onChange((paused) => changes.push(paused));
    expect(p.paused).toBe(false);
    p.add('background');
    p.add('menu');
    expect(p.paused).toBe(true);
    p.remove('background');
    expect(p.paused).toBe(true);
    p.remove('menu');
    expect(p.paused).toBe(false);
    expect(changes).toEqual([true, false]);
  });

  it('meldet doppelte Gründe nicht mehrfach', () => {
    const p = new PauseController();
    const fn = vi.fn();
    p.onChange(fn);
    p.add('blur');
    p.add('blur');
    p.remove('menu');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(p.has('blur')).toBe(true);
  });
});

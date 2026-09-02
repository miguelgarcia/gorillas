import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from './core';
import { getFlagMotion } from './render';

describe('flag motion', () => {
  it('hangs slack in calm air and waves faster as the wind strengthens', () => {
    const calm = getFlagMotion(0);
    const breeze = getFlagMotion(GAME_CONFIG.windMax / 2);
    const gale = getFlagMotion(GAME_CONFIG.windMax);

    expect(calm.amplitude).toBe(0);
    expect(calm.droop).toBeGreaterThan(breeze.droop);
    expect(breeze.droop).toBeGreaterThan(gale.droop);
    expect(calm.stretch).toBeLessThan(breeze.stretch);
    expect(breeze.stretch).toBeLessThan(gale.stretch);
    expect(calm.speed).toBeLessThan(breeze.speed);
    expect(breeze.speed).toBeLessThan(gale.speed);
    expect(calm.amplitude).toBeLessThan(breeze.amplitude);
    expect(breeze.amplitude).toBeLessThan(gale.amplitude);
  });

  it('uses wind magnitude so opposite directions have the same wave shape', () => {
    expect(getFlagMotion(-2.5)).toEqual(getFlagMotion(2.5));
  });

  it('caps the animation at the configured maximum wind', () => {
    expect(getFlagMotion(GAME_CONFIG.windMax * 3)).toEqual(
      getFlagMotion(GAME_CONFIG.windMax),
    );
  });
});

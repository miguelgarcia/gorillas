import { describe, expect, it } from 'vitest';
import { createGame, GAME_CONFIG } from './core';
import { getFlagMotion, getGorillaPose } from './render';

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

describe('gorilla poses', () => {
  it('maps the active player through aiming and throwing poses', () => {
    const game = createGame(4242);
    const active = game.match.gorillas[game.match.activePlayer];
    expect(getGorillaPose(game, active)).toBe('aim');
    expect(
      getGorillaPose(
        {
          ...game,
          match: { ...game.match, phase: 'projectile-flight' },
        },
        active,
      ),
    ).toBe('throw');
  });

  it('uses victory and hit artwork only for the affected gorilla', () => {
    const game = createGame(1717);
    const winner = game.match.gorillas[0];
    const defeated = { ...game.match.gorillas[1], alive: false };
    expect(
      getGorillaPose(
        {
          ...game,
          match: { ...game.match, phase: 'victory', winner: winner.player },
        },
        winner,
      ),
    ).toBe('victory');
    expect(getGorillaPose(game, defeated)).toBe('hit');
  });
});

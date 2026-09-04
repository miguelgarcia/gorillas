import { describe, expect, it, vi } from 'vitest';
import manifest from '../../public/themes/storm/theme.json';
import { createGame, GAME_CONFIG } from './core';
import { GameRenderer, getFlagMotion, getGorillaPose } from './render';

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
  it('draws the preview without an aiming ring or any game-state mutation', () => {
    const noop = vi.fn();
    const arc = vi.fn();
    const context = {
      arc,
      beginPath: noop,
      clearRect: noop,
      closePath: noop,
      createLinearGradient: () => ({ addColorStop: noop }),
      drawImage: noop,
      fill: noop,
      fillRect: noop,
      lineTo: noop,
      moveTo: noop,
      restore: noop,
      rotate: noop,
      save: noop,
      scale: noop,
      setLineDash: noop,
      stroke: noop,
      translate: noop,
    } as unknown as CanvasRenderingContext2D;
    vi.stubGlobal('document', {
      createElement: () => ({ getContext: () => context }),
    });
    try {
      const game = createGame(4242);
      const before = structuredClone(game);
      const { id, name, palette, sprites } = manifest;
      const theme = { id, name, palette, sprites };
      const renderer = new GameRenderer();
      renderer.draw(context, game, theme, null, true);
      expect(arc).not.toHaveBeenCalled();
      expect(game).toEqual(before);
      renderer.draw(context, game, theme, null);
      expect(arc).toHaveBeenCalledTimes(3);
      expect(game).toEqual(before);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('keeps both gorillas idle in the presentation without changing the match', () => {
    const game = createGame(4242);
    const before = structuredClone(game);
    for (const gorilla of game.match.gorillas) {
      expect(getGorillaPose(game, gorilla, true)).toBe('idle');
    }
    expect(game).toEqual(before);
    expect(getGorillaPose(game, game.match.gorillas[0])).toBe('aim');
  });

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

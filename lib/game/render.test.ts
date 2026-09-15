import { describe, expect, it, vi } from 'vitest';
import manifest from '../../public/themes/storm/theme.json';
import { createGame, GAME_CONFIG, startRematch } from './core';
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

describe('lighting and terrain caching', () => {
  it('draws matching sky/terrain palettes and refreshes only when needed', () => {
    function recordingContext() {
      const colors: string[] = [];
      const noop = vi.fn();
      const context = {
        fillStyle: '',
        fillRect(this: CanvasRenderingContext2D) {
          if (typeof this.fillStyle === 'string') colors.push(this.fillStyle);
        },
        createLinearGradient: () => ({
          addColorStop: (_stop: number, color: string) => colors.push(color),
        }),
        arc: noop,
        beginPath: noop,
        clearRect: noop,
        closePath: noop,
        drawImage: noop,
        fill: noop,
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
      return { context, colors };
    }
    const main = recordingContext();
    const layers: ReturnType<typeof recordingContext>[] = [];
    vi.stubGlobal('document', {
      createElement: () => {
        const layer = recordingContext();
        layers.push(layer);
        return { getContext: () => layer.context };
      },
    });
    try {
      const { id, name, palette, sprites } = manifest;
      const theme = {
        id,
        name,
        palette,
        sprites,
        lightingPresets: [
          { id: 'test', palette: { skyTop: '#123456', facades: ['#abcdef'] } },
        ],
      };
      const game = createGame(4242);
      const before = structuredClone(game);
      const renderer = new GameRenderer();
      renderer.draw(main.context, game, theme, null, true);
      expect(main.colors).toContain('#123456');
      expect(layers[0].colors).toContain('#abcdef');
      renderer.draw(
        main.context,
        { ...game, match: { ...game.match, elapsed: 1 } },
        theme,
        null,
      );
      expect(layers).toHaveLength(1);
      expect(game).toEqual(before);

      const replacement = {
        ...theme,
        lightingPresets: [
          { id: 'test', palette: { skyTop: '#654321', facades: ['#fedcba'] } },
        ],
      };
      main.colors.length = 0;
      renderer.draw(main.context, game, replacement, null);
      expect(main.colors).toContain('#654321');
      expect(layers).toHaveLength(2);
      expect(layers[1].colors).toContain('#fedcba');

      const damaged = {
        ...game,
        match: { ...game.match, craters: [{ x: 50, y: 20, radius: 3 }] },
      };
      renderer.draw(main.context, damaged, replacement, null);
      expect(layers).toHaveLength(3);
      expect(layers[2].colors).toContain('#fedcba');
      renderer.draw(main.context, damaged, replacement, null);
      expect(layers).toHaveLength(3);
      renderer.draw(main.context, startRematch(game), replacement, null);
      expect(layers).toHaveLength(4);
      expect(layers[3].colors).toContain('#fedcba');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

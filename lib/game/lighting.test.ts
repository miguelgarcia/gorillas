import { describe, expect, it } from 'vitest';
import manifest from '../../public/themes/storm/theme.json';
import {
  createGame,
  gorillaCenter,
  launchBanana,
  resetScores,
  startRematch,
  stepGame,
} from './core';
import { resolveLightingTheme } from './lighting';

const { gorillaSheet: _sheet, ...theme } = manifest;

describe('match lighting', () => {
  it('replays seeded selections and reaches every bundled mood', () => {
    const palettes = new Set<string>();
    for (let seed = 1; seed <= 128; seed++) {
      const matchSeed = createGame(seed).match.seed;
      const resolved = resolveLightingTheme(theme, matchSeed);
      expect(resolveLightingTheme(theme, matchSeed)).toEqual(resolved);
      palettes.add(resolved.palette.skyTop);
    }
    expect(palettes).toEqual(
      new Set([
        theme.palette.skyTop,
        ...theme.lightingPresets
          .slice(1)
          .map((preset) => preset.palette.skyTop),
      ]),
    );
  });

  it('preserves the base theme, sprites, and every gameplay/UI color', () => {
    const before = structuredClone(theme);
    for (let seed = 1; seed <= 32; seed++) {
      const resolved = resolveLightingTheme(theme, createGame(seed).match.seed);
      for (const key of [
        'p1',
        'p2',
        'ring',
        'ringFill',
        'banana',
        'explosionCore',
        'explosionEdge',
        'text',
        'panel',
        'panelBorder',
      ] as const) {
        expect(resolved.palette[key]).toBe(theme.palette[key]);
      }
      expect(resolved.sprites).toBe(theme.sprites);
    }
    expect(theme).toEqual(before);
  });

  it('retains the original theme when lighting is absent or invalid', () => {
    for (const lightingPresets of [
      undefined,
      [],
      [{ id: 'bad', palette: { skyTop: 'bad' } }],
    ]) {
      const base = { ...theme, lightingPresets };
      expect(resolveLightingTheme(base, 42)).toBe(base);
    }
  });

  for (const mode of ['local', 'single-player'] as const) {
    it(`keeps lighting stable through a ${mode} match and replays rematches`, () => {
      let game = createGame(4242, { mode });
      const expected = resolveLightingTheme(theme, game.match.seed).palette;
      const before = structuredClone(game);
      resolveLightingTheme(theme, game.match.seed);
      expect(game).toEqual(before);
      const center = gorillaCenter(game.match.gorillas[0]);
      game = launchBanana(game, { x: center.x, y: center.y - 1 });
      const phases = new Set([game.match.phase]);
      for (
        let frame = 0;
        frame < 1200 && game.match.phase !== 'victory';
        frame++
      ) {
        game = stepGame(game, 1 / 120);
        phases.add(game.match.phase);
        expect(resolveLightingTheme(theme, game.match.seed).palette).toEqual(
          expected,
        );
      }
      expect(phases).toEqual(
        new Set(['projectile-flight', 'impact', 'victory']),
      );
      expect(
        resolveLightingTheme(theme, resetScores(game).match.seed).palette,
      ).toEqual(expected);
      let replay = createGame(4242, { mode });
      for (let match = 0; match < 12; match++) {
        const oldSeed = game.match.seed;
        game = startRematch(game);
        replay = startRematch(replay);
        expect(game.match.seed).not.toBe(oldSeed);
        expect(resolveLightingTheme(theme, game.match.seed).palette).toEqual(
          resolveLightingTheme(theme, replay.match.seed).palette,
        );
      }
    });
  }
});

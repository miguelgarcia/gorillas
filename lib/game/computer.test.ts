import { describe, expect, it } from 'vitest';
import {
  GAME_CONFIG,
  canStartAim,
  carveCrater,
  createGame,
  gorillaCenter,
  launchBanana,
  resetScores,
  startRematch,
  stepGame,
  type Difficulty,
  type GameState,
} from './core';
import {
  chooseComputerShot,
  COMPUTER_THINK_SECONDS,
  stepSession,
} from './computer';

function computerMatch(seed: number, difficulty: Difficulty = 'normal') {
  const game = createGame(seed, { mode: 'single-player', difficulty });
  game.match.activePlayer = 1;
  return game;
}

function resolveShot(game: GameState) {
  let next = launchBanana(game, chooseComputerShot(game)!);
  for (let i = 0; i < 950 && next.match.phase === 'projectile-flight'; i += 1) {
    next = stepGame(next, 1 / 120);
  }
  return next;
}

describe('computer opponent', () => {
  it('waits before throwing exactly once and prevents human aiming', () => {
    let game = computerMatch(4242);
    expect(canStartAim(game, gorillaCenter(game.match.gorillas[1]))).toBe(
      false,
    );
    for (let i = 0; i < 20; i += 1) game = stepSession(game, 0.05);
    expect(game.match.phase).toBe('aiming');
    expect(game.match.shotNumber).toBe(0);
    for (let i = 0; i < 4; i += 1) game = stepSession(game, 0.05);
    expect(game.match.phase).toBe('projectile-flight');
    expect(game.match.shotNumber).toBe(1);
    expect(stepSession(game, 0.05).match.shotNumber).toBe(1);
  });

  it('never takes over a human, local, or finished turn', () => {
    for (const game of [
      createGame(1),
      createGame(2, { mode: 'single-player' }),
      {
        ...computerMatch(3),
        match: { ...computerMatch(3).match, phase: 'victory' as const },
      },
    ]) {
      expect(chooseComputerShot(game)).toBeNull();
      expect(stepSession(game, 0.05).match.shotNumber).toBe(0);
    }
  });

  it('replays deterministically and plans without changing damaged terrain or scores', () => {
    const game = computerMatch(314);
    const building = game.match.buildings[4];
    const crater = {
      x: building.x + building.width / 2,
      y: building.height - 2,
      radius: 3,
    };
    game.match.terrain = carveCrater(game.match.terrain, crater);
    game.match.craters = [crater];
    const before = structuredClone(game);
    const shot = chooseComputerShot(game);
    expect(chooseComputerShot(game)).toEqual(shot);
    expect(game).toEqual(before);
    expect(
      chooseComputerShot({ ...game, match: { ...game.match, elapsed: 100 } }),
    ).toEqual(shot);
    expect(
      chooseComputerShot({ ...game, match: { ...game.match, shotNumber: 2 } }),
    ).not.toEqual(shot);
  });

  it('preserves solo settings across resets and automatically starts alternate rematches', () => {
    const game = createGame(4242, {
      mode: 'single-player',
      difficulty: 'hard',
    });
    const rematch = startRematch(game);
    expect(rematch).toMatchObject({
      mode: 'single-player',
      difficulty: 'hard',
      match: { activePlayer: 1, shotNumber: 0 },
    });
    const reset = resetScores(rematch);
    expect(reset.match).toBe(rematch.match);
    const ready = {
      ...reset,
      match: { ...reset.match, phaseElapsed: COMPUTER_THINK_SECONDS },
    };
    expect(stepSession(ready, 1 / 120).match.phase).toBe('projectile-flight');
    expect(startRematch(rematch).match.activePlayer).toBe(0);
  });

  it('produces legal, resolving shots across skylines, wind, and both sides; higher difficulty is more accurate', () => {
    const hits = { easy: 0, normal: 0, hard: 0 };
    const sides = new Set<boolean>();
    for (let seed = 1; seed <= 60; seed += 1) {
      for (const difficulty of ['easy', 'normal', 'hard'] as const) {
        const game = computerMatch(seed, difficulty);
        sides.add(game.match.gorillas[1].x > game.match.gorillas[0].x);
        const shot = chooseComputerShot(game)!;
        const projectile = launchBanana(game, shot).match.projectile!;
        expect(Math.hypot(projectile.vx, projectile.vy)).toBeLessThanOrEqual(
          GAME_CONFIG.maxLaunchSpeed + 1e-8,
        );
        const result = resolveShot(game);
        expect(result.match.phase).not.toBe('projectile-flight');
        if (result.match.winner === 1) hits[difficulty] += 1;
      }
    }
    expect(sides.size).toBe(2);
    expect(hits.hard, JSON.stringify(hits)).toBeGreaterThan(hits.normal);
    expect(hits.normal, JSON.stringify(hits)).toBeGreaterThan(hits.easy);
    expect(hits.hard).toBeGreaterThan(35);
    expect(hits.easy).toBeLessThan(45);
  });
});

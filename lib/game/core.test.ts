import { describe, expect, it } from 'vitest';
import {
  GAME_CONFIG,
  canStartAim,
  carveCrater,
  createGame,
  generateBuildings,
  gorillaCenter,
  isTerrainSolid,
  launchBanana,
  resetScores,
  startRematch,
  stepGame,
  type GameState,
} from './core';

describe('seeded city generation', () => {
  it('is deterministic for the same seed', () => {
    expect(createGame(421337)).toEqual(createGame(421337));
  });

  it('obeys the arena and rooftop constraints across many seeds', () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const game = createGame(seed);
      const { buildings, gorillas } = game.match;
      expect(buildings.length).toBeGreaterThanOrEqual(
        GAME_CONFIG.buildingCountMin,
      );
      expect(buildings.length).toBeLessThanOrEqual(
        GAME_CONFIG.buildingCountMax,
      );
      expect(
        buildings.reduce((total, building) => total + building.width, 0),
      ).toBeCloseTo(GAME_CONFIG.arenaWidth, 8);
      for (const building of buildings) {
        expect(building.width).toBeGreaterThanOrEqual(
          GAME_CONFIG.buildingWidthMin,
        );
        expect(building.width).toBeLessThanOrEqual(
          GAME_CONFIG.buildingWidthMax,
        );
        expect(building.height).toBeGreaterThanOrEqual(
          GAME_CONFIG.buildingHeightMin,
        );
        expect(building.height).toBeLessThanOrEqual(
          GAME_CONFIG.buildingHeightMax,
        );
        expect(building.height % GAME_CONFIG.floorHeight).toBe(0);
      }
      expect(Math.abs(gorillas[0].x - gorillas[1].x)).toBeGreaterThanOrEqual(
        GAME_CONFIG.gorillaMinSeparation,
      );
      for (const gorilla of gorillas) {
        const roof = buildings[gorilla.buildingId];
        const clearance = Math.min(
          gorilla.x - roof.x - GAME_CONFIG.gorillaFootprintRadius,
          roof.x +
            roof.width -
            gorilla.x -
            GAME_CONFIG.gorillaFootprintRadius,
        );
        expect(clearance).toBeGreaterThanOrEqual(
          GAME_CONFIG.gorillaEdgeClearance,
        );
      }
    }
  });

  it('partitions every generated skyline into 10–14 varied buildings', () => {
    const buildings = generateBuildings(98765);
    expect(
      new Set(buildings.map((building) => building.width)).size,
    ).toBeGreaterThan(1);
    expect(
      new Set(buildings.map((building) => building.height)).size,
    ).toBeGreaterThan(1);
  });
});

describe('aiming and ballistics', () => {
  it('accepts a press anywhere inside the visible inner aiming circle', () => {
    const game = createGame(14);
    const center = gorillaCenter(game.match.gorillas[game.match.activePlayer]);
    expect(
      canStartAim(game, {
        x: center.x - 1.8,
        y: center.y - 3.9,
      }),
    ).toBe(true);
    expect(
      canStartAim(game, {
        x: center.x + GAME_CONFIG.aimStartRadius + 0.1,
        y: center.y,
      }),
    ).toBe(false);
  });

  it('launches opposite the drag and caps strength', () => {
    const game = createGame(14);
    const center = gorillaCenter(game.match.gorillas[game.match.activePlayer]);
    const launched = launchBanana(game, {
      x: center.x + GAME_CONFIG.maxDragDistance * 20,
      y: center.y - GAME_CONFIG.maxDragDistance * 20,
    });
    const projectile = launched.match.projectile;
    expect(launched.match.phase).toBe('projectile-flight');
    expect(projectile).not.toBeNull();
    expect(projectile!.vx).toBeLessThan(0);
    expect(projectile!.vy).toBeGreaterThan(0);
    expect(Math.hypot(projectile!.vx, projectile!.vy)).toBeCloseTo(
      GAME_CONFIG.maxLaunchSpeed,
      8,
    );
  });

  it('passes the turn after a banana leaves the arena', () => {
    const game = createGame(22);
    const currentPlayer = game.match.activePlayer;
    let state: GameState = {
      ...game,
      match: {
        ...game.match,
        phase: 'projectile-flight',
        projectile: {
          x: 99.95,
          y: 45,
          vx: 30,
          vy: 0,
          rotation: 0,
        },
      },
    };
    state = stepGame(state, 0.05);
    expect(state.match.phase).toBe('turn-transition');
    for (let step = 0; step < 4; step += 1) {
      state = stepGame(state, 0.05);
    }
    expect(state.match.phase).toBe('aiming');
    expect(state.match.activePlayer).not.toBe(currentPlayer);
  });

  it('keeps simulating above the viewport so a high arc can re-enter', () => {
    const game = createGame(23);
    const state: GameState = {
      ...game,
      match: {
        ...game.match,
        phase: 'projectile-flight',
        projectile: {
          x: GAME_CONFIG.arenaWidth / 2,
          y: GAME_CONFIG.arenaHeight - 0.05,
          vx: 0,
          vy: 20,
          rotation: 0,
        },
      },
    };
    let advanced = stepGame(state, 0.05);
    expect(advanced.match.phase).toBe('projectile-flight');
    expect(advanced.match.projectile!.y).toBeGreaterThan(
      GAME_CONFIG.arenaHeight,
    );
    for (let step = 0; step < 60; step += 1) {
      advanced = stepGame(advanced, 0.05);
      if (
        advanced.match.projectile &&
        advanced.match.projectile.y < GAME_CONFIG.arenaHeight &&
        advanced.match.projectile.vy < 0
      ) {
        break;
      }
    }
    expect(advanced.match.phase).toBe('projectile-flight');
    expect(advanced.match.projectile!.y).toBeLessThan(
      GAME_CONFIG.arenaHeight,
    );
  });

  it('detects visible edge contact between a banana and a gorilla', () => {
    const game = createGame(24);
    const target = game.match.gorillas[1];
    const center = gorillaCenter(target);
    const state: GameState = {
      ...game,
      match: {
        ...game.match,
        phase: 'projectile-flight',
        projectile: {
          x: center.x - 5,
          y: center.y + 3,
          vx: 100,
          vy: 0,
          rotation: 0,
        },
      },
    };
    const hit = stepGame(state, 0.05);
    expect(hit.match.phase).toBe('impact');
    expect(hit.match.winner).toBe(0);
    expect(hit.match.gorillas[1].alive).toBe(false);
  });

  it('explodes when the visible edge of a banana reaches a building', () => {
    const game = createGame(25);
    const occupied = new Set(
      game.match.gorillas.map((gorilla) => gorilla.buildingId),
    );
    const building = game.match.buildings.find(
      (candidate) => !occupied.has(candidate.id),
    )!;
    const state: GameState = {
      ...game,
      match: {
        ...game.match,
        phase: 'projectile-flight',
        projectile: {
          x: building.x + building.width / 2,
          y: building.height + 1,
          vx: 0,
          vy: -10,
          rotation: 0,
        },
      },
    };
    const hit = stepGame(state, 0.05);
    expect(hit.match.phase).toBe('impact');
    expect(hit.match.explosion?.kind).toBe('terrain');
    expect(hit.match.craters).toHaveLength(1);
  });
});

describe('terrain and match lifecycle', () => {
  it('clears terrain inside a crater without removing surrounding terrain', () => {
    const game = createGame(31);
    const building = game.match.buildings[0];
    const center = {
      x: building.x + building.width / 2,
      y: building.height / 2,
      radius: GAME_CONFIG.craterRadius,
    };
    expect(isTerrainSolid(game.match.terrain, center)).toBe(true);
    const carved = carveCrater(game.match.terrain, center);
    expect(isTerrainSolid(carved, center)).toBe(false);
    expect(
      isTerrainSolid(carved, {
        x: center.x,
        y: Math.max(0.2, center.y - center.radius - 0.5),
      }),
    ).toBe(true);
  });

  it('scores a direct hit once and preserves the result in victory', () => {
    const game = createGame(42);
    let state: GameState = {
      ...game,
      match: {
        ...game.match,
        phase: 'impact',
        phaseElapsed: GAME_CONFIG.explosionDuration - 0.01,
        winner: 0,
        explosion: {
          ...gorillaCenter(game.match.gorillas[1]),
          kind: 'gorilla',
          elapsed: GAME_CONFIG.explosionDuration - 0.01,
        },
      },
    };
    state = stepGame(state, 0.02);
    expect(state.match.phase).toBe('victory');
    expect(state.scores).toEqual([1, 0]);
    state = stepGame(state, 0.05);
    expect(state.scores).toEqual([1, 0]);
  });

  it('alternates rematch starters, refreshes the match, and resets only scores', () => {
    const game = { ...createGame(77), scores: [3, 2] as [number, number] };
    const second = startRematch(game);
    const third = startRematch(second);
    expect(second.match.activePlayer).toBe(1);
    expect(third.match.activePlayer).toBe(0);
    expect(second.match.seed).not.toBe(game.match.seed);
    expect(second.scores).toEqual([3, 2]);
    const reset = resetScores(second);
    expect(reset.scores).toEqual([0, 0]);
    expect(reset.match).toBe(second.match);
  });
});

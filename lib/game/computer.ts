import {
  GAME_CONFIG,
  createRandom,
  gorillaCenter,
  isComputerTurn,
  launchBanana,
  stepGame,
  type GameState,
  type Point,
} from './core';

export const COMPUTER_THINK_SECONDS = 1.1;
const PHYSICS_STEP = 1 / 120;
const CANDIDATE_COUNT = 40;
const ACCURACY = {
  easy: { angle: 0.14, speed: 0.09 },
  normal: { angle: 0.07, speed: 0.045 },
  hard: { angle: 0.025, speed: 0.015 },
} as const;

function releasePoint(center: Point, vx: number, vy: number): Point {
  const scale = GAME_CONFIG.maxDragDistance / GAME_CONFIG.maxLaunchSpeed;
  return { x: center.x - vx * scale, y: center.y - vy * scale };
}

// Search a bounded set of arcs using the real collision/terrain simulation.
// Planning is pure: trial craters and scores never reach the live match.
export function chooseComputerShot(game: GameState): Point | null {
  if (!isComputerTurn(game) || game.match.phase !== 'aiming') return null;
  const origin = gorillaCenter(game.match.gorillas[1]);
  const target = gorillaCenter(game.match.gorillas[0]);
  let best = { vx: Math.sign(target.x - origin.x) * 25, vy: 35 };
  let bestScore = Infinity;

  for (let candidate = 0; candidate < CANDIDATE_COUNT; candidate += 1) {
    const time = 1 + candidate * 0.12;
    let spawn = origin;
    let vx = 0;
    let vy = 0;
    // Account for the banana spawning outside the gorilla and the discrete
    // integrator's extra half-step of acceleration.
    for (let iteration = 0; iteration < 4; iteration += 1) {
      vx =
        (target.x - spawn.x) / time -
        (game.match.wind * (time + PHYSICS_STEP)) / 2;
      vy =
        (target.y - spawn.y) / time +
        (GAME_CONFIG.gravity * (time + PHYSICS_STEP)) / 2;
      const speed = Math.hypot(vx, vy);
      const offset = GAME_CONFIG.gorillaRadius + GAME_CONFIG.bananaRadius + 0.4;
      spawn = {
        x: origin.x + (vx / speed) * offset,
        y: origin.y + (vy / speed) * offset,
      };
    }
    if (Math.hypot(vx, vy) > GAME_CONFIG.maxLaunchSpeed || vy <= 0) continue;

    let trial = launchBanana(game, releasePoint(origin, vx, vy));
    let score = Infinity;
    // Even a maximum-strength vertical throw resolves within this horizon.
    for (
      let step = 0;
      step < 900 && trial.match.phase === 'projectile-flight';
      step += 1
    ) {
      const projectile = trial.match.projectile!;
      score = Math.min(
        score,
        Math.hypot(projectile.x - target.x, projectile.y - target.y),
      );
      trial = stepGame(trial, PHYSICS_STEP);
    }
    if (trial.match.winner === 0) score = Infinity;
    if (trial.match.winner === 1) score = -1;
    if (score < bestScore) {
      bestScore = score;
      best = { vx, vy };
    }
    if (score === -1) break;
  }

  // Seed by match and throw count, never by wall-clock timing. A miss changes
  // the next attempt without making replay or pause/resume nondeterministic.
  const random = createRandom(
    game.match.seed ^ Math.imul(game.match.shotNumber + 1, 0x9e3779b9),
  );
  const accuracy = ACCURACY[game.difficulty];
  const angle =
    Math.atan2(best.vy, best.vx) + (random() * 2 - 1) * accuracy.angle;
  const speed = Math.min(
    GAME_CONFIG.maxLaunchSpeed,
    Math.hypot(best.vx, best.vy) * (1 + (random() * 2 - 1) * accuracy.speed),
  );
  return releasePoint(origin, Math.cos(angle) * speed, Math.sin(angle) * speed);
}

export function stepSession(game: GameState, delta: number): GameState {
  const next = stepGame(game, delta);
  if (
    !isComputerTurn(next) ||
    next.match.phase !== 'aiming' ||
    next.match.phaseElapsed < COMPUTER_THINK_SECONDS
  )
    return next;
  const shot = chooseComputerShot(next);
  return shot ? launchBanana(next, shot) : next;
}

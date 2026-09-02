export const GAME_CONFIG = {
  arenaWidth: 100,
  arenaHeight: 58,
  buildingCountMin: 10,
  buildingCountMax: 14,
  buildingWidthMin: 5,
  buildingWidthMax: 14,
  buildingHeightMin: 12,
  buildingHeightMax: 36,
  floorHeight: 3,
  gorillaRadius: 1.35,
  gorillaEdgeClearance: 1,
  gorillaMinSeparation: 40,
  bananaRadius: 0.32,
  maxDragDistance: 18,
  maxLaunchSpeed: 46,
  gravity: 18,
  windMax: 4,
  craterRadius: 3,
  terrainCellSize: 0.1,
  explosionDuration: 0.72,
  turnTransitionDuration: 0.2,
  minimumShotStrength: 0.025,
} as const;

export type PlayerId = 0 | 1;
export type Point = { x: number; y: number };

export type Building = {
  id: number;
  x: number;
  width: number;
  height: number;
  facade: number;
  windowSeed: number;
};

export type Gorilla = {
  player: PlayerId;
  x: number;
  roofY: number;
  buildingId: number;
  alive: boolean;
};

export type Projectile = Point & {
  vx: number;
  vy: number;
  rotation: number;
};

export type Crater = Point & { radius: number };

export type Explosion = Point & {
  kind: 'terrain' | 'gorilla';
  elapsed: number;
};

export type MatchPhase =
  | 'aiming'
  | 'projectile-flight'
  | 'impact'
  | 'turn-transition'
  | 'victory';

export type TerrainMask = {
  columns: number;
  rows: number;
  cellSize: number;
  cells: Uint8Array;
};

export type MatchState = {
  seed: number;
  wind: number;
  elapsed: number;
  phaseElapsed: number;
  phase: MatchPhase;
  activePlayer: PlayerId;
  buildings: Building[];
  gorillas: [Gorilla, Gorilla];
  flagBuildingId: number;
  terrain: TerrainMask;
  craters: Crater[];
  projectile: Projectile | null;
  explosion: Explosion | null;
  winner: PlayerId | null;
};

export type GameState = {
  baseSeed: number;
  matchNumber: number;
  nextStarter: PlayerId;
  scores: [number, number];
  match: MatchState;
};

type Random = () => number;

export function createRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function mixSeed(seed: number, value: number) {
  let mixed = (seed ^ Math.imul(value + 1, 0x9e3779b9)) >>> 0;
  mixed ^= mixed >>> 16;
  mixed = Math.imul(mixed, 0x7feb352d) >>> 0;
  mixed ^= mixed >>> 15;
  mixed = Math.imul(mixed, 0x846ca68b) >>> 0;
  mixed ^= mixed >>> 16;
  return mixed >>> 0;
}

export function generateBuildings(seed: number): Building[] {
  const random = createRandom(seed);
  const count =
    GAME_CONFIG.buildingCountMin +
    Math.floor(
      random() *
        (GAME_CONFIG.buildingCountMax - GAME_CONFIG.buildingCountMin + 1),
    );
  const widths = Array.from(
    { length: count },
    () => GAME_CONFIG.buildingWidthMin,
  );
  const quarterMeter = 0.25;
  let remainingSteps =
    (GAME_CONFIG.arenaWidth - count * GAME_CONFIG.buildingWidthMin) /
    quarterMeter;

  while (remainingSteps > 0) {
    const candidates = widths
      .map((width, index) => ({ width, index }))
      .filter(({ width }) => width < GAME_CONFIG.buildingWidthMax);
    const selected = candidates[Math.floor(random() * candidates.length)];
    widths[selected.index] += quarterMeter;
    remainingSteps -= 1;
  }

  const anchors = Array.from(
    { length: 6 },
    () => GAME_CONFIG.buildingHeightMin + 3 + random() * 18,
  );
  let x = 0;

  return widths.map((width, id) => {
    const center = x + width / 2;
    const anchorPosition =
      (center / GAME_CONFIG.arenaWidth) * (anchors.length - 1);
    const anchorIndex = Math.min(
      anchors.length - 2,
      Math.floor(anchorPosition),
    );
    const blend = anchorPosition - anchorIndex;
    const envelope =
      anchors[anchorIndex] * (1 - blend) + anchors[anchorIndex + 1] * blend;
    const unsnappedHeight = envelope + (random() - 0.5) * 9;
    const height = Math.max(
      GAME_CONFIG.buildingHeightMin,
      Math.min(
        GAME_CONFIG.buildingHeightMax,
        Math.round(unsnappedHeight / GAME_CONFIG.floorHeight) *
          GAME_CONFIG.floorHeight,
      ),
    );
    const building = {
      id,
      x,
      width,
      height,
      facade: Math.floor(random() * 5),
      windowSeed: Math.floor(random() * 0xffffffff),
    };
    x += width;
    return building;
  });
}

export function chooseGorillas(
  buildings: Building[],
  seed: number,
): [Gorilla, Gorilla] {
  const random = createRandom(mixSeed(seed, 1));
  const validPairs: Array<[Building, Building]> = [];

  for (let first = 0; first < buildings.length; first += 1) {
    for (let second = first + 1; second < buildings.length; second += 1) {
      const firstBuilding = buildings[first];
      const secondBuilding = buildings[second];
      const firstX = firstBuilding.x + firstBuilding.width / 2;
      const secondX = secondBuilding.x + secondBuilding.width / 2;
      const firstClearance =
        firstBuilding.width / 2 - GAME_CONFIG.gorillaRadius;
      const secondClearance =
        secondBuilding.width / 2 - GAME_CONFIG.gorillaRadius;

      if (
        firstClearance >= GAME_CONFIG.gorillaEdgeClearance &&
        secondClearance >= GAME_CONFIG.gorillaEdgeClearance &&
        Math.abs(firstX - secondX) >= GAME_CONFIG.gorillaMinSeparation
      ) {
        validPairs.push([firstBuilding, secondBuilding]);
      }
    }
  }

  const selectedPair =
    validPairs[Math.floor(random() * validPairs.length)] ??
    ([buildings[0], buildings[buildings.length - 1]] as const);
  const pair =
    random() < 0.5 ? selectedPair : [selectedPair[1], selectedPair[0]];

  return pair.map((building, player) => ({
    player: player as PlayerId,
    x: building.x + building.width / 2,
    roofY: building.height,
    buildingId: building.id,
    alive: true,
  })) as [Gorilla, Gorilla];
}

export function createTerrain(buildings: Building[]): TerrainMask {
  const columns = Math.ceil(
    GAME_CONFIG.arenaWidth / GAME_CONFIG.terrainCellSize,
  );
  const rows = Math.ceil(GAME_CONFIG.arenaHeight / GAME_CONFIG.terrainCellSize);
  const cells = new Uint8Array(columns * rows);

  for (const building of buildings) {
    const startColumn = Math.floor(building.x / GAME_CONFIG.terrainCellSize);
    const endColumn = Math.min(
      columns,
      Math.ceil((building.x + building.width) / GAME_CONFIG.terrainCellSize),
    );
    const endRow = Math.min(
      rows,
      Math.ceil(building.height / GAME_CONFIG.terrainCellSize),
    );

    for (let row = 0; row < endRow; row += 1) {
      const rowOffset = row * columns;
      for (let column = startColumn; column < endColumn; column += 1) {
        cells[rowOffset + column] = 1;
      }
    }
  }

  return {
    columns,
    rows,
    cellSize: GAME_CONFIG.terrainCellSize,
    cells,
  };
}

export function isTerrainSolid(mask: TerrainMask, point: Point) {
  const column = Math.floor(point.x / mask.cellSize);
  const row = Math.floor(point.y / mask.cellSize);
  if (column < 0 || column >= mask.columns || row < 0 || row >= mask.rows) {
    return false;
  }
  return mask.cells[row * mask.columns + column] === 1;
}

export function carveCrater(mask: TerrainMask, crater: Crater): TerrainMask {
  const cells = mask.cells.slice();
  const minimumColumn = Math.max(
    0,
    Math.floor((crater.x - crater.radius) / mask.cellSize),
  );
  const maximumColumn = Math.min(
    mask.columns - 1,
    Math.ceil((crater.x + crater.radius) / mask.cellSize),
  );
  const minimumRow = Math.max(
    0,
    Math.floor((crater.y - crater.radius) / mask.cellSize),
  );
  const maximumRow = Math.min(
    mask.rows - 1,
    Math.ceil((crater.y + crater.radius) / mask.cellSize),
  );
  const radiusSquared = crater.radius * crater.radius;

  for (let row = minimumRow; row <= maximumRow; row += 1) {
    const y = (row + 0.5) * mask.cellSize;
    for (let column = minimumColumn; column <= maximumColumn; column += 1) {
      const x = (column + 0.5) * mask.cellSize;
      const dx = x - crater.x;
      const dy = y - crater.y;
      if (dx * dx + dy * dy <= radiusSquared) {
        cells[row * mask.columns + column] = 0;
      }
    }
  }

  return { ...mask, cells };
}

function createMatch(seed: number, activePlayer: PlayerId): MatchState {
  const buildings = generateBuildings(seed);
  const gorillas = chooseGorillas(buildings, seed);
  const random = createRandom(mixSeed(seed, 2));
  const occupiedBuildings = new Set(
    gorillas.map((gorilla) => gorilla.buildingId),
  );
  const flagCandidates = buildings.filter(
    (building) => !occupiedBuildings.has(building.id),
  );
  const flagBuilding =
    flagCandidates[Math.floor(random() * flagCandidates.length)] ??
    buildings[0];

  return {
    seed,
    wind: (random() * 2 - 1) * GAME_CONFIG.windMax,
    elapsed: 0,
    phaseElapsed: 0,
    phase: 'aiming',
    activePlayer,
    buildings,
    gorillas,
    flagBuildingId: flagBuilding.id,
    terrain: createTerrain(buildings),
    craters: [],
    projectile: null,
    explosion: null,
    winner: null,
  };
}

export function createGame(seed: number): GameState {
  const normalizedSeed = seed >>> 0 || 1;
  return {
    baseSeed: normalizedSeed,
    matchNumber: 1,
    nextStarter: 1,
    scores: [0, 0],
    match: createMatch(mixSeed(normalizedSeed, 1), 0),
  };
}

export function startRematch(game: GameState): GameState {
  const matchNumber = game.matchNumber + 1;
  const starter = game.nextStarter;
  return {
    ...game,
    matchNumber,
    nextStarter: otherPlayer(starter),
    match: createMatch(mixSeed(game.baseSeed, matchNumber), starter),
  };
}

export function resetScores(game: GameState): GameState {
  return { ...game, scores: [0, 0] };
}

export function otherPlayer(player: PlayerId): PlayerId {
  return player === 0 ? 1 : 0;
}

export function gorillaCenter(gorilla: Gorilla): Point {
  return {
    x: gorilla.x,
    y: gorilla.roofY + GAME_CONFIG.gorillaRadius,
  };
}

export function shotStrength(gorilla: Gorilla, pointer: Point) {
  const center = gorillaCenter(gorilla);
  return Math.min(
    1,
    Math.hypot(pointer.x - center.x, pointer.y - center.y) /
      GAME_CONFIG.maxDragDistance,
  );
}

export function canStartAim(game: GameState, point: Point) {
  if (game.match.phase !== 'aiming') return false;
  const center = gorillaCenter(game.match.gorillas[game.match.activePlayer]);
  return (
    Math.hypot(point.x - center.x, point.y - center.y) <=
    GAME_CONFIG.gorillaRadius + 2
  );
}

export function launchBanana(game: GameState, pointer: Point): GameState {
  const match = game.match;
  if (match.phase !== 'aiming') return game;
  const gorilla = match.gorillas[match.activePlayer];
  const center = gorillaCenter(gorilla);
  const pullX = pointer.x - center.x;
  const pullY = pointer.y - center.y;
  const distance = Math.hypot(pullX, pullY);
  const strength = Math.min(1, distance / GAME_CONFIG.maxDragDistance);
  if (strength < GAME_CONFIG.minimumShotStrength || distance === 0) return game;

  const directionX = -pullX / distance;
  const directionY = -pullY / distance;
  const speed = GAME_CONFIG.maxLaunchSpeed * strength;
  const spawnDistance =
    GAME_CONFIG.gorillaRadius + GAME_CONFIG.bananaRadius + 0.4;
  const projectile: Projectile = {
    x: center.x + directionX * spawnDistance,
    y: center.y + directionY * spawnDistance,
    vx: directionX * speed,
    vy: directionY * speed,
    rotation: Math.atan2(directionY, directionX),
  };

  return {
    ...game,
    match: {
      ...match,
      phase: 'projectile-flight',
      phaseElapsed: 0,
      projectile,
      explosion: null,
    },
  };
}

function segmentCircleHit(
  start: Point,
  end: Point,
  center: Point,
  radius: number,
) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return null;
  const projection = Math.max(
    0,
    Math.min(
      1,
      ((center.x - start.x) * dx + (center.y - start.y) * dy) / lengthSquared,
    ),
  );
  const closestX = start.x + dx * projection;
  const closestY = start.y + dy * projection;
  const offsetX = closestX - center.x;
  const offsetY = closestY - center.y;
  return offsetX * offsetX + offsetY * offsetY <= radius * radius
    ? projection
    : null;
}

function sweepTerrain(mask: TerrainMask, start: Point, end: Point) {
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  const steps = Math.max(1, Math.ceil(distance / (mask.cellSize * 0.5)));
  for (let step = 0; step <= steps; step += 1) {
    const time = step / steps;
    const point = {
      x: start.x + (end.x - start.x) * time,
      y: start.y + (end.y - start.y) * time,
    };
    if (isTerrainSolid(mask, point)) return { time, point };
  }
  return null;
}

function updateProjectile(game: GameState, delta: number): GameState {
  const { match } = game;
  const projectile = match.projectile;
  if (!projectile) return game;

  const nextVelocityX = projectile.vx + match.wind * delta;
  const nextVelocityY = projectile.vy - GAME_CONFIG.gravity * delta;
  const nextPoint = {
    x: projectile.x + nextVelocityX * delta,
    y: projectile.y + nextVelocityY * delta,
  };
  const start = { x: projectile.x, y: projectile.y };

  let gorillaHit: { player: PlayerId; time: number } | null = null;
  for (const gorilla of match.gorillas) {
    if (!gorilla.alive) continue;
    const time = segmentCircleHit(
      start,
      nextPoint,
      gorillaCenter(gorilla),
      GAME_CONFIG.gorillaRadius + GAME_CONFIG.bananaRadius,
    );
    if (time !== null && (!gorillaHit || time < gorillaHit.time)) {
      gorillaHit = { player: gorilla.player, time };
    }
  }

  const terrainHit = sweepTerrain(match.terrain, start, nextPoint);
  if (
    gorillaHit &&
    (!terrainHit || gorillaHit.time <= terrainHit.time + 0.0001)
  ) {
    const defeated = gorillaHit.player;
    const winner = otherPlayer(defeated);
    const center = gorillaCenter(match.gorillas[defeated]);
    const gorillas = match.gorillas.map((gorilla) =>
      gorilla.player === defeated ? { ...gorilla, alive: false } : gorilla,
    ) as [Gorilla, Gorilla];
    return {
      ...game,
      match: {
        ...match,
        gorillas,
        phase: 'impact',
        phaseElapsed: 0,
        projectile: null,
        explosion: { ...center, kind: 'gorilla', elapsed: 0 },
        winner,
      },
    };
  }

  if (terrainHit) {
    const crater = {
      ...terrainHit.point,
      radius: GAME_CONFIG.craterRadius,
    };
    return {
      ...game,
      match: {
        ...match,
        phase: 'impact',
        phaseElapsed: 0,
        projectile: null,
        explosion: { ...terrainHit.point, kind: 'terrain', elapsed: 0 },
        terrain: carveCrater(match.terrain, crater),
        craters: [...match.craters, crater],
      },
    };
  }

  if (
    nextPoint.x < 0 ||
    nextPoint.x > GAME_CONFIG.arenaWidth ||
    nextPoint.y < 0 ||
    nextPoint.y > GAME_CONFIG.arenaHeight
  ) {
    return {
      ...game,
      match: {
        ...match,
        phase: 'turn-transition',
        phaseElapsed: 0,
        projectile: null,
      },
    };
  }

  return {
    ...game,
    match: {
      ...match,
      phaseElapsed: match.phaseElapsed + delta,
      projectile: {
        ...nextPoint,
        vx: nextVelocityX,
        vy: nextVelocityY,
        rotation: projectile.rotation + delta * 11,
      },
    },
  };
}

export function stepGame(game: GameState, delta: number): GameState {
  const boundedDelta = Math.max(0, Math.min(delta, 0.05));
  const match = {
    ...game.match,
    elapsed: game.match.elapsed + boundedDelta,
  };
  const advanced = { ...game, match };

  if (match.phase === 'projectile-flight') {
    return updateProjectile(advanced, boundedDelta);
  }

  if (match.phase === 'impact') {
    const phaseElapsed = match.phaseElapsed + boundedDelta;
    const explosion = match.explosion
      ? { ...match.explosion, elapsed: phaseElapsed }
      : null;
    if (phaseElapsed < GAME_CONFIG.explosionDuration) {
      return { ...advanced, match: { ...match, phaseElapsed, explosion } };
    }
    if (match.winner !== null) {
      const scores: [number, number] = [...game.scores];
      scores[match.winner] += 1;
      return {
        ...advanced,
        scores,
        match: {
          ...match,
          phase: 'victory',
          phaseElapsed: 0,
          explosion: null,
        },
      };
    }
    return {
      ...advanced,
      match: {
        ...match,
        phase: 'turn-transition',
        phaseElapsed: 0,
        explosion: null,
      },
    };
  }

  if (match.phase === 'turn-transition') {
    const phaseElapsed = match.phaseElapsed + boundedDelta;
    if (phaseElapsed >= GAME_CONFIG.turnTransitionDuration) {
      return {
        ...advanced,
        match: {
          ...match,
          activePlayer: otherPlayer(match.activePlayer),
          phase: 'aiming',
          phaseElapsed: 0,
        },
      };
    }
    return { ...advanced, match: { ...match, phaseElapsed } };
  }

  return advanced;
}

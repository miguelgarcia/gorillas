import {
  createRandom,
  GAME_CONFIG,
  gorillaCenter,
  shotStrength,
  type GameState,
  type Gorilla,
  type Point,
} from './core';
import type { GameTheme, PixelSprite } from './theme';

export const VIEW_WIDTH = 1600;
export const VIEW_HEIGHT = 900;
const WORLD_SCALE = 13.5;
const WORLD_LEFT = (VIEW_WIDTH - GAME_CONFIG.arenaWidth * WORLD_SCALE) / 2;
const GROUND_Y = 820;

export function screenToWorld(canvas: HTMLCanvasElement, point: Point): Point {
  const bounds = canvas.getBoundingClientRect();
  const canvasX = ((point.x - bounds.left) / bounds.width) * VIEW_WIDTH;
  const canvasY = ((point.y - bounds.top) / bounds.height) * VIEW_HEIGHT;
  return {
    x: (canvasX - WORLD_LEFT) / WORLD_SCALE,
    y: (GROUND_Y - canvasY) / WORLD_SCALE,
  };
}

function worldToScreen(point: Point): Point {
  return {
    x: WORLD_LEFT + point.x * WORLD_SCALE,
    y: GROUND_Y - point.y * WORLD_SCALE,
  };
}

function drawPixelSprite(
  context: CanvasRenderingContext2D,
  sprite: PixelSprite,
  position: Point,
  pixelSize: number,
  facing: 1 | -1,
  accent?: string,
) {
  const width = Math.max(...sprite.rows.map((row) => row.length));
  const height = sprite.rows.length;
  context.save();
  context.translate(Math.round(position.x), Math.round(position.y));
  context.scale(facing, 1);
  context.translate((-width * pixelSize) / 2, -height * pixelSize);
  context.imageSmoothingEnabled = false;

  sprite.rows.forEach((row, rowIndex) => {
    row.split('').forEach((pixel, columnIndex) => {
      if (pixel === '.') return;
      context.fillStyle =
        pixel === 'A' && accent ? accent : (sprite.colors[pixel] ?? '#ffffff');
      context.fillRect(
        Math.round(columnIndex * pixelSize),
        Math.round(rowIndex * pixelSize),
        Math.ceil(pixelSize),
        Math.ceil(pixelSize),
      );
    });
  });
  context.restore();
}

function drawCloud(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  color: string,
  alpha: number,
) {
  const blocks = [
    [0, 3, 9, 2],
    [2, 1, 3, 3],
    [5, 0, 3, 4],
    [8, 2, 5, 3],
    [12, 3, 4, 2],
  ];
  context.save();
  context.globalAlpha = alpha;
  context.fillStyle = color;
  blocks.forEach(([blockX, blockY, width, height]) => {
    context.fillRect(
      Math.round(x + blockX * scale),
      Math.round(y + blockY * scale),
      Math.ceil(width * scale),
      Math.ceil(height * scale),
    );
  });
  context.restore();
}

function wrap(value: number, range: number) {
  return ((value % range) + range) % range;
}

function drawSky(
  context: CanvasRenderingContext2D,
  game: GameState,
  theme: GameTheme,
) {
  const gradient = context.createLinearGradient(0, 0, 0, GROUND_Y);
  gradient.addColorStop(0, theme.palette.skyTop);
  gradient.addColorStop(1, theme.palette.skyBottom);
  context.fillStyle = gradient;
  context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  const drift = game.match.elapsed * game.match.wind * 5;
  drawCloud(
    context,
    wrap(140 + drift * 0.7 + 240, 1960) - 240,
    92,
    13,
    theme.palette.cloudNear,
    0.48,
  );
  drawCloud(
    context,
    wrap(720 + drift * 0.48 + 240, 1960) - 240,
    205,
    9,
    theme.palette.cloudFar,
    0.35,
  );
  drawCloud(
    context,
    wrap(1270 + drift * 0.6 + 240, 1960) - 240,
    72,
    15,
    theme.palette.cloudNear,
    0.44,
  );

  context.fillStyle = theme.palette.distantCity;
  context.globalAlpha = 0.62;
  const random = createRandom(game.match.seed ^ 0x51edc17);
  let x = 0;
  while (x < VIEW_WIDTH) {
    const width = 26 + Math.floor(random() * 38);
    const height = 55 + Math.floor(random() * 125);
    context.fillRect(x, GROUND_Y - height, width, height);
    x += width + 5 + Math.floor(random() * 12);
  }
  context.globalAlpha = 1;
}

function drawFlag(
  context: CanvasRenderingContext2D,
  game: GameState,
  theme: GameTheme,
) {
  const building = game.match.buildings[game.match.flagBuildingId];
  if (!building) return;
  const anchor = worldToScreen({
    x: building.x + building.width / 2,
    y: building.height,
  });
  const direction: 1 | -1 = game.match.wind < 0 ? -1 : 1;
  const strength = Math.abs(game.match.wind) / GAME_CONFIG.windMax;
  const height = 64;

  context.strokeStyle = theme.palette.buildingOutline;
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(anchor.x, anchor.y);
  context.lineTo(anchor.x, anchor.y - height);
  context.stroke();

  context.save();
  context.translate(anchor.x + direction * 2, anchor.y - height + 2);
  context.scale(direction * (0.55 + strength * 0.62), 0.8 + strength * 0.22);
  drawPixelSprite(context, theme.sprites.flag, { x: 0, y: 20 }, 4, 1);
  context.restore();
}

function drawGorilla(
  context: CanvasRenderingContext2D,
  game: GameState,
  theme: GameTheme,
  gorilla: Gorilla,
) {
  if (!gorilla.alive) return;
  const opponent = game.match.gorillas[gorilla.player === 0 ? 1 : 0];
  const facing: 1 | -1 = opponent.x >= gorilla.x ? 1 : -1;
  const isWinner =
    game.match.phase === 'victory' && game.match.winner === gorilla.player;
  const dance = isWinner ? Math.sin(game.match.elapsed * 15) : 0;
  const position = worldToScreen({
    x: gorilla.x + (isWinner ? dance * 0.16 : 0),
    y: gorilla.roofY + (isWinner ? Math.abs(dance) * 0.28 : 0),
  });
  drawPixelSprite(
    context,
    theme.sprites.gorilla,
    position,
    3,
    facing,
    gorilla.player === 0 ? theme.palette.p1 : theme.palette.p2,
  );

  if (isWinner) {
    context.fillStyle =
      gorilla.player === 0 ? theme.palette.p1 : theme.palette.p2;
    context.fillRect(position.x - 29, position.y - 45 - dance * 9, 11, 8);
    context.fillRect(position.x + 18, position.y - 45 + dance * 9, 11, 8);
  }
}

function drawProjectile(
  context: CanvasRenderingContext2D,
  game: GameState,
  theme: GameTheme,
) {
  const projectile = game.match.projectile;
  if (!projectile) return;
  const position = worldToScreen(projectile);
  context.save();
  context.translate(position.x, position.y);
  context.rotate(-projectile.rotation);
  drawPixelSprite(context, theme.sprites.banana, { x: 0, y: 5 }, 2, 1);
  context.restore();
}

function drawExplosion(
  context: CanvasRenderingContext2D,
  game: GameState,
  theme: GameTheme,
) {
  const explosion = game.match.explosion;
  if (!explosion) return;
  const center = worldToScreen(explosion);
  const progress = Math.min(
    1,
    explosion.elapsed / GAME_CONFIG.explosionDuration,
  );
  const radius =
    (explosion.kind === 'terrain' ? GAME_CONFIG.craterRadius : 3.8) *
    WORLD_SCALE *
    Math.sin(progress * Math.PI);
  context.save();
  context.fillStyle = theme.palette.explosionEdge;
  context.globalAlpha = 0.9 - progress * 0.35;
  context.beginPath();
  context.arc(center.x, center.y, Math.max(4, radius), 0, Math.PI * 2);
  context.fill();
  context.fillStyle = theme.palette.explosionCore;
  context.beginPath();
  context.arc(center.x, center.y, Math.max(2, radius * 0.55), 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawAimingRing(
  context: CanvasRenderingContext2D,
  game: GameState,
  theme: GameTheme,
  pointer: Point | null,
) {
  if (game.match.phase !== 'aiming') return;
  const gorilla = game.match.gorillas[game.match.activePlayer];
  const centerWorld = gorillaCenter(gorilla);
  const center = worldToScreen(centerWorld);
  const strength = pointer ? shotStrength(gorilla, pointer) : 0;
  const radius = 7.6 * WORLD_SCALE;
  const width = 2.25 * WORLD_SCALE;

  context.save();
  context.strokeStyle = theme.palette.ring;
  context.lineWidth = 3;
  context.beginPath();
  context.arc(center.x, center.y, radius, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.arc(center.x, center.y, radius - width, 0, Math.PI * 2);
  context.stroke();

  context.globalAlpha = 0.08 + strength * 0.72;
  context.strokeStyle = theme.palette.ringFill;
  context.lineWidth = width - 5;
  context.beginPath();
  context.arc(center.x, center.y, radius - width / 2, 0, Math.PI * 2);
  context.stroke();
  context.globalAlpha = 1;

  if (pointer) {
    const pullX = pointer.x - centerWorld.x;
    const pullY = pointer.y - centerWorld.y;
    const pullLength = Math.max(0.0001, Math.hypot(pullX, pullY));
    const directionX = -pullX / pullLength;
    const directionY = -pullY / pullLength;
    const arrowX = center.x + directionX * radius;
    const arrowY = center.y - directionY * radius;
    const angle = Math.atan2(-directionY, directionX);

    context.strokeStyle = theme.palette.ring;
    context.fillStyle = theme.palette.ring;
    context.lineWidth = 5;
    context.beginPath();
    context.moveTo(center.x, center.y);
    context.lineTo(arrowX, arrowY);
    context.stroke();
    context.beginPath();
    context.moveTo(arrowX, arrowY);
    context.lineTo(
      arrowX - Math.cos(angle - 0.55) * 19,
      arrowY - Math.sin(angle - 0.55) * 19,
    );
    context.lineTo(
      arrowX - Math.cos(angle + 0.55) * 19,
      arrowY - Math.sin(angle + 0.55) * 19,
    );
    context.closePath();
    context.fill();
  }
  context.restore();
}

function drawGround(context: CanvasRenderingContext2D, theme: GameTheme) {
  context.fillStyle = theme.palette.ground;
  context.fillRect(0, GROUND_Y, VIEW_WIDTH, VIEW_HEIGHT - GROUND_Y);
  context.fillStyle = theme.palette.groundEdge;
  context.fillRect(0, GROUND_Y, VIEW_WIDTH, 10);
}

export class GameRenderer {
  private terrainLayer: HTMLCanvasElement | null = null;
  private terrainKey = '';

  private getTerrainLayer(game: GameState, theme: GameTheme) {
    const key = `${game.match.seed}:${game.match.craters.length}:${theme.id}`;
    if (this.terrainLayer && this.terrainKey === key) return this.terrainLayer;

    const layer = document.createElement('canvas');
    layer.width = VIEW_WIDTH;
    layer.height = VIEW_HEIGHT;
    const context = layer.getContext('2d');
    if (!context) return layer;

    game.match.buildings.forEach((building) => {
      const left = worldToScreen({ x: building.x, y: 0 }).x;
      const roof = worldToScreen({ x: 0, y: building.height }).y;
      const width = building.width * WORLD_SCALE;
      const height = building.height * WORLD_SCALE;
      context.fillStyle = theme.palette.buildingOutline;
      context.fillRect(left - 3, roof - 6, width + 6, height + 6);
      context.fillStyle =
        theme.palette.facades[building.facade % theme.palette.facades.length];
      context.fillRect(left, roof, width, height);

      const random = createRandom(building.windowSeed);
      const columns = Math.max(2, Math.floor(width / 36));
      const floors = Math.floor(building.height / GAME_CONFIG.floorHeight);
      const cellWidth = width / columns;
      for (let floor = 0; floor < floors; floor += 1) {
        for (let column = 0; column < columns; column += 1) {
          context.fillStyle =
            random() > 0.72
              ? theme.palette.windowLit
              : theme.palette.windowDark;
          context.fillRect(
            Math.round(left + column * cellWidth + cellWidth * 0.3),
            Math.round(
              roof + 18 + floor * GAME_CONFIG.floorHeight * WORLD_SCALE,
            ),
            Math.max(8, Math.round(cellWidth * 0.32)),
            15,
          );
        }
      }
    });

    context.globalCompositeOperation = 'destination-out';
    for (const crater of game.match.craters) {
      const center = worldToScreen(crater);
      context.beginPath();
      context.arc(
        center.x,
        center.y,
        crater.radius * WORLD_SCALE,
        0,
        Math.PI * 2,
      );
      context.fill();
    }
    context.globalCompositeOperation = 'source-over';

    this.terrainLayer = layer;
    this.terrainKey = key;
    return layer;
  }

  draw(
    context: CanvasRenderingContext2D,
    game: GameState,
    theme: GameTheme,
    pointer: Point | null,
  ) {
    context.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    drawSky(context, game, theme);
    context.drawImage(this.getTerrainLayer(game, theme), 0, 0);
    drawFlag(context, game, theme);
    game.match.gorillas.forEach((gorilla) =>
      drawGorilla(context, game, theme, gorilla),
    );
    drawProjectile(context, game, theme);
    drawExplosion(context, game, theme);
    drawAimingRing(context, game, theme, pointer);
    drawGround(context, theme);
  }
}

import {
  createRandom,
  GAME_CONFIG,
  gorillaCenter,
  isComputerTurn,
  shotStrength,
  type Building,
  type GameState,
  type Gorilla,
  type Point,
} from './core';
import type { GameTheme, GorillaPose, PixelSprite } from './theme';

export const VIEW_WIDTH = 1600;
export const VIEW_HEIGHT = 900;
const WORLD_SCALE = 13.5;
const WORLD_LEFT = (VIEW_WIDTH - GAME_CONFIG.arenaWidth * WORLD_SCALE) / 2;
const GROUND_Y = 820;
const PIXEL_GRID = 4;

type RGB = { r: number; g: number; b: number };

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

function parseColor(color: string): RGB | null {
  const hex = color.trim().replace('#', '');
  if (hex.length !== 6) return null;
  const value = Number.parseInt(hex, 16);
  if (!Number.isFinite(value)) return null;
  return { r: value >> 16, g: (value >> 8) & 255, b: value & 255 };
}

function mixColor(first: string, second: string, amount: number) {
  const a = parseColor(first);
  const b = parseColor(second);
  if (!a || !b) return first;
  const mix = (left: number, right: number) =>
    Math.round(left + (right - left) * amount);
  return `rgb(${mix(a.r, b.r)} ${mix(a.g, b.g)} ${mix(a.b, b.b)})`;
}

function colorWithAlpha(color: string, alpha: number) {
  const parsed = parseColor(color);
  if (!parsed) return color;
  return `rgb(${parsed.r} ${parsed.g} ${parsed.b} / ${alpha})`;
}

function pixel(value: number, grid = PIXEL_GRID) {
  return Math.round(value / grid) * grid;
}

function drawPixelSprite(
  context: CanvasRenderingContext2D,
  sprite: PixelSprite,
  position: Point,
  pixelSize: number,
  facing: 1 | -1,
  overrides: Record<string, string> = {},
) {
  const width = Math.max(...sprite.rows.map((row) => row.length));
  const height = sprite.rows.length;
  context.save();
  context.translate(Math.round(position.x), Math.round(position.y));
  context.scale(facing, 1);
  context.translate((-width * pixelSize) / 2, -height * pixelSize);
  context.imageSmoothingEnabled = false;

  sprite.rows.forEach((row, rowIndex) => {
    row.split('').forEach((spritePixel, columnIndex) => {
      if (spritePixel === '.') return;
      context.fillStyle =
        overrides[spritePixel] ?? sprite.colors[spritePixel] ?? '#ffffff';
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

function drawGorillaSheetFrame(
  context: CanvasRenderingContext2D,
  theme: GameTheme,
  player: 0 | 1,
  pose: GorillaPose,
  position: Point,
  facing: 1 | -1,
) {
  const sheet = theme.gorillaSheet;
  if (!sheet) return false;
  const frameWidth = sheet.image.naturalWidth / sheet.columns;
  const frameHeight = sheet.image.naturalHeight / sheet.rows;
  const column = sheet.frames[pose];
  const row = sheet.playerRows[player];

  context.save();
  context.translate(pixel(position.x, 2), pixel(position.y, 2));
  context.scale(facing, 1);
  context.imageSmoothingEnabled = false;
  context.drawImage(
    sheet.image,
    column * frameWidth,
    row * frameHeight,
    frameWidth,
    frameHeight,
    -sheet.renderWidth / 2,
    -sheet.renderHeight + sheet.renderHeight * sheet.baselineOffsets[player],
    sheet.renderWidth,
    sheet.renderHeight,
  );
  context.restore();
  return true;
}

type FlagMotion = {
  stretch: number;
  verticalScale: number;
  amplitude: number;
  speed: number;
  droop: number;
};

export function getFlagMotion(wind: number): FlagMotion {
  const strength = Math.min(1, Math.abs(wind) / GAME_CONFIG.windMax);
  return {
    stretch: 0.58 + strength * 0.54,
    verticalScale: 1.08 - strength * 0.08,
    amplitude: strength * (1.25 + strength * 4.75),
    speed: 2.5 + strength * 8,
    droop: 9 * (1 - strength) ** 1.5,
  };
}

function flagWaveOffset(progress: number, elapsed: number, motion: FlagMotion) {
  const attachmentFalloff = progress ** 1.25;
  const primaryWave = Math.sin(
    elapsed * motion.speed - progress * Math.PI * 2.4,
  );
  const trailingFlutter =
    Math.sin(elapsed * motion.speed * 1.7 - progress * Math.PI * 4.2) *
    progress *
    0.22;
  return Math.round(
    motion.droop * progress ** 1.6 +
      motion.amplitude * attachmentFalloff * (primaryWave + trailingFlutter),
  );
}

function drawWavingFlagSprite(
  context: CanvasRenderingContext2D,
  sprite: PixelSprite,
  position: Point,
  pixelSize: number,
  direction: 1 | -1,
  elapsed: number,
  motion: FlagMotion,
) {
  const width = Math.max(...sprite.rows.map((row) => row.length));

  context.save();
  context.translate(Math.round(position.x), Math.round(position.y));
  context.scale(direction, 1);
  context.imageSmoothingEnabled = false;

  sprite.rows.forEach((row, rowIndex) => {
    row.split('').forEach((spritePixel, columnIndex) => {
      if (spritePixel === '.') return;
      const progress = width <= 1 ? 0 : columnIndex / (width - 1);
      const left = Math.round(columnIndex * pixelSize * motion.stretch);
      const right = Math.round((columnIndex + 1) * pixelSize * motion.stretch);
      const top = Math.round(
        rowIndex * pixelSize * motion.verticalScale +
          flagWaveOffset(progress, elapsed, motion),
      );
      const bottom = Math.round(
        (rowIndex + 1) * pixelSize * motion.verticalScale +
          flagWaveOffset(progress, elapsed, motion),
      );

      context.fillStyle = sprite.colors[spritePixel] ?? '#ffffff';
      context.fillRect(
        left,
        top,
        Math.max(1, right - left),
        Math.max(1, bottom - top),
      );
    });
  });
  context.restore();
}

const CLOUD_MASSES = [
  [0, 36, 58, 18],
  [28, 22, 62, 31],
  [66, 8, 54, 45],
  [105, 0, 45, 53],
  [140, 17, 64, 36],
  [193, 29, 52, 24],
  [232, 39, 42, 14],
] as const;

function drawPixelCloud(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  color: string,
  skyColor: string,
  alpha: number,
) {
  const unit = Math.max(2, Math.round(4 * scale));
  const snap = (value: number) => Math.round(value / unit) * unit;
  const shadow = mixColor(color, skyColor, 0.44);
  const highlight = mixColor(color, '#f3f7f5', 0.26);

  context.save();
  context.globalAlpha = alpha;
  context.fillStyle = shadow;
  CLOUD_MASSES.forEach(([massX, massY, width, height]) => {
    context.fillRect(
      snap(x + massX * scale),
      snap(y + (massY + 9) * scale),
      snap(width * scale),
      snap(height * scale),
    );
  });
  context.fillRect(
    snap(x + 18 * scale),
    snap(y + 48 * scale),
    snap(238 * scale),
    snap(13 * scale),
  );

  context.fillStyle = color;
  CLOUD_MASSES.slice(1, 6).forEach(([massX, massY, width, height]) => {
    context.fillRect(
      snap(x + (massX + 3) * scale),
      snap(y + massY * scale),
      snap((width - 7) * scale),
      snap(Math.max(8, height - 9) * scale),
    );
  });

  context.fillStyle = highlight;
  for (const [massX, massY, width] of CLOUD_MASSES.slice(2, 6)) {
    context.fillRect(
      snap(x + (massX + 8) * scale),
      snap(y + (massY + 5) * scale),
      snap(Math.max(10, width * 0.5) * scale),
      snap(6 * scale),
    );
  }
  context.restore();
}

function wrap(value: number, range: number) {
  return ((value % range) + range) % range;
}

function drawCityLayer(
  context: CanvasRenderingContext2D,
  seed: number,
  baseColor: string,
  skyColor: string,
  minimumHeight: number,
  maximumHeight: number,
  minimumWidth: number,
  alpha: number,
  showWindows: boolean,
) {
  const random = createRandom(seed);
  let x = -24;

  context.save();
  context.globalAlpha = alpha;
  while (x < VIEW_WIDTH + 24) {
    const width = pixel(minimumWidth + random() * 44);
    const height = pixel(
      minimumHeight + random() * (maximumHeight - minimumHeight),
    );
    const roof = GROUND_Y - height;
    const body =
      random() > 0.52 ? baseColor : mixColor(baseColor, skyColor, 0.18);

    context.fillStyle = body;
    context.fillRect(x, roof, width, height);
    context.fillStyle = mixColor(body, '#172934', 0.2);
    context.fillRect(x + width - 6, roof + 8, 6, height - 8);

    const rooftopKind = Math.floor(random() * 4);
    if (rooftopKind === 0) {
      context.fillRect(x + width * 0.32, roof - 12, width * 0.36, 12);
    } else if (rooftopKind === 1) {
      context.fillRect(x + width * 0.5 - 2, roof - 24, 4, 24);
      context.fillRect(x + width * 0.5 + 2, roof - 20, 10, 3);
    } else if (rooftopKind === 2) {
      context.fillRect(x + 10, roof - 9, 12, 9);
    }

    if (showWindows) {
      const litColor = mixColor('#d9bd62', skyColor, 0.32);
      for (let windowY = roof + 22; windowY < GROUND_Y - 20; windowY += 28) {
        for (let windowX = x + 12; windowX < x + width - 9; windowX += 19) {
          if (random() > 0.64) {
            context.fillStyle = litColor;
            context.fillRect(pixel(windowX, 2), pixel(windowY, 2), 5, 7);
          }
        }
      }
    }
    x += width + pixel(4 + random() * 12);
  }
  context.restore();
}

function drawSky(
  context: CanvasRenderingContext2D,
  game: GameState,
  theme: GameTheme,
) {
  const gradient = context.createLinearGradient(0, 0, 0, GROUND_Y);
  gradient.addColorStop(0, theme.palette.skyTop);
  gradient.addColorStop(
    0.58,
    mixColor(theme.palette.skyTop, theme.palette.skyBottom, 0.7),
  );
  gradient.addColorStop(1, theme.palette.skyBottom);
  context.fillStyle = gradient;
  context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  context.fillStyle = colorWithAlpha(theme.palette.cloudFar, 0.06);
  for (let y = 24; y < GROUND_Y; y += 28) {
    context.fillRect(0, y, VIEW_WIDTH, 2);
  }

  const drift = game.match.elapsed * game.match.wind * 4;
  drawPixelCloud(
    context,
    wrap(70 + drift * 0.32 + 420, 2140) - 420,
    108,
    1.05,
    theme.palette.cloudFar,
    theme.palette.skyTop,
    0.34,
  );
  drawPixelCloud(
    context,
    wrap(805 + drift * 0.25 + 420, 2140) - 420,
    40,
    0.84,
    theme.palette.cloudFar,
    theme.palette.skyTop,
    0.28,
  );
  drawPixelCloud(
    context,
    wrap(1325 + drift * 0.36 + 420, 2140) - 420,
    162,
    0.72,
    theme.palette.cloudFar,
    theme.palette.skyTop,
    0.26,
  );
  drawPixelCloud(
    context,
    wrap(340 + drift * 0.62 + 500, 2250) - 500,
    238,
    1.24,
    theme.palette.cloudNear,
    theme.palette.skyBottom,
    0.5,
  );
  drawPixelCloud(
    context,
    wrap(1120 + drift * 0.54 + 500, 2250) - 500,
    92,
    1.04,
    theme.palette.cloudNear,
    theme.palette.skyTop,
    0.44,
  );

  drawCityLayer(
    context,
    game.match.seed ^ 0x1f77d5,
    mixColor(theme.palette.distantCity, theme.palette.skyBottom, 0.44),
    theme.palette.skyBottom,
    72,
    164,
    32,
    0.54,
    false,
  );
  drawCityLayer(
    context,
    game.match.seed ^ 0x51edc17,
    theme.palette.distantCity,
    theme.palette.skyBottom,
    104,
    230,
    38,
    0.72,
    true,
  );

  const haze = context.createLinearGradient(0, 560, 0, GROUND_Y);
  haze.addColorStop(0, colorWithAlpha(theme.palette.skyBottom, 0));
  haze.addColorStop(1, colorWithAlpha(theme.palette.skyBottom, 0.16));
  context.fillStyle = haze;
  context.fillRect(0, 560, VIEW_WIDTH, GROUND_Y - 560);
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
  const motion = getFlagMotion(game.match.wind);
  const height = 76;
  const poleX = pixel(anchor.x, 2);
  const poleTop = pixel(anchor.y - height, 2);

  context.fillStyle = theme.palette.buildingOutline;
  context.fillRect(poleX - 4, poleTop - 3, 8, height + 5);
  context.fillStyle = mixColor(theme.palette.buildingOutline, '#dbe5e5', 0.48);
  context.fillRect(poleX - 1, poleTop, 2, height);
  context.fillStyle = theme.palette.buildingOutline;
  context.fillRect(poleX - 8, anchor.y - 4, 16, 5);
  context.fillRect(poleX - 6, poleTop - 7, 12, 8);
  context.fillStyle = theme.palette.windowLit;
  context.fillRect(poleX - 2, poleTop - 5, 4, 4);

  drawWavingFlagSprite(
    context,
    theme.sprites.flag,
    { x: poleX, y: poleTop + 7 },
    3,
    direction,
    game.match.elapsed,
    motion,
  );
}

function drawGorilla(
  context: CanvasRenderingContext2D,
  game: GameState,
  theme: GameTheme,
  gorilla: Gorilla,
  presentation = false,
) {
  const isHit =
    !gorilla.alive &&
    game.match.phase === 'impact' &&
    game.match.explosion?.kind === 'gorilla';
  if (!gorilla.alive && !isHit) return;
  const opponent = game.match.gorillas[gorilla.player === 0 ? 1 : 0];
  const facing: 1 | -1 = opponent.x >= gorilla.x ? 1 : -1;
  const isWinner =
    game.match.phase === 'victory' && game.match.winner === gorilla.player;
  const dance = isWinner ? Math.sin(game.match.elapsed * 15) : 0;
  const position = worldToScreen({
    x: gorilla.x + (isWinner ? dance * 0.16 : 0),
    y: gorilla.roofY + (isWinner ? Math.abs(dance) * 0.28 : 0),
  });
  const teamColor = gorilla.player === 0 ? theme.palette.p1 : theme.palette.p2;
  const bodyColor = gorilla.player === 0 ? '#563528' : '#29333a';
  const shadowColor = gorilla.player === 0 ? '#35231f' : '#182128';
  const pose = getGorillaPose(game, gorilla, presentation);

  context.save();
  context.shadowColor = 'rgb(9 15 18 / 0.55)';
  context.shadowBlur = 0;
  context.shadowOffsetX = facing * -4;
  context.shadowOffsetY = 4;
  const usedSheet = drawGorillaSheetFrame(
    context,
    theme,
    gorilla.player,
    pose,
    position,
    facing,
  );
  if (!usedSheet) {
    drawPixelSprite(context, theme.sprites.gorilla, position, 4, facing, {
      B: bodyColor,
      M: shadowColor,
      A: teamColor,
    });
  }
  context.restore();

  if (!usedSheet && !isWinner) {
    drawPixelSprite(
      context,
      theme.sprites.banana,
      { x: position.x + facing * 37, y: position.y - 31 },
      2.2,
      facing,
    );
  } else if (!usedSheet) {
    context.fillStyle = teamColor;
    context.fillRect(position.x - 34, position.y - 55 - dance * 11, 13, 9);
    context.fillRect(position.x + 21, position.y - 55 + dance * 11, 13, 9);
  }
}

export function getGorillaPose(
  game: GameState,
  gorilla: Gorilla,
  presentation = false,
): GorillaPose {
  if (presentation) return 'idle';
  if (!gorilla.alive) return 'hit';
  if (game.match.phase === 'victory' && game.match.winner === gorilla.player) {
    return 'victory';
  }
  if (game.match.activePlayer !== gorilla.player) return 'idle';
  if (game.match.phase === 'aiming') return 'aim';
  if (game.match.phase === 'projectile-flight') return 'throw';
  return 'idle';
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
  context.strokeStyle = colorWithAlpha(theme.palette.explosionCore, 0.42);
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(-24, 5);
  context.lineTo(-11, 5);
  context.stroke();
  drawPixelSprite(context, theme.sprites.banana, { x: 0, y: 7 }, 2.6, 1);
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
  const maximumRadius =
    (explosion.kind === 'terrain' ? GAME_CONFIG.craterRadius : 3.8) *
    WORLD_SCALE;
  const radius = maximumRadius * Math.sin(progress * Math.PI);
  const size = Math.max(5, radius);
  context.save();
  context.globalAlpha = 0.94 - progress * 0.42;
  context.translate(pixel(center.x, 2), pixel(center.y, 2));
  context.rotate(Math.PI / 4);
  context.fillStyle = theme.palette.explosionEdge;
  context.fillRect(-size * 0.72, -size * 0.72, size * 1.44, size * 1.44);
  context.fillStyle = theme.palette.explosionCore;
  context.fillRect(-size * 0.4, -size * 0.4, size * 0.8, size * 0.8);
  context.restore();

  context.save();
  for (let index = 0; index < 16; index += 1) {
    const angle = (index / 16) * Math.PI * 2 + game.match.seed * 0.01;
    const distance = maximumRadius * progress * (0.45 + (index % 4) * 0.16);
    const particleSize = Math.max(3, 10 * (1 - progress));
    context.globalAlpha = Math.max(0, 1 - progress) * 0.9;
    context.fillStyle =
      index % 4 === 0
        ? theme.palette.craterRim
        : index % 2 === 0
          ? theme.palette.explosionCore
          : theme.palette.explosionEdge;
    context.fillRect(
      pixel(center.x + Math.cos(angle) * distance, 2),
      pixel(center.y + Math.sin(angle) * distance, 2),
      particleSize,
      particleSize,
    );
  }
  context.restore();
}

function cutCraterDamage(
  context: CanvasRenderingContext2D,
  game: GameState,
  theme: GameTheme,
) {
  for (const [index, crater] of game.match.craters.entries()) {
    const center = worldToScreen(crater);
    const radius = crater.radius * WORLD_SCALE;
    const random = createRandom(
      game.match.seed ^ Math.imul(index + 1, 0x9e3779b9),
    );

    context.save();
    context.globalCompositeOperation = 'source-atop';
    context.strokeStyle = theme.palette.craterRim;
    context.lineWidth = 16;
    context.beginPath();
    context.arc(center.x, center.y, radius, 0, Math.PI * 2);
    context.stroke();

    context.fillStyle = theme.palette.craterRim;
    for (let chip = 0; chip < 14; chip += 1) {
      const angle = random() * Math.PI * 2;
      const distance = radius + 5 + random() * 13;
      const size = 3 + Math.round(random() * 6);
      context.fillRect(
        pixel(center.x + Math.cos(angle) * distance - size / 2, 2),
        pixel(center.y + Math.sin(angle) * distance - size / 2, 2),
        size,
        size,
      );
    }

    context.globalCompositeOperation = 'destination-out';
    context.beginPath();
    context.arc(center.x, center.y, radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
}

function drawAimingRing(
  context: CanvasRenderingContext2D,
  game: GameState,
  theme: GameTheme,
  pointer: Point | null,
) {
  if (game.match.phase !== 'aiming' || isComputerTurn(game)) return;
  const gorilla = game.match.gorillas[game.match.activePlayer];
  const centerWorld = gorillaCenter(gorilla);
  const center = worldToScreen(centerWorld);
  const strength = pointer ? shotStrength(gorilla, pointer) : 0;
  const innerRadius = GAME_CONFIG.aimStartRadius * WORLD_SCALE;
  const outerRadius = (10.8 + strength * 5.1) * WORLD_SCALE;
  const bandWidth = outerRadius - innerRadius;

  context.save();
  context.shadowColor = 'rgb(16 29 38 / 0.38)';
  context.shadowBlur = 5;
  context.strokeStyle = theme.palette.ring;
  context.lineWidth = 3;
  context.beginPath();
  context.arc(center.x, center.y, outerRadius, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.arc(center.x, center.y, innerRadius, 0, Math.PI * 2);
  context.stroke();
  context.shadowBlur = 0;

  context.globalAlpha = 0.04 + strength * 0.23;
  context.strokeStyle = theme.palette.ringFill;
  context.lineWidth = Math.max(1, bandWidth - 5);
  context.beginPath();
  context.arc(center.x, center.y, innerRadius + bandWidth / 2, 0, Math.PI * 2);
  context.stroke();
  context.globalAlpha = 1;

  if (pointer) {
    const pullX = pointer.x - centerWorld.x;
    const pullY = pointer.y - centerWorld.y;
    const pullLength = Math.max(0.0001, Math.hypot(pullX, pullY));
    const directionX = -pullX / pullLength;
    const directionY = -pullY / pullLength;
    const arrowX = center.x + directionX * outerRadius;
    const arrowY = center.y - directionY * outerRadius;
    const angle = Math.atan2(-directionY, directionX);
    const pointerScreen = worldToScreen(pointer);

    context.strokeStyle = colorWithAlpha(theme.palette.ring, 0.76);
    context.lineWidth = 2;
    context.setLineDash([6, 7]);
    context.beginPath();
    context.moveTo(center.x, center.y);
    context.lineTo(pointerScreen.x, pointerScreen.y);
    context.stroke();
    context.setLineDash([]);

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
      arrowX - Math.cos(angle - 0.55) * 22,
      arrowY - Math.sin(angle - 0.55) * 22,
    );
    context.lineTo(
      arrowX - Math.cos(angle + 0.55) * 22,
      arrowY - Math.sin(angle + 0.55) * 22,
    );
    context.closePath();
    context.fill();
  }
  context.restore();
}

function drawGround(context: CanvasRenderingContext2D, theme: GameTheme) {
  context.fillStyle = theme.palette.groundEdge;
  context.fillRect(0, GROUND_Y, VIEW_WIDTH, 14);
  context.fillStyle = mixColor(theme.palette.groundEdge, '#c1d0d2', 0.18);
  context.fillRect(0, GROUND_Y, VIEW_WIDTH, 3);
  context.fillStyle = theme.palette.ground;
  context.fillRect(0, GROUND_Y + 14, VIEW_WIDTH, VIEW_HEIGHT - GROUND_Y - 14);

  context.strokeStyle = colorWithAlpha(theme.palette.groundEdge, 0.48);
  context.lineWidth = 2;
  for (let y = GROUND_Y + 35; y < VIEW_HEIGHT; y += 24) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(VIEW_WIDTH, y);
    context.stroke();
    const offset = ((y - GROUND_Y) / 24) % 2 === 0 ? 0 : 38;
    for (let x = offset; x < VIEW_WIDTH; x += 76) {
      context.beginPath();
      context.moveTo(x, y - 22);
      context.lineTo(x, y);
      context.stroke();
    }
  }

  const fade = context.createLinearGradient(0, GROUND_Y + 20, 0, VIEW_HEIGHT);
  fade.addColorStop(0, 'rgb(5 11 15 / 0)');
  fade.addColorStop(1, 'rgb(5 11 15 / 0.56)');
  context.fillStyle = fade;
  context.fillRect(0, GROUND_Y, VIEW_WIDTH, VIEW_HEIGHT - GROUND_Y);
}

function drawWindow(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  lit: boolean,
  theme: GameTheme,
) {
  const frame = theme.palette.buildingOutline;
  const glass = lit ? theme.palette.windowLit : theme.palette.windowDark;
  context.fillStyle = colorWithAlpha(frame, 0.46);
  context.fillRect(x - 4, y + 4, width + 8, height + 5);
  context.fillStyle = frame;
  context.fillRect(x - 3, y - 3, width + 6, height + 6);
  context.fillStyle = glass;
  context.fillRect(x, y, width, height);
  context.fillStyle = lit
    ? colorWithAlpha('#fff2aa', 0.58)
    : colorWithAlpha(theme.palette.cloudNear, 0.2);
  context.fillRect(x + 3, y + 3, Math.max(3, width * 0.27), height - 6);
  context.fillStyle = colorWithAlpha(frame, 0.78);
  context.fillRect(x + Math.floor(width / 2) - 1, y, 3, height);
  context.fillRect(x, y + Math.floor(height / 2) - 1, width, 3);
  context.fillStyle = mixColor(frame, '#aab9ba', 0.2);
  context.fillRect(x - 5, y + height + 3, width + 10, 4);
}

function drawRoofDetails(
  context: CanvasRenderingContext2D,
  building: Building,
  left: number,
  roof: number,
  width: number,
  theme: GameTheme,
) {
  const random = createRandom(building.windowSeed ^ 0x72a9);
  const outline = theme.palette.buildingOutline;
  const metal = mixColor(
    theme.palette.distantCity,
    theme.palette.cloudNear,
    0.28,
  );
  const kind = Math.floor(random() * 4);
  const center = pixel(left + width * (0.34 + random() * 0.32), 2);

  if (kind === 0 && width > 92) {
    context.fillStyle = outline;
    context.fillRect(center - 24, roof - 41, 48, 31);
    context.fillRect(center - 29, roof - 35, 58, 18);
    context.fillRect(center - 19, roof - 10, 5, 12);
    context.fillRect(center + 14, roof - 10, 5, 12);
    context.fillStyle = metal;
    context.fillRect(center - 21, roof - 37, 42, 23);
    context.fillStyle = colorWithAlpha(theme.palette.cloudNear, 0.28);
    context.fillRect(center - 16, roof - 33, 4, 15);
  } else if (kind === 1) {
    const chimneyX = pixel(left + 14 + random() * Math.max(8, width - 42), 2);
    context.fillStyle = outline;
    context.fillRect(chimneyX - 4, roof - 28, 24, 29);
    context.fillStyle = mixColor(
      theme.palette.facades[building.facade % theme.palette.facades.length],
      '#d1c6ae',
      0.18,
    );
    context.fillRect(chimneyX, roof - 24, 16, 24);
    context.fillStyle = outline;
    context.fillRect(chimneyX - 6, roof - 31, 28, 7);
  } else if (kind === 2) {
    context.fillStyle = outline;
    context.fillRect(center - 2, roof - 50, 4, 51);
    context.fillRect(center - 18, roof - 37, 36, 4);
    context.fillRect(center + 9, roof - 49, 4, 17);
    context.fillStyle = metal;
    context.fillRect(center - 14, roof - 33, 4, 20);
  } else {
    context.fillStyle = outline;
    context.fillRect(center - 16, roof - 19, 32, 20);
    context.fillStyle = metal;
    context.fillRect(center - 12, roof - 15, 24, 15);
    context.fillStyle = colorWithAlpha(theme.palette.cloudNear, 0.3);
    context.fillRect(center - 8, roof - 12, 4, 9);
  }
}

function drawBuilding(
  context: CanvasRenderingContext2D,
  game: GameState,
  building: Building,
  theme: GameTheme,
) {
  const left = pixel(worldToScreen({ x: building.x, y: 0 }).x, 2);
  const roof = pixel(worldToScreen({ x: 0, y: building.height }).y, 2);
  const width = pixel(building.width * WORLD_SCALE, 2);
  const height = GROUND_Y - roof;
  const outline = theme.palette.buildingOutline;
  const facade =
    theme.palette.facades[building.facade % theme.palette.facades.length];
  const random = createRandom(building.windowSeed);

  context.fillStyle = outline;
  context.fillRect(left - 5, roof - 8, width + 10, height + 8);
  const facadeGradient = context.createLinearGradient(left, 0, left + width, 0);
  facadeGradient.addColorStop(0, mixColor(facade, '#dce5dc', 0.08));
  facadeGradient.addColorStop(0.72, facade);
  facadeGradient.addColorStop(1, mixColor(facade, outline, 0.28));
  context.fillStyle = facadeGradient;
  context.fillRect(left, roof, width, height);

  context.fillStyle = colorWithAlpha(outline, 0.22);
  for (let brickY = roof + 14; brickY < GROUND_Y - 42; brickY += 17) {
    context.fillRect(left + 2, brickY, width - 4, 2);
    const offset = Math.floor((brickY - roof) / 17) % 2 === 0 ? 14 : 30;
    for (let brickX = left + offset; brickX < left + width - 8; brickX += 34) {
      context.fillRect(brickX, brickY - 15, 2, 15);
    }
  }

  context.fillStyle = outline;
  context.fillRect(left - 7, roof - 9, width + 14, 7);
  context.fillStyle = mixColor(facade, '#d7ded6', 0.24);
  context.fillRect(left - 4, roof - 5, width + 8, 5);
  context.fillStyle = colorWithAlpha('#e7eded', 0.15);
  context.fillRect(left + 2, roof + 3, width - 8, 3);

  const columns = Math.max(2, Math.min(4, Math.floor(width / 39)));
  const floors = Math.floor(building.height / GAME_CONFIG.floorHeight);
  const cellWidth = width / columns;
  const floorHeight = GAME_CONFIG.floorHeight * WORLD_SCALE;
  const windowWidth = Math.max(13, Math.min(23, cellWidth * 0.46));
  const windowHeight = Math.max(18, Math.min(25, floorHeight * 0.55));

  for (let floor = 0; floor < floors - 1; floor += 1) {
    for (let column = 0; column < columns; column += 1) {
      const windowX = pixel(
        left + column * cellWidth + (cellWidth - windowWidth) / 2,
        2,
      );
      const windowY = pixel(
        roof + 13 + floor * floorHeight + (floorHeight - windowHeight) / 2,
        2,
      );
      drawWindow(
        context,
        windowX,
        windowY,
        pixel(windowWidth, 2),
        pixel(windowHeight, 2),
        random() > 0.7,
        theme,
      );
    }
  }

  const doorWidth = Math.max(19, Math.min(30, cellWidth * 0.56));
  const doorHeight = 38;
  const doorX = pixel(left + (width - doorWidth) / 2, 2);
  const doorY = GROUND_Y - doorHeight;
  context.fillStyle = outline;
  context.fillRect(doorX - 4, doorY - 5, doorWidth + 8, doorHeight + 5);
  context.fillStyle = mixColor(facade, outline, 0.56);
  context.fillRect(doorX, doorY, doorWidth, doorHeight);
  context.fillStyle = theme.palette.windowLit;
  context.fillRect(doorX + doorWidth - 7, doorY + doorHeight * 0.55, 3, 3);

  context.fillStyle = colorWithAlpha(outline, 0.4);
  context.fillRect(left + width - 7, roof + 5, 7, height - 5);

  const occupied = game.match.gorillas.some(
    (gorilla) => gorilla.buildingId === building.id,
  );
  if (!occupied && game.match.flagBuildingId !== building.id) {
    drawRoofDetails(context, building, left, roof, width, theme);
  }
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

    game.match.buildings.forEach((building) =>
      drawBuilding(context, game, building, theme),
    );

    cutCraterDamage(context, game, theme);

    this.terrainLayer = layer;
    this.terrainKey = key;
    return layer;
  }

  draw(
    context: CanvasRenderingContext2D,
    game: GameState,
    theme: GameTheme,
    pointer: Point | null,
    presentation = false,
  ) {
    context.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    context.imageSmoothingEnabled = false;
    drawSky(context, game, theme);
    context.drawImage(this.getTerrainLayer(game, theme), 0, 0);
    drawGround(context, theme);
    drawFlag(context, game, theme);
    game.match.gorillas.forEach((gorilla) =>
      drawGorilla(context, game, theme, gorilla, presentation),
    );
    drawProjectile(context, game, theme);
    drawExplosion(context, game, theme);
    if (!presentation) drawAimingRing(context, game, theme, pointer);
  }
}

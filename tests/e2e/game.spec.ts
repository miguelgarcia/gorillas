import { expect, test, type Page } from '@playwright/test';
import { createGame, gorillaCenter } from '../../lib/game/core';

const VIEW_WIDTH = 1600;
const VIEW_HEIGHT = 900;
const WORLD_SCALE = 13.5;
const WORLD_LEFT = 125;
const GROUND_Y = 820;

async function worldToClient(page: Page, point: { x: number; y: number }) {
  const bounds = await page.locator('.game-canvas').boundingBox();
  if (!bounds) throw new Error('Game canvas is not visible');
  return {
    x:
      bounds.x +
      ((WORLD_LEFT + point.x * WORLD_SCALE) / VIEW_WIDTH) * bounds.width,
    y:
      bounds.y +
      ((GROUND_Y - point.y * WORLD_SCALE) / VIEW_HEIGHT) * bounds.height,
  };
}

test('loads a deterministic desktop arena and preserves it when reset is cancelled', async ({
  page,
}) => {
  await page.goto('/?seed=4242');
  const game = page.getByRole('region', {
    name: 'Gorillas local hot-seat game',
  });
  await expect(game).toHaveAttribute('data-active-player', '1');
  await expect(game).toHaveAttribute('data-match-number', '1');
  await expect(game).toHaveAttribute('data-phase', 'aiming');
  await expect(page.getByText('P1', { exact: true })).toBeVisible();
  await expect(page.getByText('P2', { exact: true })).toBeVisible();
  await expect(page.getByText('BUILDING CITY')).toBeHidden();

  await page.keyboard.press('Escape');
  await expect(page.getByText('RESET SCORES?')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText('RESET SCORES?')).toBeHidden();
  await expect(game).toHaveAttribute('data-phase', 'aiming');
});

test('mutes game audio and preserves the preference across reloads', async ({
  page,
}) => {
  await page.goto('/?seed=4242');
  const mute = page.getByRole('button', { name: 'Mute game audio' });
  await expect(mute).toHaveAttribute('aria-pressed', 'true');

  await mute.click();
  const unmute = page.getByRole('button', { name: 'Turn on game audio' });
  await expect(unmute).toHaveAttribute('aria-pressed', 'false');
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('gorillas:sound')))
    .toBe('off');

  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Turn on game audio' }),
  ).toHaveAttribute('aria-pressed', 'false');
});

test('registers WebMCP tools and rejects invalid throws without changing the match', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const tools = new Map<string, unknown>();
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: {
        tools,
        registerTool(
          tool: { name: string },
          options?: { signal?: AbortSignal },
        ) {
          tools.set(tool.name, tool);
          options?.signal?.addEventListener('abort', () =>
            tools.delete(tool.name),
          );
        },
      },
    });
  });
  await page.goto('/?seed=4242');
  await expect(page.locator('.game-frame')).toHaveAttribute(
    'data-phase',
    'aiming',
  );
  await page.waitForFunction(() => {
    const context = (
      document as Document & { modelContext?: { tools?: Map<string, unknown> } }
    ).modelContext;
    return context?.tools?.size === 2;
  });

  const result = await page.evaluate(async () => {
    const context = (
      document as Document & {
        modelContext: {
          tools: Map<string, { execute(input: unknown): unknown }>;
        };
      }
    ).modelContext;
    const names = [...context.tools.keys()];
    const read = context.tools.get('read_match_state');
    const shoot = context.tools.get('throw_banana');
    const state = (await read?.execute({})) as {
      activePlayer: number;
      phase: string;
      gorillas: Array<{ player: number; x: number; y: number }>;
    };
    let invalidError = '';
    try {
      await shoot?.execute({ dragEndX: 'wrong', dragEndY: 2 });
    } catch (error) {
      invalidError = error instanceof Error ? error.message : String(error);
    }
    const active = state.gorillas.find(
      (gorilla) => gorilla.player === state.activePlayer,
    );
    const launch = await shoot?.execute({
      dragEndX: active!.x + 10,
      dragEndY: active!.y - 10,
    });
    return { names, state, invalidError, launch };
  });

  expect(result.names).toEqual(['read_match_state', 'throw_banana']);
  expect(result.state).toMatchObject({ activePlayer: 1, phase: 'aiming' });
  expect(result.invalidError).toContain('finite numbers');
  expect(result.launch).toMatchObject({
    launched: true,
    phase: 'projectile-flight',
  });
  await expect(page.locator('.game-frame')).not.toHaveAttribute(
    'data-phase',
    'aiming',
  );
});

test('the second player can grab from the full visible inner aiming circle', async ({
  page,
}) => {
  await page.goto('/?seed=4242');
  const frame = page.locator('.game-frame');
  await expect(page.getByText('BUILDING CITY')).toBeHidden();
  const state = createGame(4242);
  const firstCenter = gorillaCenter(state.match.gorillas[0]);
  const firstStart = await worldToClient(page, firstCenter);
  const firstRelease = await worldToClient(page, {
    x: firstCenter.x + 10,
    y: firstCenter.y,
  });

  await page.mouse.move(firstStart.x, firstStart.y);
  await page.mouse.down();
  await page.mouse.move(firstRelease.x, firstRelease.y, { steps: 4 });
  await page.mouse.up();

  await expect(frame).toHaveAttribute('data-active-player', '2', {
    timeout: 5000,
  });
  await expect(frame).toHaveAttribute('data-phase', 'aiming');

  const secondCenter = gorillaCenter(state.match.gorillas[1]);
  const secondStart = await worldToClient(page, {
    x: secondCenter.x - 1.8,
    y: secondCenter.y - 3.9,
  });
  const secondRelease = await worldToClient(page, {
    x: secondCenter.x - 9.8,
    y: secondCenter.y - 11.9,
  });

  await page.mouse.move(secondStart.x, secondStart.y);
  await page.mouse.down();
  await page.mouse.move(secondRelease.x, secondRelease.y, { steps: 4 });
  await page.mouse.up();

  await expect(frame).toHaveAttribute('data-phase', 'projectile-flight');
});

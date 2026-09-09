import { expect, test, type Page } from '@playwright/test';
import { createGame, gorillaCenter } from '../../lib/game/core';

type MatchRead = {
  shotNumber: number;
  mode: string;
  phase: string;
  activePlayer: number;
  controller: string;
};
async function tool(page: Page, name: string, input = {}) {
  return page.evaluate(
    async ({ name, input }) => {
      const context = (
        document as Document & {
          modelContext: {
            tools: Map<string, { execute(input: unknown): unknown }>;
          };
        }
      ).modelContext;
      try {
        return {
          value: await context.tools.get(name)!.execute(input),
          error: '',
        };
      } catch (error) {
        return { value: null, error: String(error) };
      }
    },
    { name, input },
  );
}

test.beforeEach(async ({ page }) => {
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
  await page.getByRole('radio', { name: /Single player/ }).check();
});

test('selects difficulty, pauses computer thinking, rejects human takeover, and returns to local play', async ({
  page,
}, testInfo) => {
  await page.getByLabel('Difficulty', { exact: true }).selectOption('easy');
  await page.screenshot({
    path: testInfo.outputPath('single-player-menu.png'),
  });
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  const frame = page.getByRole('region', {
    name: 'Gorillas single-player game',
  });
  await expect(frame).toHaveAttribute('data-difficulty', 'easy');
  await expect(page.getByText('YOU', { exact: true })).toBeVisible();
  await expect(page.getByText('CPU', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('status').filter({ hasText: 'Your turn' }),
  ).toBeVisible();

  // Throw outwards to pass the turn without hitting either gorilla.
  const center = gorillaCenter(createGame(4242).match.gorillas[0]);
  const result = await tool(page, 'throw_banana', {
    dragEndX: center.x + 10,
    dragEndY: center.y,
  });
  expect(result.error).toBe('');
  await expect(frame).toHaveAttribute('data-active-player', '2');
  await expect(
    page.getByRole('status').filter({ hasText: 'CPU is lining up' }),
  ).toBeVisible();
  expect(
    (await tool(page, 'throw_banana', { dragEndX: 10, dragEndY: 10 })).error,
  ).toContain('computer controls');
  await page.keyboard.press('Escape');
  await expect(page.getByText('RESET SCORES?')).toBeVisible();
  await page.waitForTimeout(1400);
  await expect(frame).toHaveAttribute('data-phase', 'aiming');
  await page.keyboard.press('Escape');
  await expect(frame).toHaveAttribute('data-phase', 'projectile-flight');
  await page.screenshot({ path: testInfo.outputPath('computer-throw.png') });
  await expect
    .poll(
      async () => {
        const state = (await tool(page, 'read_match_state')).value as MatchRead;
        return state.activePlayer === 1 || state.phase === 'victory';
      },
      { timeout: 9000 },
    )
    .toBe(true);

  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('radio', { name: /Two players/ }).check();
  await expect(page.getByLabel('Difficulty', { exact: true })).toBeHidden();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.locator('.game-frame')).toHaveAttribute(
    'data-mode',
    'local',
  );
  await expect(page.locator('.scoreboard strong')).toHaveText(['0', '0']);
  expect((await tool(page, 'read_match_state')).value).toMatchObject({
    mode: 'local',
    controller: 'human',
    activePlayer: 1,
  });
});

test('scores a solo defeat once and lets the computer open a rematch', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  const center = gorillaCenter(createGame(4242).match.gorillas[0]);
  await tool(page, 'throw_banana', {
    dragEndX: center.x,
    dragEndY: center.y - 1,
  });
  await expect(page.getByText('CPU WINS', { exact: true })).toBeVisible();
  await expect(page.locator('.scoreboard strong')).toHaveText(['0', '1']);
  await page.keyboard.press('Enter');
  const frame = page.locator('.game-frame');
  await expect(frame).toHaveAttribute('data-match-number', '2');
  await expect(frame).toHaveAttribute('data-mode', 'single-player');
  await expect(frame).toHaveAttribute('data-active-player', '2');
  // A throw can immediately meet a nearby building; assert the durable shot
  // count instead of polling for a potentially one-frame flight phase.
  await expect
    .poll(
      async () =>
        ((await tool(page, 'read_match_state')).value as MatchRead).shotNumber,
    )
    .toBe(1);
  await expect(page.locator('.scoreboard strong')).toHaveText(['0', '1']);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Enter');
  await expect(page.locator('.scoreboard strong')).toHaveText(['0', '0']);
  await expect(frame).toHaveAttribute('data-match-number', '2');
});

test('menu cancels a pending computer turn and solo controls fit a small desktop', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 800, height: 500 });
  const banner = page.locator('.presentation-banner');
  const frame = page.locator('.game-frame');
  const outer = await frame.boundingBox();
  const inner = await banner.boundingBox();
  expect(inner!.y).toBeGreaterThanOrEqual(outer!.y);
  expect(inner!.y + inner!.height).toBeLessThanOrEqual(
    outer!.y + outer!.height,
  );
  await page.screenshot({
    path: testInfo.outputPath('small-desktop-menu.png'),
  });
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  const center = gorillaCenter(createGame(4242).match.gorillas[0]);
  await tool(page, 'throw_banana', {
    dragEndX: center.x + 10,
    dragEndY: center.y,
  });
  await expect(frame).toHaveAttribute('data-active-player', '2');
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.waitForTimeout(1400);
  await expect(frame).toHaveAttribute('data-screen', 'presentation');
  await expect(frame).toHaveAttribute('data-phase', 'aiming');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(frame).toHaveAttribute('data-mode', 'single-player');
  await expect(frame).toHaveAttribute('data-active-player', '1');
});

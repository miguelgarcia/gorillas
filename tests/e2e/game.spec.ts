import { expect, test } from '@playwright/test';

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

import { expect, test, type Page } from '@playwright/test';
import { createGame, gorillaCenter } from '../../lib/game/core';

// Fixed seed/color examples keep the browser assertions independent of the resolver.
const moods = [
  { seed: 13, name: 'overcast', sky: [56, 86, 114] },
  { seed: 2, name: 'dawn', sky: [98, 109, 152] },
  { seed: 1, name: 'sunset', sky: [120, 80, 110] },
  { seed: 8, name: 'moonlit', sky: [32, 46, 80] },
];

async function skyPixel(page: Page) {
  return page.locator('.game-canvas').evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    return Array.from(
      canvas.getContext('2d')!.getImageData(0, 0, 1, 1).data,
    ).slice(0, 3);
  });
}

async function expectSky(page: Page, expected: number[]) {
  await expect
    .poll(async () => {
      const actual = await skyPixel(page);
      return Math.max(
        ...actual.map((channel, i) => Math.abs(channel - expected[i])),
      );
    })
    .toBeLessThanOrEqual(2);
}

for (const mood of moods) {
  test(`${mood.name} lighting survives Start, score reset, and seeded reload`, async ({
    page,
  }) => {
    await page.goto(`/?seed=${mood.seed}`);
    const frame = page.locator('.game-frame');
    await expect(frame).toHaveAttribute('data-screen', 'presentation');
    await expectSky(page, mood.sky);
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await expect(frame).toHaveAttribute('data-screen', 'playing');
    await expectSky(page, mood.sky);
    await page.keyboard.press('Escape');
    await expect(page.getByText('RESET SCORES?')).toBeVisible();
    await expectSky(page, mood.sky);
    await page.keyboard.press('Escape');
    await expectSky(page, mood.sky);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Enter');
    await expect(page.getByText('RESET SCORES?')).toBeHidden();
    await expectSky(page, mood.sky);
    await page.reload();
    await expect(frame).toHaveAttribute('data-screen', 'presentation');
    await expectSky(page, mood.sky);
  });
}

test('victory keeps the lighting and rematch resolves the next seed', async ({
  page,
}) => {
  await page.goto('/?seed=2');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  const center = gorillaCenter(createGame(2).match.gorillas[0]);
  const bounds = await page.locator('.game-canvas').boundingBox();
  if (!bounds) throw new Error('Canvas not visible');
  const x = bounds.x + ((125 + center.x * 13.5) / 1600) * bounds.width;
  const y = bounds.y + ((820 - center.y * 13.5) / 900) * bounds.height;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + (13.5 / 900) * bounds.height);
  await page.mouse.up();
  await expectSky(page, [98, 109, 152]);
  await expect(page.getByText('P2 WINS', { exact: true })).toBeVisible();
  await expectSky(page, [98, 109, 152]);
  await page.keyboard.press('Enter');
  await expect(page.locator('.game-frame')).toHaveAttribute(
    'data-match-number',
    '2',
  );
  await expectSky(page, [120, 80, 110]);
  await expect(page.locator('.scoreboard strong')).toHaveText(['0', '1']);
});

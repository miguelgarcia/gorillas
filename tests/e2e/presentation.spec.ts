import { expect, test } from '@playwright/test';

test('shows the exact presentation and opens the repository separately', async ({
  page,
  context,
}) => {
  // Keep this navigation test independent of external network availability.
  await context.route('https://github.com/miguelgarcia/gorillas', (route) =>
    route.fulfill({ body: 'Repository destination' }),
  );
  await page.goto('/?seed=4242');
  const frame = page.locator('.game-frame');
  await expect(frame).toHaveAttribute('data-screen', 'presentation');
  await expect(
    page.getByRole('heading', {
      name: 'Gorillas by Miguel Garcia',
      exact: true,
    }),
  ).toBeVisible();
  const link = page.getByRole('link', {
    name: 'Visit repo (opens in a new tab)',
  });
  await expect(link).toHaveAttribute(
    'href',
    'https://github.com/miguelgarcia/gorillas',
  );
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  const opened = page.waitForEvent('popup');
  await link.click();
  const repository = await opened;
  await expect(repository).toHaveURL(
    'https://github.com/miguelgarcia/gorillas',
  );
  expect(await repository.evaluate(() => window.opener === null)).toBe(true);
  await expect(page).toHaveURL(/\?seed=4242$/);
  await expect(frame).toHaveAttribute('data-screen', 'presentation');
  await repository.close();
});

test('waits for actual assets and never auto-starts or accepts pre-start input', async ({
  page,
}, testInfo) => {
  let finishLoading!: () => void;
  const hold = new Promise<void>((resolve) => {
    finishLoading = resolve;
  });
  await page.route('**/themes/storm/gorillas.png', async (route) => {
    await hold;
    await route.continue();
  });
  await page.goto('/?seed=4242', { waitUntil: 'domcontentloaded' });
  const frame = page.locator('.game-frame');
  const start = page.getByRole('button', { name: 'Start', exact: true });
  await expect(page.getByText('BUILDING CITY')).toBeVisible();
  await expect(start).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath('loading.png') });
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect(frame).toHaveAttribute('data-screen', 'loading');
  await expect(page.getByText('RESET SCORES?')).toBeHidden();
  finishLoading();
  await expect(start).toBeEnabled();
  await expect(frame).toHaveAttribute('data-screen', 'presentation');
  await expect(page.locator('.scoreboard')).toBeHidden();
  await expect(page.locator('.control-hint')).toBeHidden();
  await expect(page.locator('canvas')).toHaveAttribute('tabindex', '-1');
  const preview = await page
    .locator('canvas')
    .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  await page
    .locator('.presentation-overlay')
    .click({ position: { x: 12, y: 12 } });
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  // Synthetic events also exercise the handler guards behind the overlay.
  for (const event of ['pointerdown', 'pointermove', 'pointerup']) {
    await page
      .locator('canvas')
      .dispatchEvent(event, { clientX: 300, clientY: 300, pointerId: 1 });
  }
  await expect(frame).toHaveAttribute('data-screen', 'presentation');
  await expect(frame).toHaveAttribute('data-phase', 'aiming');
  await expect(page.getByText('RESET SCORES?')).toBeHidden();
  expect(
    await page
      .locator('canvas')
      .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL()),
  ).toBe(preview);
  await start.click();
  await expect(frame).toHaveAttribute('data-screen', 'playing');
  await expect(frame).toHaveAttribute('data-active-player', '1');
  await expect(frame).toHaveAttribute('data-match-number', '1');
  await expect(frame).toHaveAttribute('data-phase', 'aiming');
  await expect(page.locator('.scoreboard strong')).toHaveText(['0', '0']);
  await expect(page.locator('canvas')).toBeFocused();
});

for (const asset of ['theme.json', 'gorillas.png']) {
  test(`keeps the banner and repository accessible when ${asset} fails`, async ({
    page,
  }, testInfo) => {
    await page.route(`**/themes/storm/${asset}`, (route) => route.abort());
    await page.goto('/');
    await expect(page.locator('.game-frame')).toHaveAttribute(
      'data-screen',
      'load-error',
    );
    await expect(page.getByRole('alert')).toContainText(
      'THE CITY COULD NOT LOAD',
    );
    await expect(page.getByRole('alert')).toContainText(
      'Refresh the page to try again.',
    );
    await expect(
      page.getByRole('heading', { name: 'Gorillas by Miguel Garcia' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /Visit repo/ })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Start', exact: true }),
    ).toBeDisabled();
    await page.screenshot({ path: testInfo.outputPath('load-error.png') });
    await page.keyboard.press('Enter');
    await expect(page.locator('.game-frame')).toHaveAttribute(
      'data-screen',
      'load-error',
    );
  });
}

for (const key of ['Enter', 'Space']) {
  test(`starts only from the focused button with ${key} and returns on reload`, async ({
    page,
  }) => {
    await page.goto('/?seed=4242');
    const start = page.getByRole('button', { name: 'Start', exact: true });
    await expect(start).toBeEnabled();
    await page.keyboard.press('Tab');
    await expect(page.locator('.sound-toggle')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: /Visit repo/ })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(start).toBeFocused();
    await page.keyboard.press(key);
    await page.keyboard.press(key);
    await expect(page.locator('.game-frame')).toHaveAttribute(
      'data-screen',
      'playing',
    );
    await expect(page.locator('.game-frame')).toHaveAttribute(
      'data-phase',
      'aiming',
    );
    await expect(page.locator('.game-frame')).toHaveAttribute(
      'data-match-number',
      '1',
    );
    await expect(page.locator('canvas')).toBeFocused();
    await expect(start).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(page.getByText('RESET SCORES?')).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.getByText('RESET SCORES?')).toBeHidden();
    await expect(page.locator('.game-frame')).toHaveAttribute(
      'data-screen',
      'playing',
    );
    await page.reload();
    await expect(page.locator('.game-frame')).toHaveAttribute(
      'data-screen',
      'presentation',
    );
  });
}

test('enables music while staying on the presentation, then continues it into play', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const OriginalAudioContext = window.AudioContext;
    const audioContexts: AudioContext[] = [];
    Object.assign(window, { testAudioContexts: audioContexts });
    window.AudioContext = class extends OriginalAudioContext {
      constructor() {
        super();
        audioContexts.push(this);
      }
    };
  });
  await page.goto('/');
  await expect(page.locator('.game-frame')).toHaveAttribute(
    'data-screen',
    'presentation',
  );
  if (
    await page.getByRole('button', { name: 'Turn on game audio' }).isVisible()
  ) {
    await page.getByRole('button', { name: 'Turn on game audio' }).click();
  }
  await expect(page.locator('.sound-toggle')).toHaveAttribute(
    'data-audio-state',
    'playing',
  );
  await expect(page.locator('.game-frame')).toHaveAttribute(
    'data-screen',
    'presentation',
  );
  const before = await page.evaluate(
    () =>
      (window as typeof window & { testAudioContexts: AudioContext[] })
        .testAudioContexts.length,
  );
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.locator('.sound-toggle')).toHaveAttribute(
    'data-audio-state',
    'playing',
  );
  const after = await page.evaluate(
    () =>
      (window as typeof window & { testAudioContexts: AudioContext[] })
        .testAudioContexts.length,
  );
  expect(after).toBe(before);
  expect(after).toBeGreaterThan(0);
});

test('allows starting with unavailable audio and blocked browser storage', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'AudioContext', { value: undefined });
    Object.defineProperty(window, 'webkitAudioContext', { value: undefined });
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('Storage unavailable');
      },
    });
  });
  await page.goto('/');
  await expect(page.locator('.sound-toggle')).toHaveAttribute(
    'data-audio-state',
    'unavailable',
  );
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.locator('.game-frame')).toHaveAttribute(
    'data-screen',
    'playing',
  );
  expect(errors).toEqual([]);
});

test('never waits for a blocked audio resume before starting', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const parameter = () => ({
      value: 0,
      cancelScheduledValues() {},
      setValueAtTime() {},
      linearRampToValueAtTime() {},
    });
    const node = () => ({ gain: parameter(), connect() {} });
    Object.defineProperty(window, 'AudioContext', {
      value: class {
        state = 'suspended';
        currentTime = 0;
        destination = {};
        createGain = node;
        createDynamicsCompressor() {
          return {
            threshold: parameter(),
            knee: parameter(),
            ratio: parameter(),
            attack: parameter(),
            release: parameter(),
            connect() {},
          };
        }
        resume() {
          return new Promise<void>(() => {});
        }
        async close() {}
      },
    });
  });
  await page.goto('/');
  await expect(page.locator('.sound-toggle')).toHaveAttribute(
    'data-audio-state',
    'waiting',
  );
  await page.getByRole('button', { name: 'Turn on game audio' }).click();
  await expect(page.locator('.game-frame')).toHaveAttribute(
    'data-screen',
    'presentation',
  );
  await expect(page.locator('.sound-toggle')).toHaveAttribute(
    'data-audio-state',
    'waiting',
  );
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.locator('.game-frame')).toHaveAttribute(
    'data-screen',
    'playing',
  );
  expect(errors).toEqual([]);
});

for (const viewport of [
  { width: 760, height: 600 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
]) {
  test(`keeps the presentation inside the frame at ${viewport.width} × ${viewport.height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(
      page.getByRole('button', { name: 'Start', exact: true }),
    ).toBeEnabled();
    const frame = await page.locator('.game-frame').boundingBox();
    await page.screenshot({ path: testInfo.outputPath('presentation.png') });
    for (const selector of [
      '.presentation-banner',
      '.presentation-banner h1',
      '.repo-link',
      '.start-button',
      '.sound-toggle',
    ]) {
      const bounds = await page.locator(selector).boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(frame!.x);
      expect(bounds!.y).toBeGreaterThanOrEqual(frame!.y);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
        frame!.x + frame!.width,
      );
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(
        frame!.y + frame!.height,
      );
    }
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= window.innerWidth &&
          document.documentElement.scrollHeight <= window.innerHeight,
      ),
    ).toBe(true);
  });
}

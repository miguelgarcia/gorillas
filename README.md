# Gorillas

A browser-based take on the classic Gorillas artillery game: throw bananas across a windy skyline, blast holes in buildings, and land a direct hit to win. Play with a friend on the same computer or challenge the computer opponent.

**[Play Gorillas on GitHub Pages](https://miguelgarcia.github.io/gorillas/)**

## How to play

1. Choose local two-player play or a computer opponent, then start the game.
2. Click near your gorilla, drag back to aim and set the throw strength, and release. The banana flies opposite the drag direction.
3. Watch the rooftop flag and clouds to judge the wind. A direct hit on a gorilla ends the match; hitting a building destroys part of it.
4. After a win, click or press **Enter** for a rematch on a new skyline. Scores carry over between matches.

Press **Escape** during play to open the score-reset confirmation. Use the sound control to toggle audio.

## Run locally

Requires Node.js **22.13.0 or newer** and npm.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000).

## Development

Built with React, TypeScript, vinext/Vite, and a canvas game renderer.

```sh
npm run typecheck  # Check TypeScript
npm run lint       # Lint source and tests
npm test           # Run unit tests
npm run test:e2e   # Run Playwright browser tests
npm run build     # Build the application
```

Before running browser tests for the first time, install Playwright's browser dependencies with `npx playwright install`.

- `app/` — page, game controls, and styles.
- `lib/game/` — physics, computer opponent, rendering, audio, and themes.
- `public/themes/` — visual theme assets and configuration.
- `tests/e2e/` — browser tests.
- `docs/` — product and technical design notes.

## Deployment

The [GitHub Pages workflow](.github/workflows/deploy-pages.yml) runs on pushes to `main` and can also be started manually. It installs dependencies, checks types, runs unit tests, builds the static site, and deploys `dist/client` to GitHub Pages.

## Design notes

- [Game brief](docs/game-brief.md)
- [Product specification](docs/v1-product-spec.md)
- [Technical design](docs/technical-design.md)
- [Single-player design](docs/single-player-design.md)

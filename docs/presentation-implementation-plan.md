# Opening Presentation — Implementation Plan

Status: implemented and verified locally on 2026-09-04

## Goal and scope

Implement the opening experience in the [product specification](v1-product-spec.md#loading-and-presentation) using the [technical design](technical-design.md#page-entry-lifecycle).

The banner contains `Gorillas by Miguel Garcia` on its first line, `Visit repo` on its second line, and a `Start` button beneath. The repository destination is [miguelgarcia/gorillas on GitHub](https://github.com/miguelgarcia/gorillas), confirmed from the project's `origin` remote.

Approved implementation decisions:

- Reuse the current city as the backdrop and the existing looping music, which continues into gameplay.
- Show real asset loading, with no artificial delay and no automatic start.
- Show the presentation on each page load, not on rematches or score resets.
- Offer a way to enable music while staying on the presentation if the browser blocks autoplay. Start still works with sound muted, blocked, or unavailable.
- Preserve game rules, theme assets, deployment configuration, and the deterministic seeded first match. No new packages, artwork, music files, or deployment are needed for this feature.

## Step 1 — Update the contract

- [x] Replace the immediate-start requirement in the game brief and product specification.
- [x] Define exact banner content, repository navigation, loading/error behavior, explicit Start, audio policy, and accessibility.
- [x] Add acceptance criteria and document the page lifecycle separately from core match phases.
- [x] Record the ordered implementation and verification work below.

The user approved this specification and plan before application code changes began.

## Step 2 — Add the entry lifecycle and banner

Primary files: `app/gorillas-game.tsx`, `app/globals.css`, `lib/game/render.ts`.

- [x] Introduce explicit loading, presentation, playing, and load-error page states without changing `GameState` or match phases.
- [x] Retain a single prepared match while the theme loads; render it as a non-interactive preview without an aiming ring or aiming pose. Keep simulation paused; any preview animation uses a render-only clock.
- [x] Build the themed DOM banner with the exact two lines, safe external-link attributes, native Start button, loading feedback, and retained error shell.
- [x] Hide scoreboard and gameplay hints until play. Keep the sound control reachable and avoid z-index overlap between controls and banner.
- [x] Gate every gameplay input path, including Escape, rematches, reset actions, and WebMCP throws, on the current page state. Report page state in the read-only tool.
- [x] Add guarded Start activation, input cleanup, accumulator reset, and canvas focus. Preserve seed, world, wind, match number, P1 starter, and zero scores.
- [x] Ensure readable layout and visible keyboard focus across the existing desktop frame, with no forced new animation.

## Step 3 — Integrate presentation music

Primary files: `lib/game/audio.ts`, `app/gorillas-game.tsx`.

- [x] Honor the saved preference before any autoplay attempt, including muted reloads.
- [x] Expose actual playback readiness so the UI can distinguish awaiting interaction from playing or muted audio.
- [x] Offer music activation without leaving the presentation; Start also requests unlock when sound is enabled, without awaiting it.
- [x] Reuse the existing music context/scheduler continuously across Start. Make repeated unlocks safe and handle unavailable/failed audio without affecting entry to the game.
- [x] Verify effect teardown and late resume promises cannot leak or restart music after cleanup.

## Step 4 — Add regression coverage

Primary files: `tests/e2e/game.spec.ts`, `lib/game/render.test.ts`, new `lib/game/audio.test.ts` where appropriate.

- [x] Update existing gameplay tests to explicitly activate Start before aiming, resetting, or throwing through WebMCP.
- [x] Hold the theme request to verify loading feedback, disabled Start, no premature gameplay, and transition to presentation without auto-starting. Test asset failure and refresh guidance separately.
- [x] Assert exact banner copy and repository URL, new-tab behavior, and unchanged original page state after visiting the link.
- [x] Verify background clicks, unrelated keys, sound controls, and programmatic throws cannot enter or mutate a match before Start.
- [x] Verify mouse and focused-button keyboard Start, repeated activation, focus transfer, preserved seeded state, and no accidental throw from the activation event.
- [x] Verify preview rendering suppresses gameplay affordances and leaves the prepared match unchanged.
- [x] Cover autoplay permitted/blocked, enabling music before Start, saved mute across reloads, unsupported audio, and no duplicate music scheduler after repeated gestures or Start.
- [x] Verify normal aiming and turn changes after entry, plus victory/rematch and score-reset behavior without returning to the presentation. Reload should return to presentation.

## Step 5 — Verify and hand off

- [x] Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run test:e2e`.
- [x] Exercise entry and audio behavior in Chromium, Firefox, and WebKit where available; report unavailable browser coverage explicitly. The current Playwright configuration has no cross-browser projects, so use focused browser invocations or add projects as part of verification if needed.
- [x] Run `npm run build` and confirm the existing GitHub Pages base-path asset handling remains intact.
- [x] Inspect loading, ready, error, and gameplay screens in-browser at representative desktop sizes, including keyboard navigation and reduced motion. Listen to the music transition if audio verification is available; automated scheduler checks alone do not verify audible output.
- [x] Review the diff for scope and update this checklist with actual results and any limitations.
- [x] Hand off the implementation for review. Commit, push, and deployment are separate actions, not part of this plan.

## Verification results

- `npm run typecheck`, `npm run lint`, and `git diff --check`: passed.
- `npm test`: 27 tests passed, including preview-rendering immutability and audio lifecycle coverage.
- `npm run test:e2e`: 17 Chromium tests passed, including genuine delayed sprite loading, manifest/sprite failures, repository popup isolation, pre-start input guards, keyboard entry, mute persistence, audio continuity, victory/rematch, and score reset.
- Standard production build and GitHub Pages-mode production build: passed. Exported HTML uses the existing `/gorillas` asset prefix, and theme assets remain in the static output.
- Inspected loading and error screenshots, the ready presentation at 760 × 600, 1440 × 900, and 1920 × 1080, and the live transition into gameplay. Keyboard focus and reduced-motion layout checks passed.
- The preview is intentionally static: neither match time nor game rules advance before Start. No new animation, artwork, music assets, or packages were introduced.
- Limitations: Firefox and WebKit are not installed, so they were not exercised. Audio context state and scheduling were verified, but physical speaker output/listening was not available.
- No commit, push, or deployment was performed. Existing hosting configuration was preserved.

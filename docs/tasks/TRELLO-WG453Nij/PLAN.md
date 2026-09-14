# TRELLO-WG453Nij — Implementation plan

Status: Proposed; awaiting approval of the companion [specification](SPEC.md).

Task: [Trello card](https://trello.com/c/WG453Nij/1-add-random-ambient-light-to-each-match)

## Approval and current state

This revision contains planning documents only, based on `main` at `1e78231f4b52b4dfd03748d7b4e0ff24026f5c6e`. No application code, tests, configuration, dependencies, or assets have changed, and no application checks have been run during planning.

Publish these documents on `agent-TRELLO-WG453Nij` in one draft PR against `main`. The PR description must contain the full planning commit SHA and the actual authenticated bot mention. End the planning turn after publication.

On resumption, re-read the task instructions, verify the live Ready assignment and repository label, and read the PR, source comments, and subsequent human feedback. Before implementation, verify a new, explicit top-level approval comment from a human other than the bot with write, maintain, or admin permission, naming this revision's full SHA. Verify permission and that the commit contains the latest versions of both documents on this branch. Record the approval URL and SHA in the PR description. Resolve the specification's proposed choices with the reviewer; changed planning documents require a new approval comment. Do not implement merely because the session resumed.

## Implementation steps after approval

### 1. Define theme-owned lighting data and deterministic selection

Expected files: `lib/game/theme.ts`, new `lib/game/lighting.ts`, `public/themes/storm/theme.json`.

- Define a typed optional preset list, with stable unique IDs and environmental palette overrides. Limit overrides to skyTop, skyBottom, cloudFar, cloudNear, distantCity, buildingOutline, facades, windowDark, windowLit, ground, groundEdge, and craterRim.
- Keep the existing base palette, sprites, and sprite-sheet loading intact. Represent overcast with no overrides; provide coherent overrides for dawn, sunset, and moonlit blue. Keep facade arrays compatible with the existing facade indexing.
- Validate only the new optional structure: list shape, unique nonempty IDs, allowed keys, six-digit hexadecimal color values compatible with renderer helpers, and nonempty valid facade arrays when supplied. Missing/empty data means base palette; malformed lighting configuration is ignored as a whole and falls back to base without weakening existing required-theme checks.
- Add a pure resolver using `createRandom` with a fixed lighting-specific seed salt and the existing match seed to select a preset uniformly by index. Merge only allowed environmental fields without mutating theme data. Use the current theme unchanged for the fallback. Do not modify `core.ts` or use time/global randomness.

### 2. Integrate the resolved palette and terrain cache

Expected file: `lib/game/render.ts`.

- Resolve and memoize the effective theme inside `GameRenderer` by input theme object and match seed. Reuse the result across frames and phases; a new theme object must refresh it even if the theme ID is unchanged.
- Use that effective theme consistently for sky, distant city, terrain, ground, and crater rendering. Preserve all non-environmental colors and sprite assets. Existing drawing helpers can receive the same effective theme because their protected fields remain unchanged.
- Couple terrain-cache invalidation to effective theme identity as well as existing seed/crater inputs. New presets/themes and rematches must not reuse terrain with old colors; ordinary animation frames must reuse it.
- Keep destruction compositing and layer ordering unchanged. Do not introduce full-canvas tint overlays or redraw terrain on every animation frame.
- The current React draw path already passes the prepared match, so no application lifecycle or core state changes are expected.

### 3. Add focused regression coverage

Expected files: new `lib/game/lighting.test.ts`, new `lib/game/theme.test.ts`, updates to `lib/game/render.test.ts`, and new `tests/e2e/lighting.spec.ts`. Reuse existing presentation/game browser helpers or patterns where practical without unrelated restructuring.

- Unit-test repeatability, fixed-sample preset coverage, theme immutability, protection of gameplay/UI palette fields, and base-palette fallback. Assert lifecycle stability using states produced by existing core functions and deterministic rematch sequences, including score reset and both game modes.
- Exercise optional manifest validation through `loadTheme` with mocked fetch and sprite-free fixtures: missing/empty list, invalid colors/IDs/facades, and valid data. Preserve tests of required manifest behavior where touched.
- Extend renderer coverage to verify that sky and cached buildings receive matching effective palettes, rendering preserves game state, frames reuse terrain, and rematches/craters/replacement theme objects invalidate the appropriate cache.
- Browser-test representative seeds that select different presets, seeded reload consistency, presentation-to-Start stability, and rematch/reset behavior. Inspect a stable sky pixel/region against expected palette values with tolerances, away from drifting clouds; avoid whole-canvas equality as animations and aiming overlays change. Exercise actual draws so tests do not merely mirror the resolver.
- Do not add player-facing diagnostics or public controls just for tests. Use existing seed URLs, interaction flows, canvas, and match attributes.

### 4. Validate and prepare human review

- Use the README-required Node.js version (22.13.0 or newer), then `npm ci`. Install Playwright browsers non-interactively if missing, without changing tracked dependencies.
- Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e`, and `npm run build`.
- The current Playwright configuration uses its default browser rather than a multi-project matrix. Run the configured suite and, where installed/supported, additional Firefox and WebKit runs via CLI browser selection; report exact browser coverage and any unavailable-browser blocker. Do not edit configuration to expand this task.
- Inspect screenshots for each mood at 1600×900 and 1280×720, including a destroyed building, aiming indicators, and score-reset overlay. Confirm readable silhouettes, flag motion/direction, projectile/effects, and consistent sky/terrain lighting. Retain review artifacts outside committed source and describe findings in the PR.
- Review the complete diff for approved scope and accidental generated files. Commit/push implementation to the same branch, preserving the planning documents unchanged and the approval reference. If the design must change, stop and return to planning approval first.
- Update the same PR with changes, commands/results, visual evidence, and blockers. Mark ready for review only when implementation and validation are ready. The current deployment workflow runs on `main` pushes/manual dispatch, so no PR CI run is assumed; do not dispatch deployment or modify CI. Leave pending CI and final review to subsequent scheduled activity and humans. Never merge.

## Risks and mitigations

- **Ambiguous art direction:** obtain approval of the proposed moods and repeat policy before code; palette tuning stays within those approved moods.
- **Dark or warm lighting obscures gameplay:** use bounded curated palettes, preserve gameplay accents/character art, and visually inspect every mood.
- **Randomness changes existing games:** derive presentation selection in isolation from the immutable seed; leave gameplay generation untouched and run its regression suite.
- **Mixed or stale terrain colors:** test cache behavior with rematches, damage, and new theme objects sharing an ID.
- **Theme compatibility:** optional data, strict validation for new fields, immutable merging, and base fallback avoid a mandatory theme migration.
- **Test flakiness:** select fixed seeds and stable canvas regions; allow repeats and avoid animation-dependent screenshot equality.

## Migration and rollback

No database, saved-state, dependency, or asset migration is needed. Existing manifests remain valid without lighting presets. Removing the optional preset list restores the base look; reverting the implementation commits restores the prior rendering path. Keep the planning documents and approval history. Any rollback follows normal branch/PR review; it does not authorize a direct default-branch push or deployment.

# TRELLO-WG453Nij — Random ambient lighting per match

Status: Proposed; awaiting human plan approval. No implementation is authorized.

Task: [Add random ambient / light to each match](https://trello.com/c/WG453Nij/1-add-random-ambient-light-to-each-match)

## Problem and repository findings

The card requests random ambient/light for each match, but supplies no further description. The current game loads the single `Windy Overcast` palette from `public/themes/storm/theme.json`. Skylines and wind vary by match seed, while environmental colors remain the same.

Inspection baseline: `1e78231f4b52b4dfd03748d7b4e0ff24026f5c6e` on `main` in `miguelgarcia/gorillas`. The live, unarchived card was verified in the unarchived Ready list with the single repository label `repo:miguelgarcia/gorillas`. No repository AGENTS.md or separate contribution instructions were present; README.md and the existing product/technical design documents supply development guidance.

`core.ts` already gives each match a deterministic seed. `GameRenderer` receives that seed and the loaded theme on every frame; its terrain cache currently keys on match seed, crater count, and theme ID. The presentation shows the prepared initial match, Start preserves it, rematch creates a new match, and score reset preserves the current match.

## Intended behavior

1. Select one environmental lighting preset deterministically from the match seed and the configured theme's preset list. Use a separate visual PRNG stream so selection cannot consume or change gameplay randomness.
2. Propose four equally likely, curated moods for the bundled theme: existing overcast, soft dawn, warm sunset, and readable moonlit blue. Overcast retains the existing environmental palette. Color values may be tuned within these moods during implementation to preserve readability.
3. Keep the selection fixed through presentation, Start, aiming, flight, impacts, turn changes, victory, score-reset confirmation/cancellation, and score reset. Existing cloud/flag animation continues normally; lighting itself does not animate.
4. Resolve the new match seed on every rematch or newly prepared session. Independent random selection permits consecutive repeats; it does not guarantee a different mood each time. The same seed and same theme data reproduce the same lighting, including through the existing `?seed=` entry point.
5. Apply a coherent palette to sky, clouds, background city, building facades/outlines/windows, ground, and crater edges. Keep character art, player colors, flag cloth, banana, explosions, aiming indicators, text, and DOM overlays at their existing colors so gameplay cues stay readable.
6. Keep presets optional and theme-owned. Themes without presets retain their existing appearance and loading behavior. Incomplete or invalid optional lighting data falls back to the base palette without failing an otherwise valid theme load.

## Scope and non-goals

Scope is visual palette variation in the existing Canvas 2D renderer, optional theme data and validation, and focused regression coverage. It applies to local and single-player matches at every difficulty.

Non-goals: ambient audio changes; dynamic day/night cycles; weather effects or altered wind; simulated light sources, shadows, shaders, or new art assets; lighting controls or settings; changes to physics, terrain geometry, hitboxes, AI, scores, input, or match generation; dependency/configuration/CI changes; unrelated theme-loader repairs or rendering refactors.

## Acceptance criteria

- The bundled theme exposes all four proposed moods, with visibly distinct environmental palettes and the existing overcast look represented.
- Selection is deterministic and covers all presets across a fixed representative seed sample; tests do not require adjacent matches to differ or assert a statistical distribution from a small sample.
- One match retains its preset across the lifecycle described above. Rematches use their own seed, and replaying a seeded session reproduces the same preset sequence.
- Rendering does not mutate the input theme or game state, and introduces no new calls into gameplay PRNG streams. Existing deterministic gameplay tests continue to pass.
- Sky and terrain consistently use the selected palette, including after rematches, crater creation, and replacing theme data with the same theme ID. Terrain caching does not retain old lighting or rebuild solely because a frame elapsed.
- Themes with absent, empty, or invalid optional lighting data render using their base palette. Existing required asset failures retain their current error behavior.
- Visual review of every mood confirms visible gorillas, bananas, aiming rings, flag direction, terrain holes, and readable scoreboard/dialogs at desktop sizes, including the darkest mood.
- Typecheck, lint, unit tests, existing and new browser tests, and production build pass, or concrete environmental blockers are documented in the PR before declaring readiness.

## Constraints

Preserve the framework-independent core and theme-driven renderer, crisp pixel art, fixed 16:9 arena, and GitHub Pages asset paths. Reuse existing dependencies and assets. Avoid per-frame preset allocation and preserve terrain caching. Do not add persistence or alter serialized game state for this visual concern.

Only this SPEC.md and PLAN.md may change before approval. Keep the designated branch and a single draft PR, keep the Trello card in Ready, and leave merging and board transitions to humans.

## Open questions for the human reviewer

The title alone does not establish the art direction or repetition policy. This proposal asks the reviewer to confirm:

- Does “ambient / light” mean visual environmental palettes only, with audio unchanged?
- Are overcast, dawn, sunset, and readable moonlit blue the desired initial moods?
- Is independently seeded selection with possible consecutive repeats acceptable?

An explicit approval of this planning revision accepts these proposed answers. If a different interpretation is wanted, resolve it in PR discussion and revise both documents as needed before seeking fresh approval. Implementation must not begin while scope feedback remains unresolved.

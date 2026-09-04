# Gorillas — Concise Technical Design

Status: v1 foundation and opening presentation implemented; verified locally

This design implements the [v1 product specification](v1-product-spec.md) without adding gameplay scope.

## Stack

- **Language/build:** TypeScript in the Sites Vinext/React/Vite shell. React owns only the page lifecycle and semantic DOM overlays; the game core remains framework-independent.
- **Rendering:** browser Canvas 2D for the game world; semantic HTML/CSS overlays for the opening presentation, scoreboard, victory banner, and reset dialog.
- **Input:** Pointer Events for aiming and standard keyboard events for Enter/Escape.
- **Testing:** Vitest for deterministic game logic and Playwright for browser-level flows across Chromium, Firefox, and WebKit.
- **Deliberate omissions:** no game engine, general physics engine, backend, database, or WebGL in v1. The scaffold's existing React and shadcn primitives are used only at the UI boundary.

Canvas 2D is sufficient for one fixed 2D arena and provides the pixel compositing needed for destructible terrain. Custom ballistic motion is smaller and more predictable than introducing a general physics engine.

## Runtime boundaries

```text
Input -> commands -> pure game core -> events/state -> renderer + DOM UI
```

- `core`: rules, state machine, ballistics, collisions, seeded generation, scores; no DOM or Canvas dependencies.
- `render`: reads state and draws the current theme; it cannot change game state.
- `input`: converts pointer/keyboard activity into core commands.
- `theme`: loads and validates replaceable theme manifests and assets.
- `ui`: accessible DOM overlays for loading/presentation, score, victory, and reset confirmation; owns the page-entry lifecycle independently of the match.
- `audio`: the existing Web Audio music/effects engine; owns one audio context and music scheduler, honors the saved sound preference, and reports whether playback is enabled, running, or waiting for interaction.

This separation keeps gameplay testable and makes future remote multiplayer possible without building networking now.

## State model

- `SessionState`: P1/P2 scores and the next starting player.
- `MatchState`: seed, wind, buildings/terrain, gorillas, active player, projectile, and current phase.
- Phases: `aiming -> projectile-flight -> impact -> turn-transition`, or `victory`; `reset-confirmation` is a modal overlay that suspends and later resumes the unchanged underlying phase.
- Commands and state transitions are serializable and deterministic for a given seed and input sequence.

## Page-entry lifecycle

- Keep `loading -> presentation -> playing` and the `loading -> load-error` branch at the React/UI boundary. These are page states, not additional core match phases.
- Generate the initial seeded match once and load its theme and sprite assets. Enter `presentation` only after the assets are ready and the arena can be drawn; a failed required asset enters `load-error`.
- Mount the title, repository link, Start button, and sound control during loading so the page has an immediate presentation. Start is disabled until `presentation`; successful loading alone never enters `playing`.
- Use a semantic heading with `Gorillas by Miguel Garcia`, a separate second-line anchor with `Visit repo`, and a native `Start` button. The anchor targets `https://github.com/miguelgarcia/gorillas` with `target="_blank"` and `rel="noopener noreferrer"`.
- Keep the existing theme-based palette and fixed 16:9 framing. Render the prepared city behind the banner without the aiming ring or active aiming pose, and hide gameplay-only DOM overlays until `playing`.
- The preview is static and does not advance the game simulation. If clouds/flags are animated before Start in the future, supply a presentation-only render clock so match time, seed, wind, scores, and starting player remain unchanged. Respect reduced-motion preferences for any new presentation motion.
- Gate pointer handlers, keyboard shortcuts, rematch/reset entry points, and the registered `throw_banana` tool with the same current page-state check. Exclude the canvas from tab navigation until play begins. `read_match_state` may remain available, but reports the page state alongside the prepared match phase so it does not imply the match is playable.
- A guarded Start handler transitions only from `presentation`, clears stale pointer/aim state and the simulation accumulator, requests audio unlock without awaiting permission, and focuses the canvas. Keep the existing prepared match instead of regenerating it or advancing the starter.
- Activation uses native button semantics; do not turn arbitrary clicks or a global Enter handler into Start. Repeated activation is harmless and its initiating event cannot become gameplay input.
- On load failure, retain the presentation shell and repository link, show the existing refresh guidance as an accessible alert, and keep Start disabled. Rematches and score reset never change the page state back from `playing`.
- Expose page state separately from the existing match `data-phase`, for example through `data-screen`, for browser tests and diagnostics.

### Audio startup

- Reuse one `GameAudio` instance across loading, presentation, and gameplay; do not create a second intro player or restart music on Start.
- Read `gorillas:sound` before requesting playback. If enabled, attempt playback and respond to the actual audio-context state. A suspended context is a pending unlock, not confirmed playback.
- Provide an accessible enable-music action while playback is awaiting interaction, then the usual mute/unmute control. It remains separate from Start and honors the same persisted preference.
- Request unlock synchronously from appropriate user gestures (including Start), and handle unavailable Web Audio, rejected resume calls, or a still-suspended context without blocking gameplay or producing unhandled rejections.
- Keep scheduling idempotent across autoplay attempts, repeated gestures, and the Start transition. Audio initialization/resume and teardown must tolerate React effect cleanup; late promises must not restart a destroyed player.
- Browser policy may require a user gesture even when sound is enabled; the UI must accommodate that restriction rather than promise audible music on every page load. See [MDN's autoplay guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay).

## Time, physics, and collision

- Render with `requestAnimationFrame`; advance simulation using a fixed timestep and an accumulator so frame rate does not alter outcomes.
- Store positions and dimensions in world meters, converting to display pixels only in the renderer/input adapter.
- Convert drag direction into the opposite launch vector; clamp its magnitude to the configured maximum.
- Apply constant downward gravity and the match's constant horizontal wind during flight.
- Sweep the projectile along each simulated movement segment and resolve the earliest gorilla, terrain, or world-boundary contact to prevent tunneling.
- Direct gorilla contact wins. Terrain contact creates a fixed-radius crater. Boundary exit passes the turn.

## Destructible terrain

- Generate initial buildings as world-space rectangles plus semantic facade data.
- Maintain a separate world-space occupancy mask at fixed simulation resolution; it is independent of canvas size and theme artwork.
- A crater clears every occupied mask cell inside its circle.
- Collision queries read the mask, so later projectiles pass through holes.
- Rendering clips themed building artwork through the same destruction mask, revealing the already-rendered background.
- A terrain-clipped dark rim and deterministic debris marks remain around each cutout so sky-visible holes read as destroyed structure rather than colored overlays.
- Gorillas remain anchored to their initial rooftop positions; terrain destruction does not create structural physics.

## Generation

- Use a small seeded PRNG owned by the core.
- Generate the low-frequency skyline envelope, constrained 100-meter width partition, snapped heights, semantic facade variants, and valid gorilla pair from the same match seed.
- Validate all hard product constraints before accepting a skyline; deterministically retry with the next PRNG values if generation fails.
- Allow a seed to be injected by tests and development tooling through the `?seed=` query parameter, but expose no seed controls in the player UI.

## Display and themes

- Use a 16:9 logical viewport and scale it with `contain`; letterbox other desktop aspect ratios rather than revealing or cropping gameplay space.
- Scale the backing canvas for device-pixel ratio while retaining world-space simulation coordinates.
- Layer order: sky, clouds, background city, destructible buildings, rooftop details, gorillas/projectile/effects, aiming ring, DOM overlays.
- Each theme manifest maps semantic asset roles and animation states to files, anchors, palettes, and timing data.
- Character art is loaded from a theme-owned sprite sheet with distinct idle, aim, throw, victory, and hit frames for each player; the ASCII sprite remains only as a load-safe fallback.
- Hitboxes and gameplay dimensions belong to the core, never to theme sprites.
- Switching the configured theme manifest requires no gameplay-code changes.

## Verification

- **Core tests:** ballistics, strength cap, direct/self hits, blast immunity, turn transitions, score/reset/rematch behavior, and deterministic replay.
- **Generator tests:** run many seeds and assert building counts/dimensions, exact 100-meter fill, rooftop clearance, and 40-meter gorilla separation.
- **Terrain tests:** crater shape, adjacent-building removal, empty-hole collision, and suspended fragments.
- **Audio tests:** autoplay blocked/allowed, saved mute, unavailable audio, repeated unlocks without duplicate music scheduling, and cleanup during pending initialization.
- **Browser tests:** loading/presentation/error states, exact title and repository-link behavior, Start readiness and keyboard activation, pre-start command blocking (including WebMCP), music activation without starting, mute persistence, mouse drag/release, active ring transfer, victory/rematch, Enter/Escape behavior, fixed framing, and theme loading.
- **Visual checks:** stable seeded concept references for the aiming states and windy-overcast default theme; screenshot regression can be added after the art direction stabilizes.
- Required checks before release: typecheck, unit tests, browser tests, and production build.

## Deferred until playtesting

Numeric gravity, wind range, maximum launch speed, crater radius, simulation timestep, mask resolution, aiming-ring geometry/opacity curve, and animation timings remain configuration values to tune empirically.

## Official references

- [Vite guide](https://vite.dev/guide/)
- [Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)
- [Vitest guide](https://vitest.dev/guide/)
- [Playwright browser testing](https://playwright.dev/docs/browsers)
- [Web Audio autoplay behavior](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay)

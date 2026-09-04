# Gorillas — Version 1 Product Specification

Status: product-definition draft

This is the concise version 1 contract. The [game brief](game-brief.md) contains the supporting decisions and concept references. Technology and architecture are intentionally out of scope.

## Product goal

Deliver a faithful, compact desktop-browser modernization of *Gorillas*: two local players take turns launching bananas across a destructible skyline using a mouse-driven slingshot gesture. A single direct hit wins the match.

## Required experience

- The page opens with a loading/presentation banner; an explicit `Start` action enters P1 versus P2 with no configuration screen.
- The complete arena is always visible; the camera never pans or scrolls.
- Only the active gorilla has an aiming ring, which also identifies the current turn.
- Dragging away from the active gorilla sets strength; releasing launches in the opposite direction.
- The ring is two concentric circles. The full annular band becomes more opaque as strength increases, while its center remains transparent.
- A radial line and arrowhead on the outer circle show launch direction. No predicted trajectory or exact physics values are shown.

## Loading and presentation

- Superimpose a centered banner over the city arena, revealing the skyline behind it when assets are ready.
- First line: exactly `Gorillas by Miguel Garcia`.
- Second line: `Visit repo`, linking to [github.com/miguelgarcia/gorillas](https://github.com/miguelgarcia/gorillas) in a new tab while preserving the original game page.
- Below the link: a `Start` button, disabled during loading and enabled once the arena is ready. Provide visible loading feedback without a fake progress percentage or minimum wait.
- Stay on the presentation until Start is explicitly activated. Clicking the backdrop, visiting the repository, enabling music, or finishing loading does not start the game.
- Until Start, hide the aiming ring, scoreboard, and gameplay hints, and block gameplay commands and score-reset shortcuts.
- Start reveals the prepared first match with P1 active and a zero-zero score. Its input cannot also trigger a throw or rematch.
- A failed load displays an error and refresh guidance while retaining the title and repository link; Start remains unavailable.
- The presentation returns on page reload, but not on rematches or score resets.
- Start, Visit repo, and the sound control are keyboard accessible with visible focus. Enter/Space activate the focused Start button; no page-wide start shortcut overrides the repository link or sound control. Move focus to the arena after starting.

### Music and sound

- The existing game music loops during the presentation when sound is enabled and browser policy allows playback, continuing seamlessly into gameplay.
- Honor the saved mute preference and keep a sound control available throughout loading, presentation, and gameplay.
- If autoplay is blocked, clearly offer music activation without starting the game. A pending audio unlock must not be presented as confirmed playback.
- Start requests audio unlock when appropriate, but the match starts even when audio remains blocked or is unsupported.
- This feature adds no new music assets or changes to the existing shot, explosion, and victory sounds.

## Match rules

- Gravity is fixed. Wind is randomized before each match and remains constant during that match.
- A rooftop flag and moving clouds communicate wind direction and approximate strength without numbers.
- A banana defeats a gorilla only through direct projectile contact; blast proximity cannot cause a win.
- A direct self-hit defeats the thrower.
- First building contact causes an immediate explosion with one constant terrain-blast radius.
- The blast removes visible terrain and its collision. Later bananas pass through created holes.
- Buildings never collapse, and unsupported fragments may remain suspended.
- A building impact or a projectile leaving the arena counts as a miss and passes the turn.

## World generation

- The arena is 100 meters wide and contains 10–14 buildings totaling exactly that width.
- Buildings are 5–14 meters wide and 12–36 meters tall; heights use 3-meter floor increments.
- A seeded, constrained skyline envelope creates coherent height variation.
- Gorilla rooftops are selected randomly from all valid pairs, without side or height preference.
- Each gorilla has 1 meter of rooftop-edge clearance and at least 40 meters of horizontal separation from the other.

## Session flow

- P1 starts the first match; the starting player alternates on every rematch regardless of the winner.
- The top-center scoreboard displays `P1  0 — 0  P2` and accumulates wins across rematches.
- On victory, the defeated gorilla explodes, the winner dances, and a centered `P1 WINS` or `P2 WINS` banner appears.
- A fresh click anywhere or Enter starts a rematch with a new skyline and wind value.
- Escape opens score-reset confirmation. Enter resets both scores; Escape cancels. The current match is otherwise unchanged.

## Visual direction

- The initial theme is crisp modern pixel art with a windy, overcast afternoon palette.
- Layered blue-gray clouds, muted buildings, selective bright accents, and clear silhouettes define the mood.
- Gameplay and procedural-generation rules remain independent of art assets.
- A conforming theme can replace all visuals and animation through assets and theme data without game-code changes.

## Explicit non-goals

- Remote multiplayer, accounts, matchmaking, or lobbies.
- Mobile or touch-first controls.
- Additional weapons, upgrades, progression, or extra game modes.
- Structural building physics.
- Player names, character selection, loadouts, or pre-match settings.

## Version 1 acceptance criteria

Version 1 is complete when:

1. Two players can repeatedly complete hot-seat matches using only a mouse and the documented keyboard controls.
2. Every generated arena satisfies all building, clearance, and 40-meter separation constraints while remaining fully visible.
3. The aiming ring behaves as specified at low, intermediate, capped, and cancelled drag states.
4. Fixed gravity and per-match wind produce consistent ballistic behavior, and the flag and clouds agree with the active wind.
5. Direct opponent hits and direct self-hits choose the correct winner; blast-only overlap never defeats a gorilla.
6. Terrain explosions create circular visible and collidable holes without structural collapse.
7. Building impacts and out-of-bounds shots pass control exactly once to the other player.
8. Victory presentation, score increments, rematches, alternating starters, and score reset all behave as specified.
9. The game remains readable and playable across the agreed desktop viewport range without scrolling.
10. The initial art theme can be replaced by a conforming test theme without changing gameplay code.
11. Every page load shows the exact presentation title, second-line repository link, and Start button. The repository opens separately without starting or navigating away from the game.
12. Delayed asset loading keeps Start disabled; success enables it without auto-starting, and failure shows a usable error state without enabling gameplay.
13. Before Start, pointer, keyboard, and programmatic gameplay commands cannot change the prepared match. Mouse or keyboard activation of Start enters that match exactly once without leaking input into aiming or throwing.
14. Presentation music respects saved mute state and browser restrictions, can be enabled before Start, and continues into play without duplicate loops. Unavailable audio never prevents play.
15. Rematches and score reset preserve their existing behavior without redisplaying the presentation; keyboard focus and fixed-arena layout remain usable in all entry states.

## Deferred tuning

Playtesting will determine numeric gravity, wind range, maximum launch strength, blast radius, aiming-ring dimensions and opacity curve, skyline-envelope parameters, and animation timings. These values do not change the product rules above.

## Implementation tracking

The opening presentation is implemented and verified locally. See the [presentation implementation plan](presentation-implementation-plan.md) for completed work, verification results, and remaining browser/audio verification limitations.

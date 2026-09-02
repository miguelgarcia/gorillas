# Gorillas — Version 1 Product Specification

Status: product-definition draft

This is the concise version 1 contract. The [game brief](game-brief.md) contains the supporting decisions and concept references. Technology and architecture are intentionally out of scope.

## Product goal

Deliver a faithful, compact desktop-browser modernization of *Gorillas*: two local players take turns launching bananas across a destructible skyline using a mouse-driven slingshot gesture. A single direct hit wins the match.

## Required experience

- The game starts immediately as P1 versus P2 with no setup screen.
- The complete arena is always visible; the camera never pans or scrolls.
- Only the active gorilla has an aiming ring, which also identifies the current turn.
- Dragging away from the active gorilla sets strength; releasing launches in the opposite direction.
- The ring is two concentric circles. The full annular band becomes more opaque as strength increases, while its center remains transparent.
- A radial line and arrowhead on the outer circle show launch direction. No predicted trajectory or exact physics values are shown.

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

## Deferred tuning

Playtesting will determine numeric gravity, wind range, maximum launch strength, blast radius, aiming-ring dimensions and opacity curve, skyline-envelope parameters, and animation timings. These values do not change the product rules above.

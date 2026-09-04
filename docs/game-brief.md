# Gorillas — Game Brief

Status: discovery draft

This document records product decisions made during discovery. It deliberately avoids implementation and technical architecture.

## Vision

Create a faithful, compact modernization of the classic *Gorillas* artillery game for desktop web browsers. Preserve the original turn-based duel, ballistic judgment, wind, randomized skyline, and destructible buildings while replacing numeric angle and velocity entry with a tactile mouse-drag interaction inspired by *Angry Birds*.

## Design principles

- Preserve the recognizable core instead of expanding it into a larger weapons or progression game.
- Make aiming tactile and readable without revealing the complete trajectory.
- Let players learn from previous throws rather than exposing exact simulation values.
- Favor simple arcade rules over structural or realistic building physics.

## Version 1 scope

- Desktop web browsers.
- Two players sharing one device in local hot-seat play.
- One banana projectile type.
- One successful hit decides the match.
- A rematch starts on a newly generated skyline.

The following are deferred beyond version 1:

- Remote multiplayer, networking, accounts, matchmaking, and lobbies.
- Mobile and touch-first controls.
- Additional weapons, character upgrades, progression, and extra game modes.

## Core match loop

1. Generate a skyline, place both gorillas, choose a hidden random wind value, and assign the starting player.
2. The active player aims and throws one banana.
3. The banana travels through the scene under the game's ballistic rules.
4. If the banana directly collides with either gorilla, that gorilla is defeated and the match ends.
5. Otherwise, on its first building contact, the banana explodes at the impact point and removes terrain within its blast radius.
6. After a non-winning explosion or after the banana leaves the playable area, the opponent's turn begins.

## Starting player

- The starting player alternates between consecutive matches in the same session.
- The initial session match starts with Player 1 unless this default is revised.
- Starting a rematch swaps the starter even if the same player won the previous match.

## Session setup

- There is no pre-match configuration.
- Players are identified as Player 1 and Player 2.
- Players do not enter names or choose characters, loadouts, rules, or other settings before play.
- Launching the page opens a loading/presentation screen; activating `Start` enters the local two-player session without a configuration step.
- A cumulative scoreboard tracks match wins for P1 and P2 across rematches in the current session.
- The scoreboard is centered along the top edge and uses the compact format `P1  0 — 0  P2`.
- The winning player's score increases once when the victory state begins.
- Starting a rematch preserves both scores.
- Pressing Escape opens a score-reset confirmation overlay.
- While that overlay is open, Enter resets both scores to zero and Escape cancels without changes.
- Resetting scores does not regenerate the skyline, change the active player, or otherwise alter the current match state.

## Opening presentation

- Show a centered banner superimposed over the windy city arena, keeping the skyline visible once its assets are ready.
- The banner's first line is exactly `Gorillas by Miguel Garcia`.
- The second line is a `Visit repo` link to [the GitHub repository](https://github.com/miguelgarcia/gorillas), opened in a new tab without replacing the game page.
- Place a clearly visible `Start` button below the link.
- Show genuine loading feedback while the city assets load, and keep Start disabled until the arena is ready. Do not add an artificial loading delay or automatically dismiss the presentation.
- If loading fails, keep the title and repository link available, show an error with refresh guidance, and do not allow an unready match to start.
- The city is a non-playable backdrop until Start is activated. Hide the aiming ring, scoreboard, and gameplay instructions; aiming, throwing, rematches, and score reset are unavailable.
- Starting reveals the prepared first match with P1 active and both scores at zero. The starting click or key must not also aim or throw.
- Show the presentation once per page load. Rematches and score resets stay in the game; reloading the page shows the presentation again.
- The title, link, loading feedback, Start button, and sound control remain readable within the existing fixed-arena desktop layout. Link and buttons support keyboard focus and activation.

### Presentation music

- Reuse the game's existing looping music for the presentation and continue it into gameplay without restarting or layering a second loop. A separate intro composition is not part of this change.
- Respect the saved sound preference on entry, including remaining silent when the player previously muted audio.
- Start music as soon as browser policy permits. Audible autoplay is not guaranteed: when interaction is required, provide an explicit way to enable music without leaving the presentation.
- Keep the sound control available before and after Start. Distinguish audio waiting for permission from audio actually playing; enabling music alone must not start the match.
- Start also requests audio playback when sound is enabled, but audio permission or availability must never block entry to the game.

## Victory presentation

- The defeated gorilla explodes using the standard gorilla-hit outcome.
- The surviving gorilla performs a victory dance on its rooftop.
- A prominent banner appears in the center of the screen.
- The banner text is exactly `P1 WINS` or `P2 WINS`.
- The full arena remains visible behind the victory presentation.
- After the banner appears, a fresh mouse click anywhere or the Enter key starts the next match.
- The input that released the winning throw cannot also trigger the rematch.
- The next match generates a new skyline and wind value, and the starting player alternates.

The dance timing remains to be defined.

## Aiming interaction

- An aiming ring made from two concentric circles appears only around the active gorilla, serving as both the aiming control and the sole indicator of whose turn it is.
- When a missed turn ends, the guide transfers to the opposing gorilla.
- The player presses on or near the gorilla, drags outward, and releases to throw.
- The banana launches in the direction opposite the drag gesture, like a virtual slingshot.
- Throw strength is proportional to the pointer's distance from the gorilla when released.
- Throw strength has a maximum cap whose value remains to be defined.
- The annular area between the inner and outer circles is the strength indicator; the center of the ring is not filled.
- The entire annular band starts transparent and becomes progressively more opaque as throw strength increases. Strength does not fill a growing portion of its circumference.
- At the strength cap, the annular band remains at its maximum opacity even if the pointer is dragged farther away; the ring itself is not the drag boundary.
- A radial line runs from the gorilla's center to a small arrowhead on the outer circle.
- The arrowhead points in the banana's launch direction, exactly opposite the drag direction.
- The complete predicted trajectory is not shown.

No separate turn label or turn banner is required. Exact guide styling, angle markings, drag thresholds, and strength limits remain to be defined.

Concept references:

- [Full-arena aiming mock](concepts/aiming-gameplay-mock.png) for overall scale and placement.
- [Aiming strength states](concepts/aiming-strength-states.png) for the authoritative low-, medium-, and maximum-strength interaction treatment.

## Wind

- A new hidden random wind value is selected before each match.
- Wind remains constant for the entire match.
- A rooftop flag communicates wind direction and approximate strength.
- Clouds drift with the same wind and reinforce its direction and approximate strength.
- Players are not shown the exact wind value.

## Ballistic environment

- Gravity is constant across every shot, match, and session.
- Gravity is not configurable and its numeric value is not shown to players.
- Wind is the only environmental force that changes between matches.
- Exact gravity and velocity-scale values remain playtesting parameters.

## Explosions, hits, and terrain

- A gorilla is defeated only by direct physical contact with the banana projectile.
- Blast-radius overlap cannot defeat either gorilla, even when the explosion visibly reaches it.
- A banana explodes immediately on its first contact with a building; it does not bounce, roll, or penetrate before exploding.
- The collision point becomes the center of a circular terrain blast.
- The terrain blast radius is constant for every shot and is unaffected by throw strength, wind, building type, or impact speed.
- The exact radius remains a playtesting and balance parameter.
- Either gorilla can be eliminated by direct contact with any banana.
- A player whose banana directly hits their own gorilla loses immediately, and their gorilla uses the same explosion outcome as an opponent hit.
- The blast removes all building terrain inside its circular radius.
- Removed areas reveal the existing background behind the building.
- Removed terrain no longer has collision; later bananas pass freely through every existing hole.
- A blast affects any building terrain inside its radius, including portions of adjacent buildings.
- Buildings do not collapse or use structural physics; unsupported fragments can remain suspended.

## Art direction and theme independence

- The initial visual direction is crisp modern pixel art inspired by the original game, with room for smooth animation, particles, and lighting.
- The initial theme uses a windy, overcast afternoon atmosphere: layered blue-gray clouds, muted building colors, selective bright accents, and clear silhouettes.
- The rooftop flag and moving cloud layers remain the committed wind cues. Other details visible in concept art, such as airborne leaves, are not committed merely by selecting the atmosphere.
- Art is not hardcoded into gameplay rules, world generation, or physics.
- Gameplay uses semantic concepts and world-space geometry rather than sprite dimensions or pixel colors.
- A complete visual theme can be replaced through assets and theme data without changing game code.
- Theme data supplies the visual representation for gorillas, bananas, buildings, windows, sky, clouds, flags, explosions, interface elements, animation, and effects.
- Procedural generation produces semantic city data; the active theme decides how that city is rendered.
- Replacement themes must conform to a documented set of asset roles, anchors, animation states, and supported dimensions.

The selected direction is the bottom-right panel of the [atmosphere moodboard](concepts/atmosphere-moodboard.png). The image is a mood reference rather than a final screen layout or asset specification.

## World scale and skyline generation

- The playable world has a conceptual width of 100 meters, independent of screen pixels.
- The complete arena remains visible throughout aiming, projectile flight, impacts, and turn changes.
- The gameplay camera does not pan or scroll.
- A new skyline is generated for every match.
- Each skyline contains a random total of 10 to 14 buildings.
- Building widths range from 5 to 14 meters while their combined width always fills the 100-meter arena.
- Buildings vary in both width and height.
- Building heights range from 12 to 36 meters.
- Heights are snapped to 3-meter increments, producing buildings from 4 to 12 floors tall.
- Generation should create a coherent city silhouette rather than sampling every building independently.
- Each gorilla must have at least 1 meter of horizontal clearance between its occupied footprint and either edge of its rooftop.
- The gorillas must be separated by at least 40 meters horizontally.

### Proposed generation approach

Use a seeded, constrained skyline-envelope algorithm:

1. Generate a smooth, low-frequency height envelope across the 100-meter world from a small number of randomized control points.
2. Choose a random building count from 10 through 14, then generate a constrained random partition of the full 100-meter width using 5–14-meter buildings. This varies individual widths while guaranteeing that the buildings fill the arena without an awkward final sliver.
3. Derive each building's height from the envelope at its center, add bounded local variation, clamp it to 12–36 meters, and snap it to 3-meter floors.
4. Apply small visual clusters—such as facade palette, window pattern, and roof details—so nearby buildings feel related without becoming identical.
5. Reject or repair pathological results such as roofs too narrow for a gorilla, extreme slivers, unusable edge gaps, or a skyline with insufficient height variation.
6. Find valid rooftop candidates and randomly choose any pair that satisfies rooftop clearance and the 40-meter minimum separation. Do not favor particular sides of the arena, similar heights, or other notions of positional fairness.

The exact envelope-shape parameters and remaining generation constraints remain discovery decisions.

## Open product decisions

- Numerical tuning values for maximum throw strength, gravity, wind range, and terrain blast radius.
- Skyline-envelope tuning and validation limits.
- Exact aiming-ring colors, dimensions, opacity curve, and drag thresholds.
- Exact palette values, animation tone, and audio direction for the initial theme.
- Victory-animation timing.
- Reset-overlay presentation.
- Fixed-arena framing across supported desktop viewport sizes and aspect ratios.
- Accessibility requirements.
- Version 1 acceptance criteria.

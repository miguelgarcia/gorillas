# Single-player rooftop duel

Implemented September 2026. This extends the original two-player v1 specification and its presentation flow.

## Player experience

Choose **Single player** on the title screen, select Easy, Normal, or Hard, and press **Start**. The existing **Two players** mode remains the default. Mode selection does not start the match or regenerate the preview. Asset loading and audio behave as before.

The human controls Player 1 (the orange gorilla, labelled **YOU**); the computer controls Player 2 (the blue gorilla, labelled **CPU**). Positions can appear on either side of the skyline. Both use the same banana, maximum strength, wind, collision rules, and destructible terrain. A direct hit ends the round, including self-hits.

The human opens the first round. The computer waits 1.1 seconds of active game time before each throw, accompanied by “CPU is lining up a throw…”. Only human turns show the aiming ring. Pointer input and the WebMCP throw tool cannot take over a computer turn. Status text announces turn changes and flights.

Wins accumulate in the YOU–CPU scoreboard. Rematches preserve mode, difficulty, and scores, generate a new city, and alternate the starter; the computer automatically opens every second round. Escape pauses the entire simulation and opens the existing score-reset dialog. Reset changes only the scores. **Menu** ends the session, clears scores, and returns to mode selection, retaining the selected mode and difficulty for the next Start. These choices are session-only.

## Opponent design

The computer searches up to 40 flight-time candidates. It estimates a launch vector that accounts for wind, gravity, projectile spawn offset, and the simulation timestep, then evaluates candidates against the actual collision and damaged-terrain model. It takes the first winning arc, or the arc that gets closest to the opponent while avoiding a predicted self-hit. Candidate simulations are immutable and cannot alter the live city or score.

The chosen throw receives seeded angular and speed errors:

| Difficulty | Maximum angle error | Maximum speed error |
| ---------- | ------------------- | ------------------- |
| Easy       | ±8.0°               | ±9%                 |
| Normal     | ±4.0°               | ±4.5%               |
| Hard       | ±1.4°               | ±1.5%               |

These are error ranges, not promised hit rates. The computer knows the actual wind and terrain; difficulty controls execution accuracy. It recalculates each turn against the current city. Errors vary by match seed and shot count, so repeated attempts differ while fixed-seed replays stay deterministic. There is no difficulty adjustment based on the player's score.

## Implementation and verification

- `core.ts` owns session settings, throw count, and the human-aim guard. Existing low-level ballistics remain controller-independent.
- `computer.ts` owns bounded shot planning and `stepSession`, which advances the shared physics and launches only after the computer's thinking interval.
- The React animation loop drives both human and computer turns. There are no delayed throw timers to survive a pause, rematch, or menu exit.
- The existing theme, sprites, music, and shot/victory effects are reused.
- Unit coverage checks deterministic planning, damaged-terrain immutability, legal launches, turn ownership, rematch lifecycle, and relative accuracy across 60 seeded skylines on both sides.
- Browser coverage checks selection, computer throws, input guards, paused thinking, scoring, computer-started rematches, menu cancellation, local-mode switching, keyboard navigation, and small desktop layout.

This release is a repeatable duel. Campaigns, progression, and persistent records are future design choices.

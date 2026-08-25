# ADR-0009: Server-owned phase deadlines

- Status: Accepted
- Date: 2026-08-25

## Context

Short synchronous matches need bounded roll and action stages, including when an active browser disconnects. A browser timer cannot be authoritative: background tabs throttle callbacks, device clocks differ and a modified client could decline to submit the timeout action. Putting wall-clock values in `game-core` would also break deterministic replay and the package boundary.

## Decision

`apps/server` owns transient phase deadlines outside canonical `GameState`:

- setup and mandatory discard, robber and free-road stages have no deadline;
- a primary `roll` stage lasts 5 seconds and expires by executing `RollDice` as the active player;
- `action` and `paired-action` each last 120 seconds and expire by executing `EndTurn` as the active player;
- accepted commands that keep the same player, turn number and action-stage kind do not refresh the deadline.

An expiry is applied through the same `game-core` command executor as a player command. It increments the canonical revision, records ordinary game events, resynchronizes the next phase deadline and broadcasts a new player-safe room projection. The browser receives only the active player, timer kind, duration, deadline and projection timestamp. It renders the remaining time locally and never decides or submits the automatic action.

Timers are in-memory runtime state. Room eviction and server shutdown clear them; the accepted single-instance runtime already treats a process restart as ending every match.

## Consequences

- Countdown display remains smooth without broadcasting one room snapshot per second.
- Client clock skew is corrected from the projected server timestamp.
- A timeout races safely with a last-second player command through the server's single event loop and revision checks; only the first accepted transition wins.
- Mandatory resolutions can still wait indefinitely and remain part of the separate disconnected-seat policy question.

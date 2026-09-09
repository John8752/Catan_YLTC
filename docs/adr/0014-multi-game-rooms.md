# ADR-0014: Immutable game rooms and independent game modules

Status: accepted

## Context

The product now hosts Catan and an original drawing-telephone game for 3–6 players. Catan's map, turn, history and victory model are not platform concepts.

## Decision

- A room chooses `gameId` at creation; it cannot switch games. A finished room can return to its own lobby. Starting another match creates a fresh globally unique `matchId` while keeping room membership and credentials.
- The platform owns identity, seats, host succession, membership, room revision, transport, eviction and the final-settlement repository. Game modules own settings, deterministic commands/state, projections, deadlines, results and game UI. Keep a small explicit dispatch for the two games; no plugin loader or universal rules framework.
- `packages/game-core` remains the only rule/state authority. Catan retains its existing domain modules under ADR-0004; `draw-guess` is a separate public module with no Catan imports. Shared primitives contain no game behavior. Each game has an explicit package subpath.
- `packages/protocol` owns discriminated game views and commands. The platform must not manufacture Catan maps, hands, turns or winners for another game. Catan keeps its existing map-cache/events transport. Drawing telephone uses bounded player-specific snapshots.
- Drawing telephone is simultaneous. Commands bind to the match, step and assigned task, not another player's latest global revision. Duplicate submissions are idempotent; stale tasks and old-match commands are rejected. The server alone advances phases.
- Server deadlines are outside core and bind to a particular match and step. A timeout submits the latest accepted private draft or an explicit missing page; it cannot stall the table. Core receives explicit expiration commands and never reads a clock.
- Catan remains SVG-based. Drawing input uses Canvas 2D with bounded serializable strokes and normalized coordinates. This is a game-specific exception to ADR-0003, not a frontend-stack replacement. Pointer events support mouse, pen and touch; no secure-context-only API is required.
- Live drafts and pages are private in memory. Reveal exposes only the host-revealed prefix. Final account history stores versioned activity metadata, not drawings, secret draft text, credentials or command history. Restart still loses live rooms under ADR-0007.

## Consequences

Documentation, test entry points and commit scopes distinguish `platform`, `catan` and `draw-guess`. Existing Catan rules, account takeover ordering and transport regression coverage remain required. New-game work must include headless rule tests, projection privacy tests and separate multiplayer/browser tests.

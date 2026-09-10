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
- Server deadlines are outside core and bind to a particular match and work step or reveal cursor. A timeout submits the latest accepted private draft or an explicit missing page; it cannot stall the table. Reveal automatically advances every six seconds, with a full interval for the introduction and final entry. Core receives explicit expiration/reveal commands and never reads a clock. Player commands cannot reveal pages. A failed final settlement retains the last cursor for automatic retry.
- Catan remains SVG-based. Drawing input uses Canvas 2D with bounded serializable strokes and normalized coordinates. This is a game-specific exception to ADR-0003, not a frontend-stack replacement. Pointer events support mouse, pen and touch; no secure-context-only API is required.
- Live drafts and pages are private in memory. Opening selection and drawing form one atomic contribution. Guess projections strip the selected word from opening drawings and expose only the source phrase's character count. Reveal exposes only the server-revealed prefix, and fixed system-host commentary consumes that prefix alone. The host is text-based, with no image recognition, AI service or audio dependency. Final account history stores versioned activity metadata, not drawings, secret draft text, credentials or command history. Restart still loses live rooms under ADR-0007.

## Consequences

Documentation, test entry points and commit scopes distinguish `platform`, `catan` and `draw-guess`. Existing Catan rules, account takeover ordering and transport regression coverage remain required. New-game work must include headless rule tests, projection privacy tests and separate multiplayer/browser tests.

## Boundary implementation

- Public imports use `@catan/game-core/catan`, `/draw-guess`, `/primitives` and `@catan/protocol/platform`, `/catan`, `/draw-guess`, `/transport`. The ambiguous package-root exports and duplicate session-response aliases are removed. `RoomSession<R>` is the canonical seat response; each game's view extends the platform room base.
- Protocol files live in `platform`, `catan` and `draw-guess`. Account identity and generic match envelopes belong to platform; the versioned settlement payload belongs to its game. `platform-stream.ts` is the explicit wire-format composition point, and creates a Catan decoder only when a Catan cache/event packet arrives.
- The web `RoomUpdates` store owns credentials, monotonic room revisions and publication. A game policy may reconcile snapshots; Catan's history buffer, history loading and command acknowledgements live in `games/catan`. Draw-guess installs no history policy. `games/room-sync.ts` is the small explicit policy dispatch.
- Account history owns querying, selection and pagination. Its game result renderers load on demand from `games/<gameId>/AccountMatchItem.tsx`. No Catan result UI is a static dependency of the account shell.
- Server game routes and schemas, Catan AI/history/projection/timers/settlements, and each game's room record live under `games/<gameId>`. The registry remains the authoritative seat directory and dispatches typed operations; it does not implement history projection, AI turn quotas or game capacity rules. Each game adapter receives a typed room lookup callback, never the mutable cross-game directory.
- Shared deterministic shuffle primitives are available to both games. Draw-guess retains its integer generator and seeded word order, dealing six choices per player; importing a public primitive must not be mistaken for a Catan dependency.
- Architecture tests parse imports, reexports and dynamic imports across all four source trees. They reject cross-game imports, game dependencies in platform services and Catan rendering in the account shell's static dependency graph. Intentional composition points are named explicitly, not opened up with blanket exceptions.

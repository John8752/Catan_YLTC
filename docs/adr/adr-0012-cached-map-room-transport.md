# ADR-0012: Cached map transport and command acknowledgements

- Status: Accepted
- Date: 2026-09-05

## Context

Every accepted command sent a full personalized room through both the actor's HTTP response and every subscribed WebSocket. Static topology and recent history/effects dominated these responses even with compression. The first optimization phase must preserve game rules, visible history, animations, account privacy and the existing renderer.

## Decision

- `packages/protocol` owns a negotiated `map-cache-v1` transport. `RoomView` remains the complete, player-safe interface consumed by UI components.
- A socket's first map includes geometry. Subsequent messages refer to that geometry and always include the current `robberHexId`. Other dynamic room/game fields, history and effects remain complete snapshots in this phase; no generic deep merge or event replay is used to rebuild rules state.
- A single map cache is scoped to each connection. Its key includes room ID, rule profile, map seed and map-generation version. Reroll/profile/room changes replace the cache; reconnect always starts with a fresh encoder/decoder. No private state is shared between seats or connections.
- Missing geometry closes the socket and triggers the existing reconnect path to obtain a complete snapshot. Normal startup uses the socket's mandatory snapshot instead of an additional unconditional HTTP read. A 1.5-second bootstrap fallback still reads the complete HTTP room if no snapshot arrives.
- New clients request command `responseMode: "ack"`. A success response contains `commandId`, `roomId`, `roomRevision` and `gameRevision`, avoiding an extra private projection. Idempotent retries acknowledge current authoritative revisions without reapplying or rebroadcasting the command.
- Clients finish waiting when the corresponding (or later) room/game revisions have arrived. A disconnected socket or missing push triggers a full HTTP snapshot, never an automatic replay of an already acknowledged command.
- All snapshots pass through one seat-scoped monotonic receiver. Room revision controls ordering, so AI/room updates at the same game revision still apply. Late HTTP results, equal-version duplicates and data from replaced seat credentials do not overwrite newer state.
- Initial and reconnect snapshots establish a quiet animation baseline. Live player-safe effects continue through the existing queue; they are not inferred from hand differences.
- During deployment, clients without transport negotiation still receive full `room_state` messages and command responses. New clients also accept these legacy responses from an older server. Reverting the frontend to the legacy request/connection mode is a protocol-compatible rollback.

## Consequences

Core state, game rules, SVG geometry, settlement payloads and database migrations do not change. Bandwidth and JSON parsing shrink while existing component behavior remains intact. History/effect incrementality is deferred: it would require independent cursor, retention, missed-event and reconnect design.

Full snapshots remain available for recovery and older clients. The cache key relies on the existing deterministic map-generation contract; future map mutations must either remain explicit dynamic fields like the robber or change the map identity/version. See [validation](../validation/room-transport-phase1.md) for measured results and acceptance coverage.

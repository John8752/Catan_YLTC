# ADR-0011: Game-scoped final settlements

- Status: Accepted
- Date: 2026-09-05

## Context

The account milestone originally persisted identity and sessions only. The product now requires personal match history and anticipates games besides Catan. Different games produce different settlement fields, and room codes can be reused across process lifetimes.

## Decision

- Accounts are global identities. Every game-owned persistent record is scoped by a stable game-type `gameId` (`catan` today).
- A separate server-generated UUID `matchId` identifies one match. It is independent of room code and the core's historical `GameState.id`.
- Persist immutable final results only, not rooms, live snapshots, seeds or command/event history.
- Store a generic envelope with game ID, match ID, start/end timestamps, payload version and JSON data. Game adapters own versioned payloads. Protocol owns their transport definitions and player-safe projection.
- Store participating account-to-player links separately. History reads require authentication and query the requesting account's links. Guest opponents' public names remain in the settlement, but guest seats have no personal history link unless claimed before completion.
- Catan v1 reuses `GameSummaryView` with public name/color snapshots, winner and rule settings. It contains the same aggregate end-of-match statistics as the result screen. Live victory and account history share `CatanResultPanel`, which consumes only this persisted data contract; history renders the panel directly without a disclosure or an alternate statistics renderer. No v1 migration is needed.
- Write the settlement and all account links atomically before accepting/publishing the final command. Duplicate writes do not change the result or its participants. A storage failure leaves the live state and command cache unchanged so clients can retry.
- Finalized rooms do not consume an account's active-seat allowance. A login still rotates credentials and removes subscriptions in all linked rooms, including finished ones.

## Consequences

Future games add a protocol payload and server projection/UI renderer without adding Catan-specific database columns or redefining account identity. Payload schema changes add versions; unsupported versions must not be cast to a current schema.

ADR-0007 still applies to active matches. Crashes, restarts, room disband and eviction never create a partial settlement. Once a final transaction commits, a crash before the response may leave a saved result whose final screen was not delivered; the account history is then the durable receipt. Backups include both accounts and settlements.

SQL migrations are bundled immutable SQL strings with checksums to keep the single server/CLI bundle deployable. Production data remains outside the repository. Full restore, backup retention and offline maintenance are documented in the deployment manual.

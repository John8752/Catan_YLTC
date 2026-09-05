# ADR-0010: SQLite-backed single-session accounts

- Status: Accepted
- Date: 2026-09-04

## Context

The product currently identifies a player only by an in-memory room member and a room-scoped `seatToken` stored by the browser. That supports refresh and ordinary socket reconnection, but it does not provide a durable identity, cross-device seat recovery or a way to invalidate another device that still holds the same room credential.

The production service is intentionally one Node process and keeps rooms in memory under ADR-0007. It runs on a bare-IP HTTP origin. The account milestone must fit that runtime without moving game rules or private state into the database.

## Decision

- Add optional username/password accounts stored in a server-local SQLite database.
- Persist accounts and one opaque login session per account. ADR-0011 adds immutable final settlements partitioned by game type; continue keeping rooms and canonical games in memory.
- Preserve guest create/join behavior.
- Allow one live login session and one live room seat per account.
- Make the latest successful login authoritative. It replaces the prior account session, rotates the active room's seat token, closes prior room subscriptions with an explicit protocol reason and returns the replacement seat to the new browser.
- Keep `accountId`, room `playerId` and `seatToken` as separate identifiers. `game-core` continues to know only the room-scoped player identity.
- Use a server-managed HttpOnly, SameSite cookie for the account session and retain local storage only for room-scoped seat credentials.
- Accept HTTP transport as a temporary, explicitly insecure deployment constraint. Do not add `Secure` or a `__Host-` cookie prefix until the origin moves to HTTPS.
- Use direct versioned SQL migrations and a repository boundary rather than an ORM.

## Consequences

Account records survive a process restart, but rooms and matches still do not. Cross-device automatic reconnection works only while the in-memory room exists.

Revoking the account cookie is insufficient to evict the previous device because room commands currently trust `seatToken`. Every account takeover, logout, password change and administrator reset must therefore rotate or quarantine the active room credential as part of the same synchronous server turn.

Room WebSocket subscriptions need a terminal `account_session_replaced` message. The browser must stop its reconnect loop before clearing the old seat, following the pattern already used for `room_closed`.

SQLite introduces migrations, filesystem permissions, backups and restore procedures. The database belongs under `/var/lib/catan`, not the deployed Git checkout. The single-instance restriction remains; this decision does not make SQLite a multi-node coordination store.

Password authentication over the current HTTP origin is vulnerable to network interception. This is an accepted short-term product risk, not a security guarantee. HTTPS migration requires session revocation and a Secure host-only cookie.

Implementation details, delivery slices and tests are defined in [the account system plan](../account-system-plan.md).

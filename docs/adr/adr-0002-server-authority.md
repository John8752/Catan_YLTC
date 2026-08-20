# ADR-0002: Server authority

- Status: Accepted
- Date: 2026-08-19

## Decision

The server is authoritative for room membership, command legality, random outcomes and game revisions. Clients receive player-specific projections and never mutate canonical state.

Every accepted state transition increments a revision. Future persisted matches will record commands/events and periodic snapshots so a failure can be replayed deterministically.

## Reason

Trading and hidden hands make peer trust unsuitable. A single authority gives reconnection, cheating resistance, debugging and automated tests one consistent model.

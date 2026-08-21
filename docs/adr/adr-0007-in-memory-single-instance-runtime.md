# ADR-0007: In-memory single-instance runtime

- Status: Accepted
- Date: 2026-08-21

## Decision

The server keeps all room and match state in process memory and runs as exactly one instance. There is no database, no shared cache and no session store.

Two consequences are accepted rather than worked around:

- A restart ends every match in progress. Deploys are scheduled for quiet hours.
- A room is retained only while someone is connected to it, plus an idle grace period (`ROOM_IDLE_TTL_MINUTES`, default 60). A sweep drops rooms that have no live subscriber and have gone untouched for longer than that. A room with an open socket is never evicted, however long a player takes to think.

Because state cannot be shared between processes, horizontal scaling is forbidden: no cluster mode, no second container, no load balancer with more than one backend.

## Reason

The product is private matches for a small group. Persistence would buy crash-resilient matches at the cost of a schema, migrations, backups and a snapshot format for `GameState`, none of which the current scale justifies.

Eviction is required, not optional: players close the tab far more often than they press leave, so without a sweep every abandoned room stays resident until the process dies. Keying eviction on "has no subscriber" rather than "has not moved recently" is what makes the rule safe for a long, slow turn.

ADR-0002 already anticipates persisted matches: commands and events are recorded per room, so a future durable store can replay them without reshaping the engine. This ADR fixes the interim runtime, not the ceiling.

# ADR-0013: Incremental room history and live effects

- Status: Accepted
- Date: 2026-09-05

## Decision

Extend ADR-0012 with an opt-in `events-v2` room stream. A connection begins with a recent history page and a complete current game state/static map baseline. Later messages carry only new player-safe history and transient effects, plus current action attention. Room revisions link consecutive messages; a missing baseline or gap causes a fresh connection. Legacy full and map-cache-v1 clients remain supported.

History entries have stable server-projected IDs. Pages cover complete revision intervals, including intervals with no readable entries, so multiple events from one command are never split or lost. An authenticated seat can page backward to the start of its current room's game. Queries return only that seat's projected history; raw events and other players' private details never leave the server.

The browser merges covered intervals and deduplicates IDs. It preserves the reader's existing contiguous records while filling gaps after reconnect, then joins them to the latest interval without exposing a temporary hole or resetting the scroll anchor. Historical HTTP responses can extend history but cannot replace current game state or trigger animations. Loaded history belongs to one game and seat credential and is discarded when either changes.

ACK recovery reads include the client's last displayed game revision, so an accepted command whose push was lost can still deliver only its unseen effects. Bootstrap/reconnect snapshots remain quiet. All history reads validate the seat token, current game instance and cursor; pages target 50 readable entries but retain a whole revision together even if that single group exceeds the target. Warning ordering follows the server's append order, independent of random player IDs.

The public record panel no longer discards entries beyond 30. It loads older pages near the top, has an explicit earlier-records/retry control, preserves the reading anchor when prepending, and offers return-to-latest when new records arrive. Initial downloads stay bounded to a recent page; older data loads on demand.

## Boundaries

Rules and settlement persistence do not change. Full raw records already live in server memory for the room lifetime; paging does not make them durable. Accounts still retain final settlements only. Initial/reconnect snapshots and older pages never replay old effects. Current-action effects remain available even when no historical event was appended.

Validation must cover duplicate/gapped streams, same-revision multi-event ordering, warning history, private projections, append/page races, replaced seats, reconnect recovery, scroll behavior, complete-match equivalence and actual compressed network bytes.

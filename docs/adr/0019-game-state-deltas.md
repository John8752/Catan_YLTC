# ADR-0019: Player-safe game deltas and command acknowledgements

Status: accepted
Date: 2026-11-26

## Decision

Negotiate `games-v3` per WebSocket connection. Catan retains its existing events-v2 semantics and drawing telephone retains full snapshots. Carcassonne owns a typed delta for board, regions, meeples and scores; Camel Up owns a bounded log splice plus changed current-state fields. Poker retains bounded full snapshots in this iteration. No raw core events or private server state are diffed.

A connection begins with a complete player-safe view. Deltas bind to room ID, game type, match ID, viewer and exact base room revision. Missing bases/gaps reconnect for a complete view; duplicate and stale packets cannot roll state back. Lobby/new match/viewer changes reset the baseline. Collection changes include removals and preserve authoritative ordering and unchanged object identities. HTTP recovery snapshots do not mutate a socket decoder's baseline.

Camel Up, Carcassonne and Poker commands always return small acknowledgements. Per user direction, these games have no legacy full-command-response mode or old-client delta fallback; deploy the matching web and server together. Catan's existing modes are unchanged. An acknowledgement names the command, room, match and accepted room/game revision (and poker hand). The browser waits for an already-arrived or forthcoming push, then reads a full safe snapshot if the push is missing. Credentials and match scope are rechecked after every wait/read. Accepted commands are never resent to recover a push.

Carcassonne constructs only canonical board fields and reuses public derived data per immutable core state. Its renderer retains keyed pawn and candidate objects. Rendering and transport changes do not change legality, scoring, persistence or hidden-information ownership.

## Verification

Require complete-match projection equivalence, actual negotiated WebSocket coverage, duplicate/gap/reconnect/new-match/private-view tests, ACK/push ordering and missing-push recovery, and scoped multiplayer/mobile checks. Report uncompressed JSON separately from compressed wire bytes; do not infer phone FPS from message sizes.

# ADR-0006: Event-driven game effects

- Status: Accepted
- Date: 2026-08-20

## Context

Resource production and future reward feedback need stronger presentation than an immediate number change. If the browser infers an event by comparing snapshots, duplicate WebSocket/HTTP responses, reconnects, bank shortages and hidden-information rules can produce false or leaking animations.

## Decision

The deterministic engine records public source data for resource grants. `packages/protocol` projects only player-safe animation payloads through `GameView.effects`. The browser queues effects by game and revision, ignores effects already present in its first snapshot, and deduplicates repeated live snapshots.

The Web implementation lives under `apps/web/src/effects` and uses semantic DOM anchors supplied by the board and HUD. Production feedback follows this restrained sequence:

1. every unblocked hex matching the roll shakes and pulses, even when it has no adjacent building or the bank grants nobody that resource;
2. buildings that actually produce pulse;
3. one merged token per player/resource travels to the player's target;
4. the private resource card or public opponent row pulses on arrival.

Strong whole-board motion is reserved for disruptive events such as rolling seven or moving the robber.

Resource gains from player trades and maritime trades reuse the same projected effect queue. Player trades record the public source player, while maritime gains use a semantic bank anchor. A robber transfer projects the resource identity only to the thief and victim; every uninvolved player receives an explicit unknown-card transfer so the visible motion does not reveal private information.

The same queue now projects three additional effect families:

- paid builds and development-card purchases carry their public cost from the player's semantic resource anchors into the resulting piece or development-card control;
- score gains after setup carry only the public reason and delta, except that a newly bought hidden victory-point card is projected only to its owner;
- robber movement records both the authoritative source and destination hex so the pawn can travel for two seconds without the browser reconstructing the prior snapshot.

Current-action attention is a separate, player-safe effect in `GameView.effects`. It describes only the viewer's current authoritative interaction, not historical rewards. The protocol supplies a stable opportunity ID across roll/action and settlement/road transitions. Mandatory resolutions and incoming offers have their own IDs and copy. A dedicated immediate lane deduplicates these IDs so a queued resource animation cannot delay a roll reminder; historical reward effects continue through the existing queue. Initial loads and the first socket snapshot after reconnect establish a baseline without replaying notices.

Persistent dock emphasis follows the projected interaction. The one-time notice lasts 1.5 seconds in a reserved strip above the map, with no pointer interception or focus change. Required actions use a pale coral-red surface, soft red border, dark red heading and a single brief brightness cue; incoming trades use a quieter treatment. Reduced-motion users retain the static text without the brightness animation. No audio is added.

Robber travel resolves semantic `data-robber-anchor` points at the same upper-left offset as the settled pawn, keeping both the stationary piece and its arrival clear of the central number token.

Resource travel also uses a two-second path. The canonical state still updates immediately; the effect is presentation feedback and never a lock on subsequent rule processing. Setup settlements intentionally do not emit score feedback, avoiding six repetitive score overlays before normal play begins.

## Boundaries

- Effects never decide or delay canonical state. The server snapshot is immediately authoritative.
- A reconnect or initial room load does not replay historical effects.
- Duplicate delivery of one revision does not enqueue an effect twice.
- Public effects must not reveal stolen resource identity, opponent hand composition or private development cards.
- End-game summaries are computed from the server's complete event record and project aggregate counts only. They do not expose opponent hand composition, stolen resource types or development-card identities.
- `prefers-reduced-motion` removes decorative travel while preserving a short source/target state cue.
- Animations use transforms, opacity and filters without changing document layout or intercepting input.

## Consequences

- Domain events contain slightly richer public source metadata and therefore update the reviewed replay digest.
- Visual work can evolve independently of board rendering and rules code.
- New effect families require an explicit safe protocol projection rather than direct access to raw server history.

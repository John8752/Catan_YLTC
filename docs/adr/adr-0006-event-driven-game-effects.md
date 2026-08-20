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

## Boundaries

- Effects never decide or delay canonical state. The server snapshot is immediately authoritative.
- A reconnect or initial room load does not replay historical effects.
- Duplicate delivery of one revision does not enqueue an effect twice.
- Public effects must not reveal stolen resource identity, opponent hand composition or private development cards.
- `prefers-reduced-motion` removes decorative travel while preserving a short source/target state cue.
- Animations use transforms, opacity and filters without changing document layout or intercepting input.

## Consequences

- Domain events contain slightly richer public source metadata and therefore update the reviewed replay digest.
- Visual work can evolve independently of board rendering and rules code.
- New effect families require an explicit safe protocol projection rather than direct access to raw server history.

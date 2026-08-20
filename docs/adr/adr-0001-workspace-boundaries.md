# ADR-0001: Workspace boundaries

- Status: Accepted
- Date: 2026-08-19

## Decision

Use a pnpm workspace with `apps/web`, `apps/server`, `packages/game-core` and `packages/protocol`.

`game-core` owns deterministic state and rules. `protocol` owns transport contracts and player projections. Applications compose those packages without redefining their values.

## Reason

Rules, networking and rendering evolve at different speeds. Keeping them independently testable prevents browser callbacks or transport code from becoming an accidental game engine.

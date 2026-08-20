# ADR-0004: Modular domain boundaries

- Status: Accepted
- Date: 2026-08-20

## Context

The game will grow across several independent dimensions: alternate maps, player-count rule profiles, new resource types, new buildable pieces and different trade policies. If map geometry, inventory mutation, construction costs and trade flow are implemented in one reducer or UI component, every addition will require unrelated changes and multiplayer bugs will become difficult to reproduce.

The domains are related, so the objective is low coupling with explicit contracts rather than pretending they have no relationship. A road needs a map edge and a resource cost, but road logic should not know how the map stores adjacency or how an inventory stores cards.

## Decision

Keep `packages/game-core` as the deployable package while dividing it into logical domain modules:

```text
primitives/
  ids, quantities, coordinates, result values
map/
  topology, templates, adjacency, occupancy slots
resources/
  catalog, inventory, bank, production transfers
buildables/
  catalog, costs, piece limits, placement requirements
trade/
  offers, policies, ratios, atomic asset transfers
rulesets/
  base-3-4 and future profile composition
engine/
  command validation, event application, invariants
```

These are module boundaries, not a requirement to create a workspace package for every noun. A module becomes a separate package only when it needs independent ownership, release/build behavior or reuse.

## Dependency direction

```text
primitives
   ↓
map   resources   buildables   trade
   \      |          |        /
          rulesets
              ↓
            engine
              ↓
           protocol
              ↓
        server and web
```

Sibling domains may depend on stable value types or narrow capabilities, but not on another sibling's storage representation or internal files. `rulesets` is the composition root where domain definitions are connected.

Examples:

- `map` exposes `VertexId`, `EdgeId`, adjacency queries and occupancy slots. It does not deduct resource cards.
- `resources` exposes immutable amounts and atomic inventory operations. It does not calculate SVG positions.
- `buildables` declares a road's cost and that it requires an edge capability. It does not edit an edge collection or player hand directly.
- `trade` validates an offer against tradable-asset and inventory capabilities. A maritime modifier is supplied by the composed ruleset rather than discovered by reading map state internally.
- `engine` coordinates an accepted build command by asking each domain to validate/apply its own part and then emits the resulting events.

## Extension rule

Adding a new definition should not fan out through unrelated modules:

- New resource: extend the resource catalog and the ruleset mappings that produce/use it.
- New map: add a topology/template definition without changing inventory or trade algorithms.
- New buildable: add its definition and focused placement/effect rules without changing the renderer's canonical state model.
- New tradable asset: register its transfer capability and trade policy without teaching the map about it.

If an addition requires edits across every domain, stop and review the boundary before continuing.

## State and events

Canonical game state remains serializable. Cross-domain state changes are represented by commands/events or composed atomically by the engine. No domain receives React objects, WebSocket connections, database handles, timers or ambient random sources.

## Current migration note

M0's current `board.ts` combines coordinate layout, terrain assignment and number-token generation, while `TerrainType` is coupled directly to `ResourceType`. Before implementing interactive initial placement and production, split this into at least:

- map topology/template generation;
- terrain/resource production definitions;
- ruleset composition that assigns content to a topology.

This migration should be a behavior-preserving refactor with the existing deterministic board tests kept green, committed separately from the first placement feature.

## Consequences

- Headless tests can target one domain without booting a room or renderer.
- Alternate maps and rule profiles become composition work instead of nested conditionals.
- Some explicit adapter and value-type code is required at boundaries.
- Over-abstraction remains a risk; interfaces should be introduced where a real cross-domain seam exists, not for every function.

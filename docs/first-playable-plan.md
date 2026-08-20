# First playable implementation plan

## Outcome

Deliver one locally operated, complete `base-3-4` match that three or four human players can finish in separate browser tabs or devices. Delivery is one playable version, but implementation uses small green commits so failures remain diagnosable and agent handoffs remain safe.

The authoritative behavior contract is [base-3-4-playable.md](./rules/base-3-4-playable.md). If implementation pressure conflicts with that contract, change the rule document and its tests deliberately; do not silently simplify the product.

## Definition of done

The version is done only when all of the following are evidenced:

- a host creates a room, two or three others join, and the room starts;
- all setup placements, normal turns, seven/discard/robber flow, both trade modes, all builds and all development-card effects work;
- longest road, largest army, public/private points and a 10-point win are correct;
- every action is server-authoritative, revisioned, idempotent and visible to all connected players;
- refreshing a tab recovers the same seat and latest state without revealing another player's private data;
- one deterministic full-match replay and the required automated suites pass;
- a real three-player browser playtest finishes a match on desktop, plus focused mobile interaction checks pass at 390×844;
- `pnpm validate` and the new end-to-end quality gate pass from a clean checkout.

## Architecture stance

Keep the existing pnpm workspace and React/SVG direction. Do not introduce Phaser or a canvas engine: the board has a small number of semantic pointer targets, while trade, cards, history and dialogs benefit from accessible DOM controls.

```text
browser intent
    ↓
protocol command envelope
    ↓
server room command queue
    ↓
game-core execute(command, state, injectedRandom)
    ↓
domain events + next canonical state + revision
    ↓
player-specific protocol projection
    ↓
WebSocket full snapshot + public/private history
    ↓
React interaction model + SVG board + DOM HUD
```

For this board size, broadcast a full player-specific snapshot after each accepted command. Delta synchronization adds complexity without a useful first-version bandwidth win. Event history remains available for replay and debugging, but the browser does not rebuild canonical state from events.

## Planned code structure

The following is the target shape, not a requirement to create empty files in advance.

```text
packages/game-core/src/
  primitives/
    ids.ts                 branded game/player/hex/vertex/edge/command IDs
    quantities.ts          non-negative resource and point values
    result.ts              accepted/rejected command results and error codes
    random.ts              injected random interface, seeded source and random tape
  map/
    types.ts               topology and content value types
    topology.ts            vertices, edges, adjacency and coastline queries
    standard-topology.ts   deterministic 19-hex topology
    generation.ts          seeded terrain/number/port assignment
    occupancy.ts           immutable building and road occupancy operations
  resources/
    catalog.ts             five canonical resource definitions
    inventory.ts           immutable hand arithmetic
    bank.ts                finite bank and atomic transfers
    production.ts          roll and setup production calculation
    discard.ts             seven-discard validation
  buildables/
    catalog.ts             road/settlement/city definitions and costs
    supply.ts              per-player piece limits
    placement.ts           network, distance and upgrade requirements
  trade/
    offer.ts               offer lifecycle and atomic player transfer
    maritime.ts            port-derived ratios and bank trade
  development/
    catalog.ts             card definitions and deck composition
    deck.ts                deterministic shuffle/draw
    effects.ts             knight, roads, monopoly and resource choice
  awards/
    longest-road.ts        graph search and holder/tie policy
    largest-army.ts        knight count and holder/tie policy
    victory.ts             public/private totals and winner check
  rulesets/
    types.ts               RuleProfile contract
    base-3-4/
      profile.ts           composition root
      board.ts             board/supply/deck configuration
      setup.ts             setup order and starting-resource policy
      turn.ts              phase and command policy
  engine/
    state.ts               canonical serializable GameState
    phase.ts               discriminated setup/turn/interrupt/finished phases
    commands.ts            exhaustive GameCommand union
    events.ts              exhaustive private DomainEvent union
    execute.ts             validate, orchestrate and atomically accept/reject
    apply.ts               pure event application
    invariants.ts          post-transition global invariants
    replay.ts              seed + event/random-tape reproducibility
  testing/
    builders.ts            explicit state builders, never production backdoors
    random-tape.ts         deterministic dice/deck/steal outcomes
    match-driver.ts        legal command helpers for full-match replay
  index.ts                 public exports only; no internal-path imports outside package

packages/protocol/src/
  commands.ts              wire command envelope and response types
  schemas.ts               runtime validation for untrusted input
  views/
    room.ts                lobby/presence projection
    game.ts                player-specific snapshot
    interactions.ts        server-supplied legal action/target hints
    history.ts             redacted public/private event entries
  messages.ts              WebSocket message union
  index.ts                 public exports

apps/server/src/
  app.ts                   transport composition only
  rooms/
    registry.ts            room lifecycle and credentials
    command-queue.ts       one serialized mutation queue per room
    command-service.ts     auth, idempotency, expected revision and engine call
    subscriptions.ts       player-specific snapshot broadcast
    history-store.ts       in-memory event log and command result cache
  routes/
    rooms.ts               create/join/start/get HTTP routes
    commands.ts            POST command endpoint
    websocket.ts           state/history subscription and reconnect

apps/web/src/
  app/
    App.tsx                route/screen composition
    session.ts             tab-scoped seat credential recovery
    game-client.ts         HTTP commands, command IDs and WebSocket reconnect
    game-store.ts          latest server snapshot; no rule authority
  features/
    lobby/                 create, join, seat list and start
    board/                 SVG hexes, vertices, edges, ports and pieces
    setup/                 settlement/road selection flow
    turn/                  roll, phase banner and end-turn controls
    robber/                discard, destination and victim dialogs
    build/                 costs, available builds and placement mode
    trade/                 player offers and maritime trade
    development/           buy/play card controls with private hand
    history/               redacted event log
    result/                winner and final score surface
  shared/
    components/            dialogs, sheets, buttons and status UI
    labels/                Chinese labels for stable protocol IDs
    accessibility/         focus and announcement helpers

tests/
  fixtures/
    full-match/            seed, commands, random tape and expected digest
  e2e/
    lobby.spec.ts
    setup.spec.ts
    turn.spec.ts
    trade-build.spec.ts
    robber-cards.spec.ts
    reconnect-redaction.spec.ts
    full-match.spec.ts
  visual/
    board-states.spec.ts
    mobile.spec.ts
```

## Dependency rules

- `primitives` imports no game domain.
- Sibling domain modules use stable IDs, values and narrow capabilities; they never import another sibling's private storage files.
- `rulesets/base-3-4` is the composition root for map content, costs, deck, ports and policies.
- `engine` coordinates domains and owns phase transitions, but domain calculations remain in their modules.
- `protocol` imports only public `game-core` exports.
- `server` owns authority, credentials, ordering and transport, not game rules.
- `web` renders projections and submits intent. It may use server-provided legal target hints for UX but still handles server rejection.
- Add an automated dependency-boundary check before the structure becomes large enough for internal imports to spread.

## Canonical state and command model

### State groups

`GameState` should remain one serializable aggregate containing:

- identity: game ID, rule profile, generation version, seed and revision;
- map: topology/content IDs, robber hex and immutable occupancy;
- supply: bank resources and remaining development deck;
- players: public identity, private inventories/cards, piece supply, played knights and build history;
- phase: exact required actor and legal resolution stage;
- trade: at most one open player offer;
- awards and winner;
- deterministic random cursor and turn number.

Do not put WebSocket objects, React state, timers, callbacks or ambient random functions in canonical state.

### Phase union

Use a discriminated union that makes mandatory interruptions impossible to skip:

```text
setup.place-settlement
setup.place-road
turn.awaiting-roll
turn.discarding
turn.moving-robber
turn.action
turn.placing-free-roads
finished
```

Robber resolution records a continuation (`awaiting-roll` or `action`) so a knight can be played on either side of the roll. Trade offer state is orthogonal to `turn.action`; ending the turn cancels or rejects an unresolved offer by explicit policy.

### Commands

The exhaustive command union should include:

- `PlaceInitialSettlement`, `PlaceInitialRoad`;
- `RollDice`, `DiscardResources`, `MoveRobber`;
- `BuildRoad`, `BuildSettlement`, `BuildCity`;
- `OpenTradeOffer`, `AcceptTradeOffer`, `CancelTradeOffer`;
- `MaritimeTrade`;
- `BuyDevelopmentCard`, `PlayKnight`, `PlayRoadBuilding`, `PlayMonopoly`, `PlayResourceChoice`;
- `EndTurn`.

Each wire submission is wrapped by `{ commandId, expectedRevision, command }`; actor identity comes from the seat credential, not a trusted command field.

### Events and randomness

Accepted commands emit domain events such as dice rolled, resources transferred, piece built, card drawn, robber moved, trade completed, award changed and game won. Rejected commands emit no domain events and do not increment revision.

Dice, deck shuffle/draw and stolen-resource selection consume only an injected source. Their outcomes are recorded so replay does not depend on running the pseudo-random algorithm again. Public history is a redacted projection of private engine events, not the engine event stream itself.

## Implementation slices and TDD sequence

Every slice follows the same loop:

1. write the rule note or amend the behavior table;
2. add the smallest failing deterministic test (`RED`) and confirm it fails for the intended reason;
3. implement only enough domain behavior to pass (`GREEN`);
4. add rejection, boundary and invariant cases;
5. refactor with the narrow suite green;
6. update protocol/server/web only when that rule becomes player-visible;
7. run the slice tests, then `pnpm validate` before the coherent commit.

### S0 — Behavior-preserving modular refactor

**Goal:** split current `model.ts`, `board.ts` and `game.ts` along ADR-0004 boundaries without changing M0 behavior.

**RED/characterization evidence:** preserve the current seed snapshots, terrain counts, setup order and projections. Add a dependency-boundary test that fails on forbidden internal imports.

**Exit:** current 11 tests and new characterization/boundary tests pass; generated board snapshots are unchanged. Commit contains no new gameplay.

### S1 — Canonical topology, content and ports

**Goal:** produce stable hex, vertex, edge and port IDs and render them as semantic SVG targets.

**First failing tests:** 19/54/72 counts; symmetric adjacency; every edge has two vertices; coastline cycle is valid; nine ports have valid coastal edges; same seed and generation version reproduce content; 6 and 8 are never adjacent.

**Cross-layer tests:** projection contains stable topology IDs; board renders all placement targets; resize preserves the same IDs.

**Exit:** desktop and 390×844 screenshots show readable hexes, vertices, edges and ports without interaction.

### S2 — Initial placement vertical slice

**Goal:** all players finish snake-order setup through the real UI.

**First failing tests:** wrong actor rejected; adjacent settlement rejected; setup road must touch the just-placed settlement; second settlement grants exact adjacent resources; phase advances to turn 1 only after the final road.

**Cross-layer tests:** command schema, server credential/revision checks, multi-context broadcast, clickable legal target hints and illegal-command error feedback.

**Exit:** three browser contexts complete all six placements and see identical occupancy/resources.

### S3 — Roll, production, bank and end turn

**Goal:** repeatable normal turns without sevens.

**First failing tests:** only active player rolls once; dice outcome is injected and recorded; settlement/city production amounts; robber blocks production; finite-bank shortage is all-or-none per resource; only action stage can end turn.

**Cross-layer tests:** dice display, resource redaction, revision increment and next-player banner.

**Exit:** three contexts complete several turns with deterministic rolls and consistent hands.

### S4 — Seven, discard, robber and stealing

**Goal:** mandatory seven resolution cannot be bypassed.

**First failing tests:** exact discard threshold/count; multiple discards in any order; unrelated commands rejected during interruption; robber must move; victim eligibility; injected steal; hidden stolen type; knight continuation before/after roll.

**Cross-layer tests:** simultaneous discard dialogs are private; active player cannot continue early; victim selector shows only eligible players.

**Exit:** an end-to-end seven resolves across three contexts and returns to action.

### S5 — Paid building and piece supply

**Goal:** roads, settlements and city upgrades work with real costs and placement rules.

**First failing tests:** every cost; insufficient hand is atomic; road connectivity and opponent interruption; settlement distance/network rules; city owns/replaces settlement; piece limits; bank receives paid resources; points update.

**Cross-layer tests:** build menu derives from projected affordances; selecting a build highlights only server-supplied candidates; stale target rejection refreshes state.

**Exit:** each build type is completed from a browser and appears identically for all players.

### S6 — Maritime and player trading

**Goal:** active player can negotiate and trade without information leaks or race duplication.

**First failing tests:** 4:1, 3:1 and resource 2:1 ratios; best port selection; bank shortage; offer ownership/content; accept-time affordability; atomic two-way transfer; cancel; concurrent accepts result in one completion; duplicate command ID applies once.

**Cross-layer tests:** offer/accept/cancel across separate contexts; opponents never receive hidden hand composition; reconnect sees current offer.

**Exit:** player and maritime trades are verified in the same live room.

### S7 — Development deck and effects

**Goal:** deterministic purchase and every card effect.

**First failing tests:** deck composition/order; cost and empty deck; private draw; bought-this-turn restriction; one playable card per turn; knight flow; two free roads and supply edge case; monopoly transfer; resource-choice bank availability; hidden victory points.

**Cross-layer tests:** only owner sees card identity; card dialogs enforce projected choices; public history describes effects without revealing unrelated private data.

**Exit:** deterministic browser scenarios exercise every non-victory card and private victory-card projection.

### S8 — Awards, victory and complete replay

**Goal:** finish a legal match and reproduce it.

**First failing tests:** longest route through branches/cycles, no edge reuse, opponent interruption, tie/holder policy; largest-army threshold/tie; public/private point totals; winning only on active turn; all post-win commands rejected.

**Replay test:** drive the recorded full-match fixture through public engine commands using a seed and random tape; assert every revision, event digest, hidden-data projection and final winner; replay twice and compare byte-stable serialized final state.

**Exit:** headless full match finishes at 10+ legal points and the winner UI renders.

### S9 — Reconnect, history and resilience

**Goal:** normal local network interruptions do not fork or lose a seat.

**First failing tests:** credential is private; reconnect receives latest revision; missed snapshots converge; stale expected revision is rejected with current snapshot; accepted command retry is idempotent; public/private event history redacts correctly.

**Cross-layer tests:** close/reopen WebSocket, refresh active/non-active tabs, retry a command response, and verify all clients converge.

**Exit:** no manual refresh is needed after a transient socket close, and a tab refresh restores the same seat.

### S10 — Player-facing completion and full playtest

**Goal:** turn the verified rules into a readable complete match surface.

**Tests first:** component interaction tests for phase-specific controls, keyboard focus restoration, errors and disabled/busy states; Playwright assertions for each main verb.

**UI pass:** persistent current-player/phase banner; resource and cost summary; build/trade/card actions; compact public history; modal or bottom-sheet interruptions; winner summary. Keep the board dominant and use restrained transitions with reduced-motion support.

**Exit:** automated E2E passes, then a real three-player match is completed and recorded in the validation log.

## Test pyramid and tools

| Layer | Purpose | Planned tool/evidence |
| --- | --- | --- |
| Pure domain unit | Rule examples, rejection codes and edge cases | Vitest table tests beside each domain |
| Property/invariant | Topology, conservation, non-negative quantities and graph behavior | `fast-check` added only when S1 begins |
| Engine scenario | Command/phase/event sequences and deterministic replay | Vitest scenario builders and random tapes |
| Protocol contract | Runtime schema, exhaustive messages and redaction | Vitest plus serialization fixtures |
| Server integration | Auth, revision, idempotency, concurrency and broadcast | Fastify injection plus WebSocket clients |
| React interaction | Selection modes, dialogs, focus and error feedback | Vitest + Testing Library + user-event |
| Browser E2E | Real multi-player flow and reconnect | Playwright with three isolated browser contexts |
| Visual/responsive | Board/HUD overlap and state readability | Playwright screenshots at desktop and 390×844 |
| Manual full match | Negotiation usability and missing-state discovery | Three human-controlled sessions with issue log |

Tests should assert stable IDs, outcomes, invariants and error codes—not incidental object order, CSS class names or implementation-private function calls. Snapshots are appropriate only for deterministic serialized fixtures and focused visual evidence.

## Invariants checked after every accepted command

- revision increases exactly once and command ID is recorded once;
- resources are non-negative and bank + player totals remain conserved except for explicit setup fixtures;
- each board location has at most one allowed occupant and all occupied IDs exist in topology;
- player piece supply plus pieces on the board equals the profile limits;
- development deck plus all player development cards and played cards remains conserved;
- phase actor and required responders are valid players;
- no open trade exists outside the allowed action state;
- award holder and cached points equal fresh calculations;
- finished state has exactly one recorded winner and accepts no gameplay command;
- serializing canonical state yields JSON-safe data with no renderer or transport objects.

## Validation commands and gates

The implementation should introduce these root commands as their tools land:

```text
pnpm test:core        game-core unit, property and scenario tests
pnpm test:protocol    schemas and projection/redaction tests
pnpm test:server      API, WebSocket and concurrency tests
pnpm test:web         component interaction tests
pnpm test:e2e         multi-context Playwright tests
pnpm test:replay      canonical complete-match replay
pnpm test:boundaries  dependency-direction enforcement
pnpm validate         check + all non-browser tests + build
pnpm validate:full    validate + replay + E2E
```

Per-commit gate: narrow RED/GREEN suite, relevant package check, then `pnpm validate` before commit.

Playable release gate:

1. clean install from the committed lockfile;
2. `pnpm validate:full` passes twice to detect order/flakiness;
3. deterministic replay digest matches its reviewed fixture;
4. three desktop contexts complete create/join/setup/main verbs/win;
5. reconnect and private-data checks pass for every seat;
6. 390×844 screenshots cover setup, action, trade, discard and winner states;
7. one real three-player full match completes with no blocker or private-data leak;
8. `docs/validation/first-playable.md` records commit, commands, browser versions, seed, replay digest, screenshots and any accepted non-blocking issues.

## Commit and agent handoff strategy

- One behavior-preserving refactor commit before new rules.
- Then one coherent vertical slice per S1–S10; a slice may use multiple commits when rule, protocol and UI reviews need separation, but every commit stays green.
- Rule note, first failing test, implementation and projection change for one behavior travel together.
- Commit bodies record `Context`, `Changes` and actual `Validation` evidence.
- At each handoff, update this document's slice status and name the next failing test. Do not leave “continue building gameplay” as an unbounded instruction.
- Never claim a slice complete from unit tests alone when its exit criterion requires multi-client behavior or rendered UI.

## Risks controlled by this plan

- **Rules blob:** ADR-0004 dependency boundaries and boundary tests.
- **Client authority drift:** server-projected affordances plus server revalidation.
- **Random/non-reproducible bugs:** injected outcomes, recorded events and complete replay fixture.
- **Concurrent trade duplication:** serialized room queue, expected revisions and command idempotency.
- **Hidden-information leaks:** projection tests at every private event and multi-seat E2E inspection.
- **UI built after rules:** each rule slice crosses protocol and UI before it exits.
- **Huge unreviewable delivery:** green vertical commits while preserving the single final playable objective.

## First implementation move

When implementation is authorized, begin with S0 only: add characterization and import-boundary tests, then perform the behavior-preserving `game-core` split described in ADR-0004. The first gameplay RED test after that is: “standard topology exposes 19 hexes, 54 vertices and 72 edges with symmetric adjacency.”

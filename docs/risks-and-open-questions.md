# Risks and open questions

## Settled M0 decisions

| ID | Decision | Result |
|---|---|---|
| D1 | Renderer | React + responsive SVG board + DOM HUD |
| D2 | Authority | Server-authoritative rooms and rules |
| D3 | First complete profile | 3–4 player base rules |
| D4 | Randomness | Explicit seeded source; no ambient randomness in the core |
| D5 | Identity | Anonymous room-scoped player identity for the first release |

## Open questions

| ID | Question | Needed by |
|---|---|---|
| O1 | Exact two-player *variant* and neutral-player behavior. Two seats already play plain `base-3-4`; this is about whether a distinct variant is worth building | two-player milestone |
| O3 | Reconnection grace period and abandoned-seat policy | M1 |
| O4 | Whether chat is in-product or external | trading UX milestone |
| O5 | Public release name and rights review | public deployment |

Resolved after M0: the 5–6 player profile follows the revised paired-player turn, with the player third to the primary player's left acting second and trading only with the bank.

## Post-M0 account decisions

| ID | Decision | Result |
|---|---|---|
| D6 | Account availability | Optional; guest room entry remains supported |
| D7 | Concurrent login policy | One session and one live room seat per account; newest successful login takes over |
| D8 | Initial persistence scope | SQLite persists accounts and login sessions, not rooms or canonical matches |
| D9 | Initial transport | Bare-IP HTTP is temporarily accepted with an explicit warning; credentials are not secure against network interception until HTTPS |

The implementation and regression requirements for D6–D9 are recorded in [the account system plan](./account-system-plan.md) and proposed ADR-0010. The HTTP choice is a known security exposure, not a mitigation target that can be solved by password hashing or cookie flags alone.

### O3 disconnected mandatory-resolution direction (partially superseded 2026-08-25)

A regular phase clock is now defined independently of connection state: primary rolls
expire after 5 seconds and normal/paired action stages after 120 seconds. That handles
disconnection while the game is waiting for those two command families. A disconnected
player can still stop the room during setup or a mandatory discard/robber/free-road
resolution, so the remaining O3 direction is deferred rather than dropped:

- **Grace period 120 seconds**, configurable (`TURN_TIMEOUT_SECONDS`).
- **On expiry the server plays one minimal legal move**, and the seat returns to its
  player the moment their socket reconnects — no manual hand-back.

Per-phase move, if built as described:

| Blocked on | Automatic move |
|---|---|
| `setup/settlement`, `setup/road` | first vertex/edge from the engine's legal list |
| `turn/discard` | shed the owed count off the deepest stacks |
| `turn/robber` | move to a hex that steals from nobody where one exists |
| `turn/free-road` | first legal edge |

Findings from the deferred spike, so the next attempt need not redo them:

- `game-core` already exports legal-move enumeration for every blocking phase
  (`legalInitialSettlementVertices`, `legalInitialRoadEdges`, `legalRobberTargets`,
  `legalFreeRoadEdges`), so choosing a move needs no new rules code.
- Placement order aside, `turn/discard` can block on **several** players at once, so
  "who are we waiting for" returns a list, not one id.
- `free-road` cannot dead-end: `playRoadBuilding` refuses to enter the step without a
  legal edge and `buildFreeRoad` leaves it once none remain.
- `EndTurn` already clears `openTrade`, so an absent player's dangling offer needs no
  separate cancel.
- Any additional clock must live in `apps/server`; `game-core` may not read one. Choosing the move
  is a pure function of state and belongs in the engine.
- Open sub-question: whether consecutive steps in one turn share a single grace period.
  Letting each awaited player pay it once per turn reads better than once per step —
  a whole turn otherwise costs several multiples of the timeout.
- Not covered by the above: players cannot see that a move was automatic. The dock already
  renders a textual log (`公开记录`, from `GameView.history`), so surfacing it is a matter of
  marking the record rather than building somewhere to show it.

## Risks

| ID | Risk | Mitigation |
|---|---|---|
| R1 | UI becomes the source of rule truth | Keep all legality in `game-core` and test it headlessly |
| R2 | Private cards leak over WebSocket | Centralize projections in `packages/protocol` and test redaction |
| R3 | Reconnect creates divergent state | Use revisions, snapshots and recorded commands/events |
| R4 | Player-count variants become nested conditionals | Use explicit `RuleProfile` modules |
| R5 | Vibe coding produces giant files | Enforce the code map and split near 500 lines |
| R6 | Map, resources, building and trade collapse into one rules blob | Enforce ADR-0004 domain boundaries and compose them only in named rulesets |

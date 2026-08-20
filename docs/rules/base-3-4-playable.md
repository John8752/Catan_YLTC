# Base 3–4 playable rules

## Purpose

This document fixes the executable scope of the first complete playable version. It is a behavior contract for tests and implementation, not a reproduction of any commercial rulebook.

The first playable version supports one named rule profile: `base-3-4`. A match has three or four human players, starts from an empty variable board and ends when a player wins. Two-player and 5–6 player behavior must be implemented later as separate profiles.

## Included match loop

A complete match includes:

1. create or join a private room;
2. host starts with three or four seats;
3. every player places two settlements and two adjacent roads in snake order;
4. the second settlement grants its adjacent starting resources;
5. players take turns rolling, resolving production or a seven, trading, building and playing development cards;
6. the engine maintains longest-road and largest-army awards;
7. the first eligible player to reach 10 victory points wins;
8. every connected browser receives the same revision while private hands and cards remain redacted.

## Explicit non-goals

- `two-player` and `extended-5-6` profiles;
- bots, spectators, public matchmaking, accounts, ranking or chat;
- persistence after the server process exits;
- expansions, scenarios or house rules;
- final artwork, audio or animation polish;
- timers, forced turns or automatic replacement of disconnected players.

## Board and supply

- The board has 19 land hexes, 54 vertices and 72 land edges.
- Terrain composition is 4 lumber, 4 wool, 4 grain, 3 brick, 3 ore and 1 desert.
- Eighteen number tokens use the standard 2–12 distribution without 7; 6 and 8 tokens may not be adjacent.
- The robber starts on the desert.
- Nine coastal ports are present: one 2:1 port for each resource and four generic 3:1 ports.
- Terrain, number and port assignments are deterministic for a recorded seed and generation version.
- The bank starts with 19 cards of each resource.
- Each player starts with 15 roads, 5 settlements and 4 cities in their piece supply.
- The development deck contains 14 knights, 5 hidden victory points, 2 road-building cards, 2 monopoly cards and 2 resource-choice cards.

Map topology is independent from map content. Vertices, edges, adjacency and coastlines belong to `map`; terrain production, port policy and deck/supply definitions are composed by `rulesets/base-3-4`.

## Initial placement

- Placement order is forward and then reverse: for A, B, C it is A, B, C, C, B, A.
- Each placement consists of one settlement followed by one road adjacent to that settlement.
- A settlement must use an empty vertex and obey the distance rule: every adjacent vertex is empty.
- Setup settlements do not need to connect to an existing road.
- A setup road must be on an empty edge touching the settlement just placed in that setup step.
- After a player's second settlement, the bank grants one resource for every adjacent producing terrain hex.
- When setup finishes, the first player enters `awaiting-roll` for turn 1.

## Turn and production

- A normal turn starts in `awaiting-roll` and ends only after the active player submits `EndTurn` from the action stage.
- The server records the two injected die results and their total. The client never generates a roll.
- A result other than 7 produces resources for every settlement or city adjacent to an unblocked matching token: settlements produce one and cities produce two.
- Production is transferred atomically from the bank. If a resource type cannot satisfy all production owed for that roll, nobody receives that resource type.
- After normal production the active player enters the action stage.
- Trading and building may be interleaved during the action stage.

## Rolling seven and robber

- A roll of 7 produces no resources.
- Every player holding more than 7 resource cards must discard half, rounded down.
- Discards can arrive in any player order. The robber cannot move until all required discards are complete.
- The active player must move the robber to a different hex.
- If one or more opponents with resource cards have a settlement or city adjacent to that hex, the active player selects one eligible victim.
- The stolen resource is selected by the injected random source, transferred atomically and revealed only to the two involved players.
- A played knight uses the same robber move/steal flow and then resumes the stage from which it was played.

## Building

| Item | Cost | Placement and effect |
| --- | --- | --- |
| Road | 1 brick + 1 lumber | Empty edge connected to the player's road or building network; an opponent building blocks continuity through that vertex. |
| Settlement | 1 brick + 1 lumber + 1 wool + 1 grain | Empty vertex obeying the distance rule and connected to one of the player's roads. Worth 1 victory point. |
| City | 2 grain + 3 ore | Replaces the player's own settlement. Worth 2 victory points total and produces two resources. |
| Development card | 1 wool + 1 grain + 1 ore | Draw the top deterministic card into the private hand. |

Every build validates phase, active player, cost, bank transfer, piece supply, ownership and topology before any state changes. A rejected command changes neither state nor revision.

## Trading

### Player trade

- Only the active player can open an offer during the action stage.
- The offer states non-empty resources given by the active player and non-empty resources requested from one opponent; it is broadcast to every other seated player.
- The active player cannot offer the same resource on both sides or offer cards they do not hold.
- Every opponent may independently accept or decline. A player may change their response while the offer remains open.
- Acceptance records intent only and transfers no resources. The proposer sees all pending, accepted and declined responses, then chooses exactly one accepted player.
- Completion revalidates both hands and performs one atomic two-way transfer. A stale or unaffordable completion is rejected without partial transfer.
- The active player may cancel the offer. A counteroffer is represented by cancelling/rejecting and opening a new offer, keeping the first implementation deterministic and auditable.
- Other players' hand composition remains hidden; the public offer, responses, selected participants and exact completed exchange are visible.

### Maritime trade

- Only the active player can trade with the bank during the action stage.
- Default ratio is 4:1; a generic port grants 3:1 and a matching resource port grants 2:1.
- The best applicable owned-port ratio is used for the resource being given.
- The bank must hold the requested resource and receives all cards offered in the same atomic transfer.

## Development cards

- A player may buy any number of development cards they can legally afford while the deck is non-empty.
- A non-victory development card cannot be played on the turn it was bought.
- At most one non-victory development card may be played in a turn.
- A playable card may be used before or after the roll unless another mandatory resolution is active.
- Knight: move the robber, optionally steal from an eligible victim and increment played-knight count.
- Road building: place up to two legal roads without paying resources, limited by piece supply.
- Monopoly: name one resource and transfer every opponent's cards of that type to the active player.
- Resource choice: take two available resources from the bank, either the same or different.
- Victory-point cards remain private and passive until the owner wins.

Random deck order and stolen resources are injected outcomes and appear in the private event/replay record; they are never chosen by the browser.

## Awards and victory

- Longest road requires a continuous route of at least five edges. Branches use the longest non-repeating edge path; an opponent building interrupts continuity through that vertex.
- Largest army requires at least three played knights.
- Each award is worth 2 victory points.
- A current award holder keeps the award on a tie. A challenger takes it only by becoming strictly greater. If an interrupted route leaves tied eligible challengers and no qualifying holder, the award is unowned.
- Public points include settlements, cities and held awards. Hidden victory-point cards are excluded from opponents' totals.
- During the active player's own turn, after every accepted command, the engine checks their actual total. At 10 or more points, it immediately emits the win and rejects further gameplay commands.

## Disconnection and history

- Refreshing or reconnecting restores the same seat and the latest player-safe snapshot while the server process remains alive.
- A disconnected player is not removed and their turn is not skipped. The game waits for them.
- Every accepted command has a unique command ID, expected revision and actor credential.
- Repeating an accepted command ID returns the original result rather than applying it twice.
- Public history shows rolls, exact production grants by player, builds, trade responses and completed exchanges, robber movement, awards and turn changes without exposing total private hand composition, stolen resource identity or unplayed development cards.

## Rule acceptance boundary

The profile is not complete until an automated deterministic replay starts from a three-player room, uses every major command family, reaches a legal winner and reproduces the same final state and event digest from the same seed and injected random tape.

Rule facts were checked against the official CATAN base-game materials available from [CATAN](https://www.catan.com/catan). This repository keeps its own concise executable interpretation and does not copy their presentation or prose.

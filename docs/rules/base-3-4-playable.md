# Base 3–4 playable rules

## Purpose

This document fixes the executable scope of the first complete playable version. It is a behavior contract for tests and implementation, not a reproduction of any commercial rulebook.

This document defines the `base-3-4` rule profile. A match has three or four human players, starts from an empty variable board and ends when a player wins. The 5–6 player behavior is implemented separately by `extended-5-6`; the two-player profile remains planned.

## Included match loop

A complete match includes:

1. create or join a private room and preview its server-generated map;
2. before starting, the host may choose a three- or four-seat limit, choose the victory target and reroll the preview map;
3. every player places two settlements and two adjacent roads in snake order;
4. the second settlement grants its adjacent starting resources;
5. players take turns rolling, resolving production or a seven, trading, building and playing development cards;
6. the engine maintains longest-road and largest-army awards;
7. the first eligible player to reach the room's configured victory target wins;
8. every connected browser receives the same revision while private hands and cards remain redacted.

## Explicit non-goals

- `two-player` and `extended-5-6` profiles;
- bots, spectators, public matchmaking, accounts, ranking or chat;
- persistence after the server process exits;
- expansions, scenarios or house rules;
- final artwork, audio or animation polish;
- automatic replacement of disconnected players or timeouts for mandatory discard/robber resolutions.

## Board and supply

- The board has 19 land hexes, 54 vertices and 72 land edges.
- Terrain composition is 4 lumber, 4 wool, 4 grain, 3 brick, 3 ore and 1 desert.
- Eighteen number tokens use the standard 2–12 distribution without 7; 6 and 8 tokens may not be adjacent.
- The robber starts on the desert.
- Nine coastal ports are present: one 2:1 port for each resource and four generic 3:1 ports.
- Terrain, number and port assignments are deterministic for a recorded seed and generation version.
- A seed evaluates a fixed set of valid map candidates and selects the best fairness score instead of accepting the first legal shuffle. The score balances production strength per terrain tile, competitive starting locations and terrain dispersion; it never changes the profile's component counts.
- While the room is waiting, every member sees the map generated from the room's authoritative seed. A host reroll replaces that seed; starting the game uses the currently previewed seed unchanged.
- The bank starts with 19 cards of each resource.
- Each player starts with 15 roads, 5 settlements and 4 cities in their piece supply.
- The development deck contains 14 knights, 5 hidden victory points, 2 road-building cards, 2 monopoly cards and 2 resource-choice cards.

Map topology is independent from map content. Vertices, edges, adjacency and coastlines belong to `map`; terrain production, port policy and deck/supply definitions are composed by `rulesets/base-3-4`.

## Lobby settings

- The default room limit is four players. The host may set it to three or four before the game starts, but never below the number of occupied seats.
- The default victory target is 10 points. The host may select any whole-number target from 5 through 15 before the game starts.
- Bank resource counts are public by default. Before starting, the host may hide live bank counts for all seats; this also applies to the extended profile. Hidden counts are redacted from HTTP/WebSocket projections, while resource icons and the bank effect anchor remain visible. Public action history and resource-transfer effects are unchanged, so this is not a promise that stock cannot be inferred from public actions. Supply, production and trade legality remain server-authoritative and unchanged.
- Only the host may change settings or reroll the map. Every mutation uses the current room revision, is broadcast to all members and is rejected after the game starts.
- The rule profile remains `base-3-4`; switching to a 5–6-player game selects the separate `extended-5-6` profile and regenerates its larger map and supplies.
- Before the game starts, an explicit leave releases that player's seat immediately. If the host leaves, ownership transfers to the earliest remaining seated player; if the last player leaves, the room is deleted.
- A vacated player color becomes available to the next joining player. Existing members keep their colors and relative seat order.

## Initial placement

- Placement order is forward and then reverse: for A, B, C it is A, B, C, C, B, A.
- Each placement consists of one settlement followed by one road adjacent to that settlement.
- A settlement must use an empty vertex and obey the distance rule: every adjacent vertex is empty.
- Setup settlements do not need to connect to an existing road.
- A setup road must be on an empty edge touching the settlement just placed in that setup step.
- After a player's second settlement, the bank grants one resource for every adjacent producing terrain hex.
- When setup finishes, the first player enters `awaiting-roll` for turn 1.

## Turn and production

- A normal turn starts in `awaiting-roll` and ends when the active player submits `EndTurn` from the action stage or when the server submits it at that stage's deadline.
- Initial settlement/road placement has no countdown. Once setup completes, the active primary player has 5 seconds to roll; expiry makes the server submit `RollDice` for that player.
- The normal action stage has one 120-second deadline. Commands that remain within the same action stage do not refresh it; expiry makes the server submit `EndTurn`, which also closes any unresolved trade.
- Mandatory discard, robber movement and free-road placement are untimed. Entering one of those stages removes the visible phase countdown; returning to roll or action starts that stage's deadline.
- Deadlines are server-owned. Clients receive the active player, deadline and server timestamp only to render the countdown and never submit an automatic timeout command themselves.
- Normal rolls draw from a 72-roll bag containing two copies of every ordered two-die outcome. This preserves the exact two-die distribution over each bag while reducing extreme single-match droughts. The server records both dice and their total; the client never generates a roll.
- The bag shuffle avoids three equal totals in a row and strongly penalizes long gaps for 6, 7 and 8. It never reacts to player position, resources, buildings or score.
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
- The offer states resources given by the active player and resources requested from one opponent; either side may be empty, but not both. It is broadcast to every other seated player.
- The active player cannot offer the same resource on both sides or offer cards they do not hold.
- Every opponent may independently accept or decline. A player may change their response while the offer remains open.
- Instead of accepting or declining, an opponent may keep one counteroffer that replaces their previous response. Counteroffers use the same resource-content rules as the original offer and are public to every seated player.
- Counteroffer terms are always recorded from the proposer's perspective: resources the proposer gives and resources the proposer receives. A counteroffer cannot itself be countered; the proposer may cancel and open a new offer when another negotiation round is needed.
- Acceptance records intent only and transfers no resources. The proposer sees all pending, accepted and declined responses, then chooses exactly one accepted player.
- Completion uses either the original terms accepted by the selected player or that player's current counteroffer. It revalidates both hands and performs one atomic transfer. A stale or unaffordable completion is rejected without partial transfer.
- The active player may cancel the offer. Responses do not reserve resources, and ending the turn closes any unresolved offer.
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
- Playing a non-victory development card is a public declaration. Monopoly's named resource and aggregate transfer, and resource choice's selected bank resources, are public outcomes; the protocol still withholds every opponent's remaining hand composition and monopoly contribution from other seats.

Random deck order and stolen resources are injected outcomes and appear in the private event/replay record; they are never chosen by the browser.

## Awards and victory

- Longest road requires a continuous route of at least five edges. Branches use the longest non-repeating edge path; an opponent building interrupts continuity through that vertex.
- Largest army requires at least three played knights.
- Each award is worth 2 victory points.
- A current award holder keeps the award on a tie. A challenger takes it only by becoming strictly greater. If an interrupted route leaves tied eligible challengers and no qualifying holder, the award is unowned.
- Public points include settlements, cities and held awards. Hidden victory-point cards are excluded from opponents' totals.
- Presentation warns once per player at three, two and one public points below the configured victory target (also in the extended profile). Only finalized public totals drive these warnings, never hidden cards. Setup and actual victory do not generate proximity popups; a jump skips weaker tiers, and award loss/recovery does not repeat them. This does not change scoring, turn eligibility or the victory check.
- During the active player's own turn, after every accepted command, the engine checks their actual total. At the room's configured target or more points, it immediately emits the win and rejects further gameplay commands.
- Normal-play score gains are presented from accepted score-bearing events. Initial setup placements are excluded from this celebratory feedback; paid settlements, city upgrades and acquired awards receive an explicit public score cue, while a hidden victory-point purchase is shown only to its owner.
- A finished match exposes a player-safe aggregate report: visible scoring sources, dice-total frequencies, resource cards gained/spent/traded/discarded, per-resource production and public activity counts. The winner text is selected deterministically from those scoring sources and does not generate or reveal hidden card identities.

## Disconnection and history

- Refreshing or reconnecting restores the same seat and the latest player-safe snapshot while the server process remains alive.
- A disconnected player is not removed. Roll and action deadlines still apply; setup and mandatory resolutions continue to wait for the required seat.
- Closing a tab is a disconnection, not an explicit leave. After the game starts, seats cannot be explicitly released because the deterministic match state still references every seated player.
- Every accepted command has a unique command ID, expected revision and actor credential.
- Repeating an accepted command ID returns the original result rather than applying it twice.
- Public history shows rolls, exact production grants by player, builds, trade responses and completed exchanges, robber movement, awards and turn changes without exposing total private hand composition, stolen resource identity or unplayed development cards.

## Rule acceptance boundary

The profile is not complete until an automated deterministic replay starts from a three-player room, uses every major command family, reaches a legal winner and reproduces the same final state and event digest from the same seed and injected random tape.

Rule facts were checked against the official CATAN base-game materials available from [CATAN](https://www.catan.com/catan). This repository keeps its own concise executable interpretation and does not copy their presentation or prose.

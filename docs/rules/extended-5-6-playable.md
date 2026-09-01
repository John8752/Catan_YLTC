# Extended 5–6 playable rules

## Profile boundary

`extended-5-6` is a separate playable rule profile for five or six players. It does not infer expansion behavior from player count. The lobby selects the profile explicitly, and the same profile composes map generation, supplies, turn policy and validation in `game-core`.

The implementation follows the current official 5–6 player extension rules published by CATAN Studio: [5–6 Player Extension rules (2023 PDF)](https://www.catan.com/sites/default/files/2024-03/Catan%20Game%205-6%20Rules%202022%20240313.pdf).

## Board and supplies

- The board contains 30 land hexes: 6 forest, 6 pasture, 6 fields, 5 hills, 5 mountains and 2 deserts.
- The 28 producing hexes receive number tokens. Sixes and eights may not be adjacent in generated maps.
- The coastline has 11 ports: five generic ports, one port for brick, lumber, grain and ore, and two wool ports.
- The robber starts on one of the two desert hexes selected deterministically by the seeded generator.
- As in the base profile, generation evaluates a fixed set of valid candidates and selects the best fairness score rather than accepting the first legal shuffle.
- The resource bank starts with 24 cards of each resource, for 120 resource cards total.
- The development deck contains 34 cards: 20 knights, 5 victory points, and 3 each of road building, monopoly and resource choice.
- Player piece supplies and build costs remain the same as the base profile.

Resource cards are finite. Production and resource-choice effects cannot take cards that the bank does not hold. If the bank cannot satisfy every claim for one resource type after a roll, nobody receives that resource type for that production event; other resource types still resolve normally.

## Setup

Players place two settlements and two roads in the same forward-then-reverse snake order used by the base profile. The second settlement grants one available resource from every adjacent producing hex.

The optional public setup analysis follows the same presentation-only contract as `base-3-4`: one comment per player and one entertainment-only winner prediction, generated from public setup facts without delaying play or entering deterministic game state.

## Paired-player turn

The profile uses the revised paired-player turn instead of the retired special build phase.

1. The primary player rolls, resolves production or seven/robber handling, then may trade with players or the bank, build and play at most one development card.
2. When the primary player ends their action, the player third to their left becomes the paired player for the same turn number.
3. The paired player does not roll. They may trade only with the bank or their ports, build, play at most one development card, and then end their action.
4. The next primary player is the player immediately to the left of the previous primary player. A new turn number begins and dice must be rolled.

The primary roll uses the same 5-second server deadline as `base-3-4`. Both the primary action and paired-player action receive their own 120-second server deadline; expiry ends only the currently active half-turn. Setup and mandatory resolution stages remain untimed.

Only primary-player rolls consume the shared 72-roll balanced dice bag. Paired-player actions never advance it.

If the primary player reaches the victory target, the game ends before the paired player acts. This preserves primary-player priority from the official paired-player rule.

## Determinism and projections

Terrain, numbers, ports and development cards are derived from the recorded room seed. The server remains authoritative for both halves of a paired turn. Public projections identify paired action explicitly so the browser can hide player-to-player trade controls without deciding legality itself.

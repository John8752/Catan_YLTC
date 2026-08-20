# Rules foundation

## Current interpretation

M0 implements a deterministic board and an explicit state shell, not a complete game. Its purpose is to make later rules executable without coupling them to React or networking.

Two rule profiles are playable: `base-3-4` accepts three or four players, and `extended-5-6` accepts five or six players with a larger board, expanded supplies and paired-player turns. The two-player profile remains planned and unsupported until its own rule note and tests land.

## State phases

- `lobby`: seats may join; no board exists yet.
- `setup`: the board exists and initial placements will be collected in snake order.
- `turn`: production and player actions occur after setup is complete.
- `finished`: the winner is fixed and gameplay commands are rejected.

M0 starts a room in `setup` and records the first player expected to place. Placement commands land in the next milestone.

## Randomness

Board terrain, number and port assignments are generated from an explicit integer seed. Map generation evaluates a fixed number of deterministic candidates and selects the highest-scoring valid candidate; the score favors even per-tile resource production, enough competitive starting intersections and dispersed terrain while preserving the profile's exact component counts. Sixes and eights remain non-adjacent hard constraints.

Normal turn rolls use a deterministic 72-roll balanced bag made from two complete sets of the 36 ordered outcomes of two six-sided dice. Every face pair therefore appears exactly twice per bag. Candidate shuffles are scored to avoid three equal totals in a row and excessive gaps between common totals without changing the bag's exact probability distribution. The bag is independent from map generation and ordinary command revision counts. Tests may still inject explicit random outcomes for focused rule and replay coverage.

Development-card decks, robber steals and any future shuffles continue to use the injected-randomness policy. No random result may depend on React or ambient browser randomness.

## Hidden information

A player's exact resource hand is private. Other players receive only its total card count. The same policy will apply to unplayed development cards.

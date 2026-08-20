# Rules foundation

## Current interpretation

M0 implements a deterministic board and an explicit state shell, not a complete game. Its purpose is to make later rules executable without coupling them to React or networking.

The first supported rule profile is `base-3-4`. It accepts three or four players. The two-player and extended 5–6 player profiles are named now but remain unsupported until their rule notes and tests land.

## State phases

- `lobby`: seats may join; no board exists yet.
- `setup`: the board exists and initial placements will be collected in snake order.
- `turn`: production and player actions occur after setup is complete.
- `finished`: the winner is fixed and gameplay commands are rejected.

M0 starts a room in `setup` and records the first player expected to place. Placement commands land in the next milestone.

## Randomness

Board terrain order is generated from an explicit integer seed. Number tokens use a stable sequence in M0. Dice, development-card decks and any future shuffles must use the same injected-randomness policy.

## Hidden information

A player's exact resource hand is private. Other players receive only its total card count. The same policy will apply to unplayed development cards.

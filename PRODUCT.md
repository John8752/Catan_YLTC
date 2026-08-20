# Product

## Product purpose

Catan YLTC is a synchronous browser board game for private groups of 2–6 people. A player should be able to open a link, choose a display name, enter a room and finish a match without installing software or creating an account.

The first production path proves a complete, reliable 3–4 player base-rules match. Two-player and 5–6 player play are separate rule profiles built on the same deterministic engine.

## Player fantasy and verbs

Players grow a settlement network on a shared island by producing resources, negotiating trades, building roads and settlements, upgrading cities and disrupting opponents with the robber.

Primary verbs:

- join and ready up;
- place, roll, trade, build and end turn;
- discard and move the robber when required;
- inspect public history without revealing private hands;
- reconnect to the same seat after a network interruption.

## Product principles

- Rules correctness and shared-state consistency come before animation and art.
- The server decides legality and exposes a player-specific view of the game.
- A room link and display name are enough for the first release.
- The board remains the dominant visual surface; secondary information stays in compact DOM panels.
- Every match can be reproduced from its initial seed and recorded command/event history.
- Desktop and mobile browsers are supported from the first playable slice.

## Rule profiles

- `base-3-4`: first complete rules target.
- `two-player`: planned variant with its own setup and turn policy.
- `extended-5-6`: planned larger-board profile with its own paired-turn policy.

Player count is never used as a substitute for a named rule profile.

## M0 scope

- pnpm monorepo and validation gate;
- deterministic 19-hex board generation;
- explicit lobby/setup/turn/finished phase model;
- player-safe public/private projections;
- in-memory room create, join, start and live state broadcast;
- React/SVG board shell with a compact room HUD;
- tests for determinism, board composition and information redaction.

## Explicit non-goals for M0

- complete building, trading, robber and development-card rules;
- accounts, public matchmaking, ranking, spectators or bots;
- durable room recovery after the server process exits;
- expansions beyond player-count rule profiles;
- final artwork, sound, monetization or public deployment;
- copying official artwork, logos or rulebook text.

## Visual direction

The interface should feel like a warmly lit wooden game table: parchment surfaces, muted ocean blue, pine green, terracotta and wheat accents. Geometry is crisp and tactile, motion is restrained, and the result must not resemble an admin dashboard.

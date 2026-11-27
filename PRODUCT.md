# Product

## Product purpose

YLTC is a synchronous browser tabletop hub for private groups. A player opens the site, chooses a game and display name, shares a room code and completes a match without installing software or creating an account.

## Platform and supported games

- **Platform**: optional accounts, anonymous entry, one authoritative room directory, membership/host succession, seat recovery, safe per-player transport and game-scoped final settlements. A room selects `gameId` at creation and cannot switch it. Finished rooms may return to their own lobby; every subsequent start gets a new `matchId`.
- **Catan (`catan`)**: 2–6 players, its existing rule profiles, island renderer, trade, hidden cards, history and victory summaries. The historical milestones below describe this game only.
- **Drawing telephone (`draw-guess`, 传画猜词)**: 3–6 players, each choosing one of six word-bank prompts and drawing their own opening, then alternating guesses (with character-count hints) and drawings. Private checkpointed drafts, authoritative deadlines, automatic shared reveal with a text system host and a finished gallery. Original prompts and rules inspired by the genre; no licensed assets or rulebook text.
- **Carcassonne (`carcassonne`, 卡卡颂)**: 2–5 players, 72 base tiles, seven followers per player, connected roads/cities/monasteries and final farmer scoring. Authoritative atomic tile-and-follower turns, player-safe deck redaction, final score settlements and same-room replay. Portrait-first Three.js 3D miniatures with actual lighting/shadows, pan/pinch, camera rotation/overhead mode, placement previews, region inspection and explicit confirmation; SVG compatibility fallback. No expansions or official artwork.
- **Camel race (`camel-up`, 骆驼大赛)**: 3–6 players, second-edition-inspired stacking race with leg tickets, secret finish bets, spectator tiles, crazy camels and six-player partnerships. Original real-time 3D toy diorama, camera rotation/zoom, server-safe action feedback and final coin results.
- **Texas hold’em (`texas-holdem`, 德州扑克)**: 2–9 players, virtual-chip no-limit play with a fixed-blind hand-count mode and a progressive-blind tournament mode. Private hole cards, authoritative betting, side pots, showdown and final rankings. See [Poker rules](docs/rules/texas-holdem.md).
- Voice chat remains external. HTTPS, microphone capture, public matchmaking, spectators, AI drawing and durable live-game recovery are not part of this milestone.

Current cross-game plan and ownership: [Platform and game roadmap](docs/multi-game-plan.md). Drawing rules: [Draw-guess](docs/rules/draw-guess.md).

The historical Catan production path proves a complete, reliable 3–4 player base-rules match. Two-player and 5–6 player play are separate rule-profile targets built on that game's deterministic engine.

## Catan: player fantasy and verbs

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
- The game surface remains dominant; secondary information stays in compact DOM panels. Catan uses SVG; drawing telephone uses Canvas 2D for drawing and DOM for text and controls.
- Game cores are deterministic given explicit inputs. Tests may record commands for replay; production does not persist live command history or private drawing content.
- Desktop and mobile browsers are supported from the first playable slice.

## Catan: rule profiles

- `base-3-4`: first complete rules target; seats two to four, all playing the same game.
- `two-player`: planned *variant* with its own setup and turn policy. Not what a two-seat match uses today.
- `extended-5-6`: playable larger-board profile with expanded supplies and its own paired-turn policy.
- `large-5-6`: optional custom 37-hex island for five to six players, using the extension's supplies and paired-turn policy.

Player count is never used as a substitute for a named rule profile.

## Catan: historical M0 scope

- pnpm monorepo and validation gate;
- deterministic 19-hex board generation;
- explicit lobby/setup/turn/finished phase model;
- player-safe public/private projections;
- in-memory room create, join, start and live state broadcast;
- React/SVG board shell with a compact room HUD;
- tests for determinism, board composition and information redaction.

## Catan: explicit non-goals for historical M0

- complete building, trading, robber and development-card rules;
- accounts, public matchmaking, ranking, spectators or bots;
- durable room recovery after the server process exits;
- expansions beyond player-count rule profiles;
- final artwork, sound, monetization or public deployment;
- copying official artwork, logos or rulebook text.

## Platform: post-M0 account milestone

Accounts are an optional enhancement rather than a new entry requirement. Guest players must still be able to open a link, choose a display name and enter a room without registering. A registered account provides a durable profile and one active login across devices; the newest successful login takes over any live room seat and invalidates the previous device. Account persistence also includes final match settlements, partitioned by game type (`gameId`) with a unique `matchId` and versioned game-specific payload. Only completed results are durable; this does not imply room or in-progress match recovery. Accounts are shared identities across `catan` and `draw-guess`; each game owns its versioned final-result payload. Drawing telephone stores contribution counts, not drawings, phrases or drafts.

## Visual direction

Platform entry uses an original, lazily loaded Three.js miniature tabletop that changes with the selected game. Room waiting screens share readable DOM membership, room-code, settings and start controls while keeping game-owned previews: Catan's actual server-provided SVG map with zoom/reroll and optional production analysis, drawing telephone's paper presentation, 3D camel/Carcassonne miniatures and a poker table with an undealt deck. A decorative homepage model is never the authoritative match map. See [Lobby design](docs/design/platform-lobby.md).

All games share self-hosted Noto Sans SC Variable for body text, controls, player names and board labels. The homepage invitation and static game names use a small, self-hosted weight-600 subset of Noto Serif SC (internally named YLTC Table Serif); Camel Up retains Smiley Sans for its display voice. Functional headings use sans semibold; body is regular and labels medium, with 16px body, 14px controls and 13px supporting-text roles. Dense game annotations retain their game-specific scale. Room codes and countdowns may use a monospace stack with the same Chinese fallback. Fontsource's Unicode-range sans subsets and the static display subset load from the website's own origin with `font-display: swap`; no external font CDN is required. The SIL OFL licenses ship at `/fonts/NotoSansSC-OFL.txt` and `/fonts/NotoSerifSC-OFL.txt`.

The interface should feel like a warmly lit wooden game table: parchment surfaces, muted ocean blue, pine green, terracotta and wheat accents. Geometry is crisp and tactile, motion is restrained, and the result must not resemble an admin dashboard.

## Camel race: mobile and art direction

Primary use is portrait phones from the iPhone 14 generation, with iPhone 16 / 16 Pro Max full-canvas and browser-area acceptance. The user chose the existing Catan interaction pattern: compact seats and dice above a fitted playfield, a bottom action dock, and Radix disclosures for detailed decisions. The user explicitly rejected a flat 2D board: Camel race uses a real 3D miniature desert with sculpted camels, physical stacks, warm light, a tiled track, pyramid and oasis. Camera gestures never change legality. See ADR-0016 for WebGL and SVG fallback boundaries.

The game's display voice is self-hosted Smiley Sans (得意黑), paired with the existing self-hosted Noto Sans SC Variable for clear body and control text. The user rejected the earlier handwriting-style pairing. Camels are single-piece, beveled wooden meeples: one broad hump and a compact neck, without separate thin limbs, eyes or saddle decorations; 3D pieces, portraits and SVG fallback share one silhouette. Font licenses ship with the fonts. Its display face remains scoped to Camel Up headings and game names. Each accepted action gets distinct meaningful feedback; emphasize the acting seat, roll outcome and settlements. No past action animation replays on reconnect; reduced motion preserves the static result.

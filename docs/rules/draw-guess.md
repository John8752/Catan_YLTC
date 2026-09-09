# Draw-guess: original drawing telephone

Scope: `draw-guess`, not official Telestrations rules or assets.

## Room and round

- The game is chosen at room creation and locked. A match starts with 3–6 seated players. All participants use their own browser; voice chat is external.
- The host starts with the current seat order. Each player begins one album by choosing an original suggested phrase or entering a phrase (1–80 characters).
- There are exactly N steps for N players, numbered 0 through N−1. Step 0 is text; odd steps draw; subsequent even steps guess. At step s, player i works on album `(i − s + N) % N`. Every player contributes once to every album. Odd-sized groups finish on a guess, even-sized groups finish on a drawing; neither requires a repeated contributor.
- Everyone works simultaneously. A player sees only their current preceding page, their own draft and public submission status. Other albums, earlier pages and other drafts remain hidden.
- Submitting locks that page. The last required submission advances the whole group. Repeated submission cannot add or replace a page, including retries after the step has advanced.
- Text/guess deadline defaults to 60 seconds and drawing to 90 seconds; host may choose supported durations in the lobby. On expiry the server commits the latest accepted non-empty draft, or a visible missing-page placeholder. Disconnected players therefore do not block progress.
- A draft is private, replaceable using a monotonically increasing sequence within its task. The browser checkpoints it to the server and retains a local copy scoped to room, match, player and task. Stale drafts cannot overwrite newer drafts or finalized pages.

## Reveal and replay

- After N steps, reveal starts with no pages exposed. The host reveals the next page, one at a time, album by album; all clients share the same cursor. Only revealed pages are transmitted. No countdown during reveal.
- After the last page the match finishes. Everyone can browse the entire gallery. There is no score or invented winner; the activity's result is its completed albums.
- The host can return a finished room to the lobby and start a new match of the same game. It clears live pages/drafts, changes match ID on the next start, and preserves seated players. In-progress games cannot be silently reset.
- Host succession follows lobby membership rules. A host who disconnects retains their seat and can reconnect; there is no automatic transfer or authority for another player to reveal private content.

## Drawing limits

Drawings are strokes on a fixed logical 800×600 canvas, displayed at any CSS size. Colors and widths are whitelisted; coordinates are finite and bounded. Limit strokes and points per page and request size. No arbitrary SVG, remote image, HTML or uploaded base64 payload. Empty pages require explicit missing-page treatment at timeout, not a falsely successful submission.

## Determinism and persistence

Word suggestions use an injected seed. Core accepts explicit commands for drafts, submissions, expiry and reveal; it has no clock, transport, browser or account dependencies. The server records deadline ownership and rejects an old match/step callback. Final version-1 account settlement contains participant names and contribution counts, never secret drafts or image bodies. Live content is not durably stored.

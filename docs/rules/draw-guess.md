# Draw-guess: original drawing telephone

Scope: `draw-guess`, not official Telestrations rules or assets.

## Room and round

- The game is chosen at room creation and locked. A match starts with 3–6 seated players. All participants use their own browser; voice chat is external.
- The host starts with the current seat order. Each player receives six distinct seeded word-bank options, selects one and draws it themselves. Free-form opening prompts are forbidden. Selection and drawing are one private, checkpointed opening task and one album entry; both are required to submit. Players may change their choice before submitting.
- There are exactly N steps for N players, numbered 0 through N−1. Step 0 is selection plus drawing; odd steps guess; subsequent even steps draw. At step s, player i works on album `(i − s + N) % N`. Every player contributes once to every album. Odd-sized groups finish on a drawing, even-sized groups on a guess.
- Guessers see only the preceding drawing and the character count of the phrase that drawing was based on (the selected opening word or the immediately preceding guess). Count Unicode code points, excluding whitespace; this is a hint, not an enforced answer length. Missing source text gives no hint. The source phrase itself remains private.
- Everyone works simultaneously. A player sees only their current preceding page, their own draft and public submission status. Other albums, earlier pages and other drafts remain hidden.
- Submitting locks that page. The last required submission advances the whole group. Repeated submission cannot add or replace a page, including retries after the step has advanced.
- Guess deadline defaults to 60 seconds and drawing (including opening selection) to 90 seconds; host may choose supported durations in the lobby. On expiry the server commits the latest accepted non-empty draft, or a visible missing-page placeholder. An opening draft must have both a bank choice and ink to be collected. Disconnected players therefore do not block progress.
- A draft is private, replaceable using a monotonically increasing sequence within its task. The browser checkpoints it to the server and retains a local copy scoped to room, match, player and task. Stale drafts cannot overwrite newer drafts or finalized pages.

## Reveal and replay

- After N steps, reveal starts with no pages exposed and a system host introduction. The server automatically reveals one entry every six seconds, album by album; the opening entry shows its original word and first drawing together. Everyone shares the cursor and countdown, even when the room owner disconnects. Only revealed entries are transmitted. The final entry remains on screen for six seconds before finishing. Players cannot advance the cursor.
- A text-based system host briefly explains the rules in the lobby and uses a fixed repertoire during reveal. Commentary compares only already-revealed text, ignoring whitespace and punctuation; it never claims to recognize drawings or judge synonyms. A first changed guess may get “哈哈哈，前面都对了，到你这楼歪了”; a complete album with all guesses matching and no missing pages gets “真厉害，一路都对”. Missing entries and continuing detours have separate neutral/playful lines. No AI service or audio permission is needed.
- After the last page the match finishes. Everyone can browse the entire gallery. There is no score or invented winner; the activity's result is its completed albums.
- The host can return a finished room to the lobby and start a new match of the same game. It clears live pages/drafts, changes match ID on the next start, and preserves seated players. In-progress games cannot be silently reset.
- Host succession follows lobby membership rules. A host who disconnects retains their seat and can reconnect; automatic reveal does not depend on their connection.

## Drawing limits

Drawings are strokes on a fixed logical 800×600 canvas, displayed at any CSS size. Colors and widths are whitelisted; coordinates are finite and bounded. Limit strokes and points per page and request size. No arbitrary SVG, remote image, HTML or uploaded base64 payload. Empty pages require explicit missing-page treatment at timeout, not a falsely successful submission.

## Determinism and persistence

Word suggestions use an injected seed. Core accepts explicit commands for drafts, submissions, expiry and reveal; it has no clock, transport, browser or account dependencies. The server records deadline ownership and rejects an old match/step callback. Final version-1 account settlement contains participant names and contribution counts, never secret drafts or image bodies. Live content is not durably stored.

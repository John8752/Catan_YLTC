# Draw-guess: original drawing telephone

Scope: `draw-guess`, not official Telestrations rules or assets.

## Room and round

- The game is chosen at room creation and locked. A match starts with 3–6 seated players. All participants use their own browser; voice chat is external.
- The host starts with the current seat order. Each player receives six distinct seeded word-bank options, selects one and draws it themselves. Free-form opening prompts are forbidden. Selection and drawing are one private, checkpointed opening task and one album entry; both are required to submit. Players may change their choice before submitting.
- There are exactly N steps for N players, numbered 0 through N−1. Step 0 is selection plus drawing; odd steps guess; subsequent even steps draw. At step s, player i works on album `(i − s + N) % N`. Every player contributes once to every album. Odd-sized groups finish on a drawing, even-sized groups on a guess.
- Guessers see only the preceding drawing and the required character count of the phrase that drawing was based on (the selected opening word or the immediately preceding guess). Count Unicode code points, excluding whitespace (punctuation counts). Both manual submissions and timeout collection must match this count exactly. Editable drafts may be incomplete; an incorrect-length draft becomes a missing page at expiry. Missing source text gives no required count; a non-empty guess is still allowed. The source phrase itself remains private.
- Everyone works simultaneously. A player sees only their current preceding page, their own draft and public submission status. Other albums, earlier pages and other drafts remain hidden.
- Submitting locks that page. The last required submission advances the whole group. Repeated submission cannot add or replace a page, including retries after the step has advanced.
- Guess deadline defaults to 60 seconds and drawing (including opening selection) to 90 seconds; host may choose supported durations in the lobby. On expiry the server commits the latest accepted non-empty draft that meets submission requirements, or a visible missing-page placeholder. An opening draft must have both a bank choice and ink to be collected. Disconnected players therefore do not block progress.
- A draft is private, replaceable using a monotonically increasing sequence within its task. The browser checkpoints it to the server and retains a local copy scoped to room, match, player and task. Stale drafts cannot overwrite newer drafts or finalized pages.

## Reveal and replay

- After N steps, reveal starts with no pages exposed and a two-second system host introduction. The server then automatically reveals one entry every four seconds, album by album; the opening entry shows its original word and first drawing together. Commentary appears with the page and adds no extra wait. Everyone shares the cursor and countdown, even when the room owner disconnects. Only revealed entries are transmitted. The final entry remains on screen for four seconds before finishing. Players cannot advance the cursor.
- Every seated participant may repeatedly react to any revealed non-missing page with thumbs up or thumbs down, including their own pages and the finished gallery. Each distinct click adds one to that page's corresponding shared count; these are click totals, not unique voters or toggle votes. Retrying the same command does not count twice. The server rejects unrevealed, missing, out-of-match or invalid targets. Reactions do not advance/reset deadlines, alter content, affect settlements or reveal hidden pages. Counts live only in the current in-memory match and reset on a new match.
- A text-based system host briefly explains the rules in the lobby and uses a fixed repertoire during reveal. Commentary compares only already-revealed text, ignoring whitespace and punctuation; it never claims to recognize drawings or judge synonyms. A first changed guess may get “哈哈哈，前面都对了，到你这楼歪了”; a complete album with all guesses matching and no missing pages gets “真厉害，一路都对”. Missing entries and continuing detours have separate neutral/playful lines. No AI service or audio permission is needed.
- After the last page the match finishes. Everyone can browse the entire gallery. There is no score or invented winner; the activity's result is its completed albums.
- The host can return a finished room to the lobby and start a new match of the same game. It clears live pages/drafts, changes match ID on the next start, and preserves seated players. In-progress games cannot be silently reset.
- Host succession follows lobby membership rules. A host who disconnects retains their seat and can reconnect; automatic reveal does not depend on their connection.

## Drawing limits

Drawing pages carry an optional whitelisted solid background and optional pen/eraser stroke tools. Legacy pages default to white with pen strokes. Eraser strokes remove earlier ink independently of the background color; painting later may cover erased areas. Changing the background is a page-wide change, not a fill stroke. Backgrounds, erasers and widths survive drafts, seat recovery, submissions, next-player previews and reveal. A background or eraser-only page does not count as a drawing; at least one pen stroke is required (core does not rasterize overlapping strokes to judge visual content).

The client offers a compact color/pen-size/eraser/background toolbar plus undo and redo. Each complete pointer gesture, background change and clear action is one history entry. New drawing edits clear redo; selecting a tool or color does not. History is local to the current mounted task, bounded to 100 entries, and resets on reload or authoritative replacement; the current draft itself still recovers. Clear removes strokes while retaining the background and can be undone/redone.

Drawings are strokes on a fixed logical 800×600 canvas, displayed at any CSS size. Colors and widths are whitelisted; coordinates are finite and bounded. Limit strokes and points per page and request size. No arbitrary SVG, remote image, HTML or uploaded base64 payload. Empty pages require explicit missing-page treatment at timeout, not a falsely successful submission.

## Reveal presentation

Each revealed album is a conversation in contribution order. A player speaks in first person: the opening identifies their chosen subject and shows their drawing; guesses state their answer; later drawings identify the immediately preceding phrase and show how they drew it. Missing pages are described neutrally. Player names and simple generated initials identify speakers; the viewer's own messages align to the right. A host introduction opens the album and a host bubble follows each contribution. These statements and comments are projected exclusively from the revealed prefix, never from unrevealed pages. Historical commentary stays with its page in the finished gallery. The existing shared 2s introduction / 4s page timing and repeated thumbs reactions remain.

## Determinism and persistence

Word suggestions use an injected seed. Core accepts explicit commands for drafts, submissions, expiry, reveal and reactions; it has no clock, transport, browser or account dependencies. The server records deadline ownership and rejects an old match/step callback. Final version-1 account settlement contains participant names and contribution counts, never secret drafts, image bodies or reaction counters. Live content is not durably stored.

## Word bank

Six choices per player are drawn without replacement from an original noun-focused bank. Each set includes three regional nouns (from different regions), two birthday/everyday nouns and one playful original phrase. Themes cover Hangzhou, Beijing, Chengdu, Dallas, the Philippines, Chongqing and Guiyang; everyday and birthday objects keep the bank approachable. Regional names are researched, not copied from a commercial game's word list. Research sources and editorial choices live in [Word-bank sources](../draw-guess-word-sources.md).

## 超时收稿的轮次边界

一次到期只处理到期前这一轮尚未交稿的任务。即使补上最后一份稿后已经进入下一轮，也必须停止处理这一轮以外的任务。上一轮已交稿的玩家在下一轮仍应获得完整创作时间，不能被旧倒计时记为缺页。

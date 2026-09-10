# Draw-guess: original drawing telephone

Scope: `draw-guess`, not official Telestrations rules or assets.

## Room and round

- The game is chosen at room creation and locked. A match starts with 3–6 seated players. All participants use their own browser; voice chat is external.
- The host starts with the current seat order. Each player receives six distinct seeded word-bank options, selects one and draws it themselves. Free-form opening prompts are forbidden. Selection and drawing are one private, checkpointed opening task and one album entry; both are required to submit. Players may change their choice before submitting.
- Each batch contains three playful subject/action combinations and three simple nouns (one regional-theme, one birthday, one everyday). Before submitting the opening, a player may request another batch. The server deterministically replaces all six, excluding the previous batch and other players' current choices. Refreshing clears the selected word but checkpoints the existing strokes/background; the player must select a new word before submitting. It does not reset the deadline or affect anyone else's task. Retrying the same refresh receipt does not reroll again, and older draft checkpoints cannot restore the previous selection.
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

## Work presentation

Opening selection is a required modal dialog with six choices and “换一批”. There is no close/skip action; Escape and outside taps do not dismiss it. The canvas, toolbar and submit action mount only after choosing a word. Before submitting, “换词” reopens the same required selection dialog. A timed-out opening advances through the authoritative expiry flow even if its picker is open.

Drawing tasks fit the current viewport, including phone browser bars and safe-area padding. The canvas stays near the top, preserves its 4:3 ratio, and shares one screen with the prompt, toolbar and submit action. Room members/account controls move into a room dialog during play. Clear joins the same toolbar row as undo/redo.

Draft checkpoints and local recovery run silently. Routine saving/saved/retry statuses are not displayed or announced, and the full-width submit button keeps the same bounds while saving. Actual submission failures still show an actionable error and allow retry.

The guess field's computed font size is at least 16 CSS pixels, including beneath the legacy global form font reset, to avoid iOS focus zoom. It still follows larger user font settings. Browser magnification remains available; viewport scale restrictions are not used as a substitute for readable form text.

## Reveal presentation

Live reveal is one continuous feed of the server-projected prefix: each contribution is appended below previous contributions, and each newly opened album is appended below previous albums. Earlier entries retain their natural height and position; no temporary viewport-sized spacer is attached to the current entry. Album filtering is available only after the shared reveal finishes. Finishing retains the full feed and reveals the completion/browsing controls below it.

Each new reveal follows the newly appended contribution, scrolling only as far as needed to show it; a contribution taller than the viewport starts at its top. Reduced-motion preference disables smooth scrolling. Reconnect follows the latest revealed contribution. Reaction updates do not change scroll or focus. After completion, manually selecting an album resets to the heading; choosing all albums restores the complete feed.

Each revealed album is a conversation in contribution order. A player speaks in first person: the opening identifies their chosen subject and shows their drawing; guesses state their answer; later drawings identify the immediately preceding phrase and show how they drew it. Missing pages are described neutrally. Player names and simple generated initials identify speakers; the viewer's own messages align to the right. An owner heading opens each album and a host bubble follows each contribution. These statements and comments are projected exclusively from the revealed prefix, never from unrevealed pages. Historical commentary stays with its page in the finished gallery. The existing shared 2s introduction / 4s page timing and repeated thumbs reactions remain.

## Determinism and persistence

Word suggestions use an injected seed. Core accepts explicit commands for drafts, submissions, expiry, reveal and reactions; it has no clock, transport, browser or account dependencies. The server records deadline ownership and rejects an old match/step callback. Final version-1 account settlement contains participant names and contribution counts, never secret drafts, image bodies or reaction counters. Live content is not durably stored.

## Word bank

Six choices per player are drawn without replacement from an original noun-focused bank. Each set includes three regional nouns (from different regions), two birthday/everyday nouns and one playful original phrase. Themes cover Hangzhou, Beijing, Chengdu, Dallas, the Philippines, Chongqing and Guiyang; everyday and birthday objects keep the bank approachable. Regional names are researched, not copied from a commercial game's word list. Research sources and editorial choices live in [Word-bank sources](../draw-guess-word-sources.md).

The simplified bank contains 96 nouns and 990 subject/action combinations (30 subjects × 33 actions). Prefer familiar silhouettes and a single visible action. Remove exact landmarks, obscure food names and near-identical party supplies that require written labels to distinguish. Regional pools are loose editorial associations, not a requirement to identify a city or a specific local specialty. Six-choice distribution and deterministic dealing remain unchanged.

Personalized phrase subjects include the user-provided names 祥子、静雯、大鹏、大靖、丁丁、踢踢 alongside the eight existing characters. 潜水、做饭、抠脚、偷看、大笑 join the eight existing actions. Any subject may combine with any action; these are playful prompts, not claims about what a named person actually did, and are not bound to the submitting player's identity.

The additional 20 actions use recognizable poses or familiar props: 刷牙、洗脸、洗澡、喝水、吃面、吃冰淇淋、吃棒棒糖、扫地、拖地、浇花、看书、画画、拍照、打电话、唱歌、打鼓、打篮球、举哑铃、跳绳、荡秋千. All previously supported actions remain available.

Sixteen childhood-animation subjects join the same phrase pool: 哆啦A梦、皮卡丘、蜡笔小新、龙猫、海绵宝宝、派大星、章鱼哥、米老鼠、唐老鸭、史迪奇、孙悟空、哪吒、葫芦娃、黑猫警长、喜羊羊、灰太狼. These are editorial choices for this group's requested nostalgic theme, prioritizing distinct silhouettes or iconic props. 孙悟空 refers here to the Journey to the West character. Each combines with all 33 actions; no separate standalone-character slot or additional hint is introduced.

The everyday pool also includes 24 simple emoji-inspired nouns: 虾、螃蟹、章鱼、鱼、葡萄、梨、桃子、樱桃、柠檬、橙子、胡萝卜、茄子、黄瓜、蘑菇、汉堡、披萨、薯条、热狗、甜甜圈、饼干、糖果、棒棒糖、冰淇淋、鸡腿. 煎蛋 was already present and is not duplicated. Emoji shapes guide editorial selection; prompts remain plain Chinese text and do not display an emoji answer hint.

## 超时收稿的轮次边界

一次到期只处理到期前这一轮尚未交稿的任务。即使补上最后一份稿后已经进入下一轮，也必须停止处理这一轮以外的任务。上一轮已交稿的玩家在下一轮仍应获得完整创作时间，不能被旧倒计时记为缺页。

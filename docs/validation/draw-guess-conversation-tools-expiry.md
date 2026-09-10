# Draw-guess conversation, drawing tools and expiry boundary

Date: 2026-09-10. Scope: draw-guess core, protocol, server, web and browser. No Catan gameplay regression was selected. Current working changes also include the preceding exact-length guesses, word-bank and reactions feature.

## Behavior

- Reveal presents first-person player messages, drawings and a host comment following each contribution. Protocol derives both messages from only the revealed prefix; historical comments remain stable.
- Drawing tools provide color, pen size, eraser size, background, undo, redo and undoable clear. Erasing removes ink independently of the background. These fields survive checkpoint/reload, submit, next-player projection and reveal. Color selection does not include selecting or moving existing content.
- Expiry freezes the task set from the expiring state. Previously, when the last pending seat occurred before already-submitted seats in iteration order, its commit advanced the phase; the remaining loop then committed missing pages for those seats in the new round. The fix reads tasks, drafts and length requirements from the original state while accumulating commits separately.

## Reproduction and verification

The new core expiry test failed before the fix for 3, 4, 5 and 6 players: expiring step 0 with only the first seat pending produced two pages in an album instead of one. After the fix, 614 combinations of round, player count and nonempty pending-seat subsets pass. The server fake-timer test verifies that every next-round task starts unsubmitted with its complete deadline and remains submittable.

Commands actually run:

- `pnpm test:plan`: draw-guess across four implementation layers and browser.
- `pnpm test:draw-guess --layer core -t "expires only the old round"`: failed before the fix; 4 tests passed after it.
- `pnpm test:draw-guess --layer server -t "starts a full unsubmitted round"`: passed after correcting the test to inspect every unsubmitted task before submitting any guesses.
- `pnpm validate:draw-guess --build`: passed. 24 core, 7 protocol, 12 server and 7 web tests; 6 architecture and 4 insecure-context static checks; all affected package type checks and production builds.
- `pnpm test:e2e:draw-guess drawing-tools.spec.ts gallery.spec.ts`: 10 passed. Pixel checks prove erasing reveals the changed background and undo/redo restores complete gestures, clear and background changes. Reload and server projection retain the result. First-person speech and interspersed host ordering are checked on desktop and all primary phone cases.
- `pnpm test:e2e:draw-guess play.spec.ts`: 9 passed. Six independent browsers complete all rounds, recover, react, reveal, reconnect and replay; 4- and 6-player phone cases exercise selection, touch input, draft recovery, hints and reveal.
- `pnpm test:e2e:draw-guess expiry.spec.ts`: 1 passed with an actual 60-second server deadline. Other seats submit while the first seat leaves a saved draft. Both browsers receive editable next-round guessing tasks and can submit normally.
- `pnpm test:inventory` and `git diff --check`: passed.

Browser tests launched isolated servers on 8794/5184 with in-memory SQLite. The play suite started before the expiry fix, so the separate expiry test launched a fresh server after the fix. No live development room/database was used for acceptance.

## Visual acceptance and limits

Engine: Chromium, desktop 1280×800 and device emulation from `tests/e2e/viewport-cases.ts`: iPhone 16 portrait full-canvas 393×852 and browser-area 393×659; iPhone 16 Pro Max portrait full-canvas 440×956 and browser-area 440×763, DPR 3. Drawing tools/gallery cover all four phone cases; multiplayer cases cover both 4 and 6 players. Screenshots inspected include tool palettes, the full conversation, 6-player canvas, 4-player host/reveal and 6-player hints. Controls and text fit; long content scrolls vertically without horizontal overflow.

Tool/gallery artifacts are retained locally under `output/playwright/conversation-tools`; multiplayer images under `output/playwright/draw-guess-*`. These generated images are not committed. No physical iPhone, real Safari, browser-bar animation or device safe-area validation was performed.

Undo history is local and resets on reload; the current drawing recovers. The core requires a pen stroke but does not rasterize the image to determine whether later erasing removed every visible mark. Live rooms/pages are in memory only. The user's earlier local page reported that its room no longer existed, so that exact match could not be inspected; the expiry defect was reproduced independently.

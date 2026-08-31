# Adaptive game surface validation

Date: 2026-08-31

## Scope

- Desktop public history, bank and opponents share the right rail; the private dock stays below the map. Short rails reserve readable history space and let opponents scroll.
- Bank cards use an icon-only portrait variant with larger top-right counts, while retaining resource names in titles and accessible labels. Hand, trade and flight variants are unchanged.
- The host can hide bank counts before starting. Server HTTP/command responses and subscription snapshots redact the stock; icons and the single bank anchor remain mounted.
- The robber and its animated destination sit at the tile's upper-left, clear of the number token.
- Required local actions keep the entire dock pale coral-red with a soft red border and dark red task-specific headings. A matching player-safe current-action effect produces one 1.5-second notice above the map; trade offers receive a quieter prompt. Initial/reconnect snapshots do not replay notices and reduced-motion disables the brief glow.
- The local seat shows the same public-score badge as opponents; hidden victory-point cards are excluded.
- SVG fits terrain and port bounds into the remaining space. Number tokens use 24-unit type instead of 15-unit type.
- Game controls use bounded viewport-responsive rem sizing. Phone zoom buttons no longer cover ports.
- History retains the latest 30 projected entries, appends below, follows the bottom, pauses while reading older entries and offers a return-to-latest button.
- Result tabs use light text in inactive, hover, selected and keyboard-focus states.
- No game legality, canonical game state, server authority or proprietary artwork changed. Protocol changes are limited to bank-count visibility and player-safe current-action cues.

## Viewport matrix

Four- and six-player action-state fixtures, including the last-roll badge, are tested at these CSS viewport sizes:

1024×768, 1366×768, 1920×1021, 2560×1440, 3840×2160, 3440×1440, 1920×720, 960×540, 390×844 and 360×640.

Assertions cover document overflow, actual terrain/port bounds, HUD overlap, player-anchor count, dock/rail bounds and desktop text-size floors. Screenshots are written to ignored `output/playwright/adaptive-*.png` files.

Bank count type is at least 16px on compact layouts and 20px on desktop at the default root size, then scales with the desktop root. The matrix checks portrait proportions, count/illustration separation and card bounds. Cropped desktop and phone previews are written to ignored `output/playwright/bank-cards-*.png` files.

With a browser default font size of 16px, expected desktop sizing is:

| CSS viewport | Root/player name | Opponent resource/development/army/road stats |
| --- | ---: | ---: |
| 1366×768 | 16px | 14px |
| 1920×1021 | 18.38px | 16.08px |
| 2560×1440 | 25.6px | 22.4px |
| 3840×2160 | 32px | 28px |

The same 1920×1021 CSS viewport at DPR 1 and DPR 2 produces identical type sizing. Monitor diagonal, viewing distance and OS scaling are not discoverable from viewport dimensions; physical-size equivalence across monitors is not guaranteed. Browser zoom remains available.

At 1920×1021 the six-player action fixture still exceeds the previous 91.28px tile width by at least 10%, including the new reserved notice strip and full turn controls. Board size is limited by available height, so it is intentionally not a fixed enlargement percentage on every screen.

## Additional regressions

- History starts at the bottom, follows appended events, pauses on upward scroll and resumes explicitly.
- A retained visible log row keeps its offset when old entries leave the 30-row window; repeated snapshots do not cause a jump.
- Mobile history opens at the newest entry and retains Radix Escape behavior.
- Opponent DOM anchors survive desktop/mobile breakpoint changes; local room footer controls remain within their panel.
- Bank location follows the desktop/compact breakpoint with exactly one resource-source anchor. Live bank counts and local public scores survive resizing; history remains at least 80 CSS pixels tall in the desktop fixture matrix.
- Bank rendering tests cover zero stock and both 19- and 24-card supplies, icon-only visible content, accessible resource names and unchanged hand/compact labels.
- Bank-visibility tests cover the public default, host-only updates, stale revisions, invalid values, preservation on unrelated updates, post-start locking and redaction for all seats. The real three-seat E2E match now runs with hidden bank counts.
- Action-notice browser tests cover 360×640, 390×844, 960×540 and 1920×1021, asserting no map overlap, document overflow or focus theft; notifications expire without removing persistent emphasis. Setup, discard, robber, paired action and incoming offers use distinct headings; reload does not replay a notice. Unit tests also cover duplicates, stale revisions, reconnect baselines and free roads.
- Robber bounds remain above the numbered token and inside the tile, with the motion anchor matching the settled pawn's center at all four notice-test sizes.
- Mobile opponent timers fit within the horizontally scrollable strip instead of being clipped below it.
- Result tab colors are checked as rendered RGBA, including CSS Color 4 serialization, hover, active indicator and keyboard focus.
- Existing multiplayer setup, resource effects, development feedback, trade, seat lifecycle and reconnect tests remain part of the gate.

## Commands

- `pnpm validate` — Passed: TypeScript checks, 159 unit tests and production builds.
- `pnpm test:e2e` — Passed: 35 Chromium viewport and multiplayer regressions.

These checks use desktop Chromium and emulated CSS viewport/DPR sizes. Physical phones and Safari are not covered by this validation.

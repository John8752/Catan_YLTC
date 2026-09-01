# Three-column game layout validation

Date: 2026-08-31

## Layout contract

- At 1280 CSS pixels and wider, opponents occupy the left rail, the map fills the central column's entire available height, and information/actions occupy the right rail. Rail widths are 12.5rem and 22.5rem (200px and 360px at the default root size); existing large-screen typography scaling remains in effect.
- Both rails share one solid, low-saturation dark gray-green background (`--game-rail-bg: #1c3434`), with shared light ink, muted text and subtle divider tokens. Desktop opponent rows use simple separators; the right rail's record/bank/tool sections avoid bright surfaces and individual panel shadows. Required local actions use a subdued tinted dock and a small pale-coral title highlight, preserving attention without lighting up the whole rail. Compact phone surfaces keep their existing contrast and styling.
- Other players retain public stats, scores, current-action emphasis and an independently scrollable rail. The same DOM anchors become the top strip below the three-column breakpoint.
- At 1024–1279px, the map has a top opponent strip and a right information/action rail. This avoids narrowing the map between two rails. Below 1024px, the existing phone portrait/landscape layout and Radix disclosures remain.
- The right rail stacks public history, the bank, phase/action information, and the private dock. It contains no map controls. The private dock arranges the local seat, hand, public stats and turn actions vertically. It stays at the bottom independently of history scroll position or retained/appended log entries.
- Phase/action information uses a portal into the right rail; map tools are absent there and the board does not reserve a header/footer on desktop. The map owns direct panning state and a fixed enlarged presentation scale. Action and near-victory effects still come from player-safe protocol projections. Pale coral action emphasis, notice lifetime, focus behavior and reconnect suppression are preserved.
- History uses the remaining height. Compact rail/dock spacing preserves at least 80px of history viewport in the desktop acceptance matrix, including 1920×720. A resize-induced scroll event cannot accidentally pause live following before ResizeObserver runs.
- A live game has no exit-seat or extra-seat buttons. The room footer remains available in the lobby for the separate, server-backed “离开房间” flow.
- No game rules, protocol payloads, server authority, random behavior, SVG port proportions or proprietary assets changed.

## Map comparison

Actual hex width in CSS pixels, using the same deterministic four-/six-player action fixture before and after the change. Terrain, ports, text and pieces all share this scale.

| Viewport | Four players, before → after | Six players, before → after |
| --- | --- | --- |
| 1024×768 | 69.23 → 102.80 | 55.31 → 83.46 |
| 1366×768 | 79.11 → 122.41 | 63.21 → 97.02 |
| 1920×1021 | 111.42 → 163.45 | 89.02 → 129.55 |
| 960×540 | 37.67 → 42.25 | 30.09 → 33.49 |

These are measured cases with the current fixed 1.08 presentation scale. The tighter axis still limits the underlying fit. Terrain stays inside the stage; measured port overflow is at most 0.2 hex widths in the full matrix, and direct panning exposes the clipped edge. The regression retains explicit pre-change size floors at 1024×768 and 1366×768.

## Browser coverage

The shared `tests/e2e/viewport-cases.ts` matrix supplies all primary phone cases, with DPR 3 and touch/mobile behavior enabled:

| Model | Full canvas, portrait / landscape | Browser area, portrait / landscape |
| --- | --- | --- |
| iPhone 16 | 393×852 / 852×393 | 393×659 / 734×343 |
| iPhone 16 Pro Max | 440×956 / 956×440 | 440×763 / 838×390 |

All sixteen four-/six-player layout screenshots were visually inspected for the two models, both orientations and both area modes. The compact bank disclosure, port icon/ratio rows, number-token clearance, bounded port overflow, dock bounds and page overflow are covered by the existing suite.

Desktop/compatibility layout coverage includes 1024×768, 1366×768, 1920×1021, 2560×1440, 3840×2160, 3440×1440, 1920×720, 960×540, 844×390, 640×360, 390×844 and 360×640. Additional four-/six-player resizing covers 1428×779, 1280×720, 1279×720 and 1366×640.

Focused regressions verify:

- rail widths and full-height central stage;
- single surviving local/opponent anchors during resizing;
- history following, paused reading and retention without moving the dock;
- fully visible, unobscured roll/end-turn buttons, including expanded development controls, and an actual intercepted roll-command submission;
- direct mouse, touch and keyboard map movement with double-click/Home recentering and unchanged port/hex proportions;
- notice separation from the map in its new location;
- resizing between each primary phone's full canvas and browser area while reserving additional notch/home-indicator padding (59px top and 34px bottom in portrait; 59px sides and 21px bottom in landscape).

Screenshots and measured JSON are ignored artifacts under `output/playwright/`. Main review images are `three-column-4-1428x779.png` and `three-column-6-1428x779.png`. Shared layout helpers live in `tests/e2e/layout-fixture.ts` rather than further enlarging the original spec.

## Limits

Validation uses desktop Chromium with emulated CSS viewports/DPR, not physical iPhones or iOS Safari. Explicit padding reserves space; it does not emulate Safari's actual browser chrome or platform safe-area calculation. Physical-device browser bars, notch/home indicator and touch gestures have not been certified.

The six-player map and port details remain visually small in phone landscape, especially browser-area cases. Containment/proportion assertions do not establish comfortable readability. At very short desktop heights, history gets less space so primary actions remain reachable; the 1366×640 resize check verifies actions/overflow, not the 80px history floor used by the main desktop matrix.

## Commands

- `pnpm validate` — passed: TypeScript checks, 188 unit tests and production builds.
- `pnpm test:e2e:mobile` — passed: 40 primary-phone cases; the final full E2E gate repeats this matrix.
- `pnpm test:e2e` — passed: all 90 Chromium cases, including the primary phone matrix and real multiplayer flows.
- `pnpm exec playwright test tests/e2e/three-column-layout.spec.ts` — passed: all three focused cases after adding a final post-command map-fit assertion and waiting out screenshot animations. Four-/six-player 1428×779 screenshots were reviewed again.

The unified-background follow-up reran `pnpm validate` (188 unit tests and builds), `pnpm test:e2e:mobile` (40 passed), and `pnpm test:e2e --grep-invert @primary-phone` (50 passed). The four-/six-player desktop previews and all sixteen primary-phone layout screenshots were inspected again. Geometry, required-action access and mobile styling remain unchanged. The current six-player preview is also saved as `output/playwright/unified-sidebars-6-1428x779.png`. The Chromium/physical-device and small landscape-detail limits above still apply.

The subdued-background follow-up replaced the pale desktop rails with dark gray-green surfaces and softened dividers. History, phase/action information, bank marker and secondary controls use readable muted colors; the required-action dock has a restrained tint and a small pale-coral title. Desktop-only inherited sidebar tokens do not affect portaled light dialogs.

Validation for this follow-up:

- `pnpm validate` — passed: TypeScript checks, 188 unit tests and production builds.
- `pnpm exec playwright test tests/e2e/three-column-layout.spec.ts --grep 'desktop resizing'` — 2 passed.
- `pnpm test:e2e:mobile` — 40 passed, using the complete shared primary-phone matrix above.
- `pnpm test:e2e --grep-invert @primary-phone` — 50 passed, including desktop/compatibility, safe-area resizing and multiplayer flows.
- `git diff --check` — passed.

Four-/six-player 1428×779 desktop previews, the six-player 1920×1021 action state, and all sixteen primary-phone layout screenshots were visually inspected. The reviewed dark-rail preview is saved as `output/playwright/muted-sidebars-6-1428x779.png`. These are Chromium emulation results, not physical iPhone/iOS Safari validation; small six-player landscape details remain an issue as noted above.

The 2026-09-01 live-room cleanup removed both the exit-seat and extra-seat UI entry points, including their front-end handlers. The server-backed lobby “离开房间” flow remains available. `pnpm validate` passed (188 unit tests and production builds), the focused breakpoint regression passed, and `pnpm test:e2e` passed all 90 Chromium cases.

The 2026-09-01 movable-map follow-up removed the map-tool UI from desktop and compact layouts. The map now uses a fixed 1.08 presentation scale and accepts direct mouse/touch dragging; arrow keys move a focused map, while double-click or Home returns it to center. Wheel and pinch gestures no longer change the map scale. Terrain remains contained, port overflow stays below 0.2 hex widths, and port/terrain/text/piece proportions remain uniform. `pnpm validate` passed (188 unit tests and production builds), `pnpm test:e2e` passed all 90 Chromium cases, and the sixteen four-/six-player primary-phone screenshots plus both 1428×779 desktop previews were visually inspected. The reviewed desktop preview is `output/playwright/movable-map-6-1428x779.png`.

The 2026-09-01 compact-port follow-up reduced each SVG port sign from 54.4×68 to 48×56, reduced its icon from 30 to 24 units and its ratio type from 24 to 21 units, and tightened the icon/ratio placement. Rendered tests require a non-negative gap capped at 0.09 hex widths, so the two rows stay close without overlapping. The smaller signs and shorter port clearance tighten the fitted SVG bounds, increasing the current four-/six-player tile widths shown above while retaining the fixed 1.08 presentation scale. Terrain remains contained and bounded port overflow remains below 0.2 hex widths; direct panning exposes clipped edges. `pnpm validate` passed (188 unit tests and production builds), `pnpm test:e2e` passed all 90 Chromium cases, and the sixteen four-/six-player primary-phone screenshots plus both 1428×779 desktop previews were visually inspected. The reviewed contact sheets are `output/playwright/compact-ports-primary-4.png` and `output/playwright/compact-ports-primary-6.png`.

The concise-history follow-up removes revision-number boilerplate from the browser fixture and protocol-facing copy, omits end-turn transition rows, combines all production grants from one event into one row, and shortens trade, development-card, robber and victory-warning descriptions. Robber participants receive concise Chinese private details while observers still see no resource type. The history header now shows only its row count. In the desktop right rail, the phase chip remains persistent but the dock is the sole persistent action instruction; the notice slot appears there only for transient action or victory notices. `pnpm validate` passed (189 unit tests and production builds), `pnpm test:e2e` passed all 90 Chromium cases, and the four-/six-player 1428×779 previews were inspected. The validation uses Chromium emulation rather than physical iPhone/Safari testing.

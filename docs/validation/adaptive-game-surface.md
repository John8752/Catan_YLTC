# Adaptive game surface validation

Date: 2026-08-31

The later [three-column layout validation](./three-column-layout.md) supersedes the desktop placement described below. The mobile matrix, uniform map scaling and earlier feature validation remain applicable.

## Scope

- Desktop public history, bank and opponents share the right rail; the private dock stays below the map. Short rails reserve readable history space and let opponents scroll.
- Bank cards use an icon-only portrait variant with larger top-right counts, while retaining resource names in titles and accessible labels. Hand, trade and flight variants are unchanged.
- The host can hide bank counts before starting. Server HTTP/command responses and subscription snapshots redact the stock; icons and the single bank anchor remain mounted.
- The robber and its animated destination sit at the tile's upper-left, clear of the number token.
- Required local actions keep the entire dock pale coral-red with a soft red border and dark red task-specific headings. A matching player-safe current-action effect produces one 1.5-second notice above the map; trade offers receive a quieter prompt. Initial/reconnect snapshots do not replay notices and reduced-motion disables the brief glow.
- The local seat shows the same public-score badge as opponents; hidden victory-point cards are excluded.
- Public near-victory progress starts three points below the room target and escalates at two and one. Amber trophy badges show public score/target; each seat receives at most one notice per tier and the same milestone is appended to public history. Action notices take priority over the three-second warning.
- SVG fits terrain and port bounds into the remaining space. Port signs use a compact 48×56 icon-over-ratio design with 24-unit icons and 21-unit ratio type. The icon and ratio are pulled together with only a small measured gap, while rendered bounds remain non-overlapping at every tested size. Dedicated ports show only their resource icon; generic ports use the existing SVG question-mark icon. Chinese port descriptions remain accessible but are not visible text. Every map element scales together, without independent port-size/font compensation. Number tokens use 24-unit type instead of 15-unit type.
- Game controls use bounded viewport-responsive rem sizing. Compact bank details open on demand; map-tool buttons and the repeated board footer are removed. The map starts at a fixed enlarged presentation scale, moves directly by drag or arrow keys and supports midpoint-anchored two-finger pinch zoom, with double-click/Home returning it to center. Optional actions collapse while required roll/discard/victim controls remain accessible. Selecting a build returns space to the map. Short phone landscapes move the dock beside the map.
- History retains the latest 30 projected entries, appends below, follows the bottom, pauses while reading older entries and offers a return-to-latest button.
- Result tabs use light text in inactive, hover, selected and keyboard-focus states.
- No game legality, canonical game state, server authority or proprietary artwork changed. Protocol changes are limited to bank-count visibility, player-safe current-action cues and public near-victory milestones.

## Viewport matrix

The primary mobile acceptance devices are **iPhone 16** and **iPhone 16 Pro Max**. `tests/e2e/viewport-cases.ts` owns their shared matrix; `pnpm test:e2e:mobile` selects the `@primary-phone` cases. Layout, bank/map/action disclosure, action notices and near-victory tests all consume this matrix with DPR 3, mobile viewport behavior and touch capability enabled.

| Primary device | Full canvas, portrait (CSS px) | Browser area, portrait (CSS px) |
| --- | --- | --- |
| iPhone 16 | 393×852 | 393×659 |
| iPhone 16 Pro Max | 440×956 | 440×763 |

Full-canvas dimensions follow [Apple's logical display sizes](https://developer.apple.com/design/human-interface-guidelines/layout), not raster resolution. Browser-area dimensions come from the installed Playwright device descriptors and may change when Playwright is updated. They account for a reduced browser content area but do not simulate physical Safari chrome or safe-area insets. Actual usable sizes vary with browser version, bars, zoom and display settings.

Both four- and six-player action-state fixtures run at every primary size. Existing desktop and smaller-phone fixtures remain as additional coverage; 360px/390px phones are compatibility targets and must not substitute for the named primary devices:

1024×768, 1366×768, 1920×1021, 2560×1440, 3840×2160, 3440×1440, 1920×720, 960×540, 844×390, 640×360, 390×844 and 360×640.

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

The old one-line-port tile-width benchmark is superseded by the icon-over-ratio design. Tests assert constant port/hex and font/hex proportions at every viewport and during panning, bounded edge overflow, no overlapping port cards and no number-token occlusion. Terrain bounds remain visible. Icon and ratio rows must remain separated, and their gap is capped at 0.09 hex widths so the content cannot drift apart again. Each port must show its correct resource/question-mark icon, and visible port text contains only its ratio. The bank-style background must not override brick-icon ink. Board size is limited by the tighter viewport axis, then receives one uniform presentation scale rather than fixed screen-pixel sizing.

## Additional regressions

- Two-finger pointer sequences change scale around the gesture midpoint, clamp to the existing zoom range, continue as a one-finger pan after either finger lifts and suppress the post-gesture click over actionable map targets.
- History starts at the bottom, follows appended events, pauses on upward scroll and resumes explicitly.
- A retained visible log row keeps its offset when old entries leave the 30-row window; repeated snapshots do not cause a jump.
- Mobile history opens at the newest entry and retains Radix Escape behavior.
- Opponent DOM anchors survive desktop/mobile breakpoint changes; the live room panel omits the retired exit-seat and extra-seat controls at every breakpoint.
- Bank location follows the desktop/compact breakpoint with exactly one resource-source anchor. Live bank counts and local public scores survive resizing; history remains at least 80 CSS pixels tall in the desktop fixture matrix.
- Compact disclosure tests cover live bank updates while its dialog is open, hidden-count redaction, Escape/focus return, one effect anchor, direct map movement/recentering with constant port proportions, automatic build-panel collapse and directly accessible rolling. Optional controls use Radix disclosure and dialog primitives.
- Bank rendering tests cover zero stock and both 19- and 24-card supplies, icon-only visible content, accessible resource names and unchanged hand/compact labels.
- Bank-visibility tests cover the public default, host-only updates, stale revisions, invalid values, preservation on unrelated updates, post-start locking and redaction for all seats. The real three-seat E2E match now runs with hidden bank counts.
- Action-notice browser tests cover the four portrait primary phone cases plus 360×640, 390×844, 960×540 and 1920×1021, asserting no map overlap, document overflow or focus theft; notifications expire without removing persistent emphasis. Setup, discard, robber, paired action and incoming offers use distinct headings; reload does not replay a notice. Unit tests also cover duplicates, stale revisions, reconnect baselines and free roads.
- Robber bounds remain above the numbered token and inside the tile, with the motion anchor matching the settled pawn's center at every notice-test size.
- Mobile opponent timers fit within the horizontally scrollable strip instead of being clipped below it.
- Result tab colors are checked as rendered RGBA, including CSS Color 4 serialization, hover, active indicator and keyboard focus.
- Existing multiplayer setup, resource effects, development feedback, trade, seat lifecycle and reconnect tests remain part of the gate.
- Near-victory protocol tests cover 5/10/12/15-point targets, three/two/one-point thresholds, multi-tier jumps, public-only totals, simultaneous affected players, history ordering/retention, award loss/recovery and suppression during setup or victory. Milestone records remain bounded in the room even after dropping out of the projected history window.
- A seeded real-engine server test plays through setup and a scoring build, verifies the same milestone for all three subscriptions and reads, and checks command retries and resubscription without duplicate history.
- Near-victory browser tests use the four portrait primary phone cases plus 360×640, 390×844, 960×540, 1920×1021 and 3840×2160. They check badge containment, compact self-seat resource text, no document overflow or map overlap, retained keyboard focus, exact badge color and timed queuing. A separate flow checks action priority, all three tiers, public history, reload suppression, score loss/recovery and cancellation on victory. Screenshots are written to ignored `output/playwright/victory-warning-*.png` files.

## Commands

- `pnpm validate` — Passed after removing the generic-port ring: TypeScript checks, 187 unit tests and production builds. The port question mark has no circle; unknown-card icons retain their existing ring.
- `pnpm test:e2e:mobile` — Passed after removing the generic-port ring: 40 primary-phone regressions (16 layout, eight disclosure, eight action-notice and eight near-victory cases).
- `pnpm test:e2e --grep-invert @primary-phone` — Passed: the other 47 Chromium viewport and multiplayer regressions after the narrow icon-only port change. Not rerun for the subsequent cosmetic ring removal; that follow-up reran the 40 primary-phone cases above.

## Primary-phone visual review

All eight four-/six-seat portrait layout screenshots across the two models and both canvas modes were inspected. Ports keep icons above ratios, fit within the viewport and avoid number tokens; map and port proportions remain consistent. Screenshots use CSS-pixel output for comparison even though browser contexts render at DPR 3. Phone landscape is not an acceptance target.

These checks use desktop Chromium and emulated CSS viewport/DPR sizes. Physical phones and Safari are not covered by this validation.

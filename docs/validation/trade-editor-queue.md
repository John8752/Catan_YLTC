# Compact trade editor and queue disclosure

> Historical execution evidence, not a current regression requirement. Use [the scoped testing policy](../testing.md) for new changes. Commands/counts below describe their original runs; some paths have since moved.

Local validation, 2026-09-09. This change only affects presentation and input composition; `game-core` rules and protocol projections are unchanged.

## Behavior

- Below 1024 CSS pixels, player trade composition uses two rows of five resource quantities. Press a resource to add one and its decrement button to remove one. The offer has one text summary rather than duplicate selected-card piles. Give quantities are bounded by the projected hand; a later hand reduction invalidates an unaffordable draft without silently changing the requested terms.
- Both sides, summary, validation and publication fit together on the primary phone viewports for a five-resource mixed offer. The bottom sheet is bounded at 85dvh and can scroll for unusually tall content or a smaller browser area. Bank/port exchange retains a separate tab. Tab switches and manual closure preserve the draft; successful publication clears it through the existing flow.
- Compact forecasts retain the current actor, turn/type and the viewer's next opportunity in a two-line trigger. The complete projected queue opens in a Radix dialog with full names, current/self markings and primary/paired labels. Entries update live while open. Escape restores focus to the trigger. The desktop queue remains persistent.

## Checks

- `pnpm validate`: passed type checks, all 306 unit tests and production builds. Vite retains the main-chunk size advisory (about 525 kB uncompressed).
- `pnpm test:e2e:mobile --workers=3`: 41 passed.
- `pnpm exec playwright test tests/e2e/catan/adaptive-layout.spec.ts tests/e2e/catan/action-attention.spec.ts tests/e2e/catan/three-column-layout.spec.ts tests/e2e/catan/trade-editor-queue.spec.ts tests/e2e/catan/trade-counteroffer.spec.ts tests/e2e/catan/first-playable.spec.ts --grep-invert @primary-phone --workers=3`: 38 passed.
- New deterministic browser coverage checks long names, projected queue order/live updates, disclosure focus, add/remove bounds, overlap rejection, legal one-way gifts and requests, five-resource mixed offers, draft preservation, live hand changes, and command payloads accepted by the real game engine. Existing real-server coverage verifies publication, counteroffers, completion and subsequent discard.
- Two existing jsdom suites now explicitly select the desktop media-query branch. jsdom has no native `matchMedia`; compact interaction is covered in the real Chromium tests rather than inferred from jsdom layout.

## Viewports and screenshots

Chromium emulation using `tests/e2e/viewport-cases.ts`, DPR 3:

| Device | Full canvas | Browser area |
| --- | --- | --- |
| iPhone 16 | 393 × 852 | 393 × 659 |
| iPhone 16 Pro Max | 440 × 956 | 440 × 763 |

Inspected the four/six-player map matrix, compact forecasts, full queue and trade composer. The existing suites also check map/port scale proportions, number-token overlap, dock bounds, bank disclosures, mandatory actions, document overflow, browser-area resizing and simulated safe-area padding. Compatibility checks include 360 × 640 and 390 × 844, with desktop resizing through 3840 × 2160.

The ignored local gallery is `output/playwright/trade-queue-0909/review.html`. It contains real-room snapshots and deterministic fixture screenshots, plus the old/new editor comparison. The initial 393 × 659 editor snapshot is about 539px tall with equal client/scroll heights; both sides and publication are visible without scrolling. Full queues scroll inside the dialog when long.

Physical iPhone and iOS Safari validation was not performed. Six-player port text remains visually small and retains the existing bounded outer-port clipping/panning behavior; this change does not claim to resolve map readability.

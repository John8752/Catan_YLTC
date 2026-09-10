# Compact controls and negotiation

> Historical execution evidence, not a current regression requirement. Use [the scoped testing policy](../testing.md) for new changes. Commands/counts below describe their original runs; some paths have since moved.

Validated locally on 2026-09-09.

## Behavior

- Compact player tiles keep names, public scores and resource totals. Pressing a name opens live public statistics and remaining pieces in a Radix dialog. The local player uses a short “我” label; the dialog contains the full name.
- Bank, records, account, sound, rules and disband controls share a game menu. The menu trigger owns the single compact bank effect anchor. AI commentary keeps its own compact trigger and component lifetime so unread setup tips and generated commentary are retained.
- A live trade occupies one dock summary with terms and response counts. Incoming responses update the summary without opening a modal. Both the summary and “查看交易桌” open the negotiation dialog. Long response lists scroll within 85dvh; the proposer’s completion/cancel controls remain reachable. Unanswered players are represented by a count.
- Hand, timer, roll, discard and turn actions remain directly accessible. Desktop keeps its detailed rails and floating negotiation panel. No rules or network projection changes were required for this layout work.

## Validation

- `pnpm validate`: passed check, 306 unit tests (core 60, protocol 46, server 53, web 147), and production builds. Vite reports the existing main-chunk size advisory (approximately 522 kB uncompressed).
- `pnpm test:e2e:mobile`: 37 passed.
- `pnpm exec playwright test tests/e2e/catan/adaptive-layout.spec.ts tests/e2e/catan/action-attention.spec.ts tests/e2e/catan/three-column-layout.spec.ts tests/e2e/catan/compact-organization.spec.ts tests/e2e/catan/game-sounds.spec.ts tests/e2e/catan/ai-commentary.spec.ts tests/e2e/catan/trade-counteroffer.spec.ts tests/e2e/catan/first-playable.spec.ts tests/e2e/catan/incremental-history.spec.ts --grep-invert @primary-phone --workers=3`: 43 passed.
- The new negotiation regression covers six players, long names, five multi-resource counteroffers, internal scrolling, reachable completion, live public-stat updates, no unsolicited opening, cancellation via projected state, and keyboard focus restoration. A desktop case checks the shared interaction.
- Existing coverage checks bank disclosures, unique anchors, four/six-player map/port proportions and number-token overlap, browser-area resizing with simulated safe-area padding, required actions, real-server trade completion, history and sound behavior.
- An initial simultaneous run exhausted browser capacity; that supplementary run was stopped. Three 5-second unit-test timeouts under concurrent load passed in focused reruns, and the final `pnpm validate` passed with no timeout/configuration changes. The complete supplementary browser suite passed with three workers.

## Screenshots and limits

Chromium emulation, DPR 3, portrait viewports from `tests/e2e/viewport-cases.ts`:

| Device | Full canvas | Browser area |
| --- | --- | --- |
| iPhone 16 | 393 × 852 | 393 × 659 |
| iPhone 16 Pro Max | 440 × 956 | 440 × 763 |

Inspected four- and six-player screenshots across all four cases. Additional compatibility coverage includes 360 × 640, 390 × 844, 960 × 540 and desktop viewports through 3840 × 2160.

The local six-player review reuses player-safe snapshots captured from the real local server, freezing each state to compare identical positions. Ten stages across four viewports are under ignored `output/playwright/mobile-optimization-0909/`. `review.html` compares the original and updated captures; `disclosures.html` shows opened controls; `matrix.png` contains the four/six-player acceptance views.

At 393 × 659, the same six-player ordinary-action snapshot has a board stage of about 315px rather than 249px (about 27% more vertical area). Waiting grows from about 327px to 391px. The active trade summary is about 49px high, replacing the previous overflowing floating panel. No document overflow was observed in these snapshots.

Six-player ports and the compact turn queue remain visually small, and the established uniform 1.08 map presentation scale still permits bounded outer-port clipping; panning/zoom remains available. These checks do not establish comfortable real-device readability. Physical iPhone and iOS Safari tests were not run.

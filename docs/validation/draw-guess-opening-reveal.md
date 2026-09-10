# Draw-guess: opening drawings and automatic reveal

## Behavior

- Each player selects one of six seeded bank phrases and draws their own opening. There is no custom prompt input. Opening selection and ink share a private draft and submit atomically.
- The next player sees the drawing and source phrase's character count, without the phrase. Later guesses use the preceding drawing's source text for the count. A missing source produces no count. Hint length does not constrain guesses.
- A text system host explains the flow in the lobby. After work, the server reveals one contribution every six seconds, including the original word and first drawing together. All seats follow the same cursor; host disconnects do not stop it.
- Fixed commentary compares already-revealed text and has separate lines for matching guesses, first detours, continuing detours, missing entries and completed intact albums. It does not interpret drawings or synonyms.
- The last entry remains visible for a full interval before settlement. Storage failures retain that cursor and retry automatically; drawings and words remain absent from durable match records.

## Automated checks

- Red test first: `pnpm --filter @catan/game-core exec vitest run src/draw-guess/opening.test.ts` failed against the old opening rules, then passed after implementation.
- `pnpm test:draw-guess`: passed 30 focused tests across core, protocol, server and web.
- `pnpm validate`: passed type checks, all 350 unit/integration tests (core 75, protocol 53, server 68, web 154), and production builds. Architecture boundary checks are included in the core tests.
- `pnpm test:e2e`: 119 passed / 1 failed in Chromium. All nine draw-guess cases passed, including the complete six-browser match and eight phone cases. The existing Catan three-seat flow timed out clicking a color option; `pnpm exec playwright test tests/e2e/first-playable.spec.ts --grep 'three isolated seats' --workers=1` then passed unchanged (37.5 seconds). The initial full run was not all green.
- Visual review caught the floating narrator overlapping drawings. After moving it into normal document flow, `pnpm exec playwright test tests/e2e/draw-guess --grep 'opening, touch|finished gallery' --workers=2` passed all 10 cases (eight phone flows plus desktop/phone finished-gallery checks), including explicit non-overlap assertions. `pnpm validate` was rerun and passed on this final implementation.

## Browser matrix and visual review

The draw-guess browser suite covers six independent desktop browser contexts, opening selection and drawing recovery, length hints, host disconnect/reconnect during automatic reveal, all 36 entries and same-room replay. Phone cases use `tests/e2e/viewport-cases.ts`, with both four and six players:

| Model | Portrait full canvas | Portrait browser area |
| --- | --- | --- |
| iPhone 16 | 393 × 852 | 393 × 659 |
| iPhone 16 Pro Max | 440 × 956 | 440 × 763 |

Phone checks include real Chromium touch event dispatch to Canvas, scroll stability during drawing, saved ink after refresh, hints, automatic reveal, long display names and horizontal document bounds. Screenshots are generated under ignored `output/playwright/draw-guess-*` paths.

Reviewed desktop opening and gallery screenshots, four/six-player phone reveal screenshots on both models and both viewport variants, and phone opening/hint screenshots. Choices wrap within their two-column grid, the source phrase stays absent while guessing, drawings are unobscured, and long host text wraps below the entry. Finished-gallery screenshots and non-overlap assertions cover desktop and iPhone 16 browser area. The page scrolls vertically to keep controls readable; it is not constrained to a single phone screen.

Engine: Chromium device emulation with DPR 3 for the phone descriptors. No physical iPhone or iOS Safari testing was performed.

The full browser suite also covers existing Catan phone layouts and platform behavior. Catan's existing small port text and tight/clipped port bounds in some browser-area views remain visible in its four/six-player screenshots; this draw-guess change does not alter those surfaces or claim to resolve their readability.

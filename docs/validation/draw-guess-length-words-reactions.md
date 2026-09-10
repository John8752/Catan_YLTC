# Draw-guess: exact guesses, noun bank and page reactions

Date: 2026-09-10. Scope: draw-guess/core → protocol → server → web and the draw-guess browser project. Concurrent Catan work was visible in the Git-based test plan; the explicit draw-guess scope was used for this delivery. No Catan gameplay regression was run for this feature.

## Delivered behavior

- A guess must match the projected source length exactly; Unicode code points are counted with whitespace excluded and punctuation included. Draft editing remains permissive. The authoritative core rejects wrong-length manual submissions and substitutes a missing page for an invalid draft at timeout. Missing source text permits a non-empty free-length guess. The client shows current/required counts, disables invalid submission, warns about expiry and unlocks editing after a server length rejection.
- 128 curated nouns supplement 144 original playful phrases. Each hand contains three regional nouns from distinct regions, one birthday noun, one everyday noun and one original phrase. All seven requested regions are represented; a deterministic 100-seed coverage test reaches every noun and checks five nouns per hand and 36 unique choices in six-seat matches. See [research sources](../draw-guess-word-sources.md).
- Reveal introduces the host for 2 seconds, then holds each page for 4 seconds, including the final page. Commentary is simultaneous with the page, with no separate interstitial delay.
- Every participant can repeatedly give thumbs up/down to each revealed non-missing page, including their own page and pages in the finished gallery. Counters are server-owned, live, shared and independent for the two reactions. A click queue survives album changes; uncertain requests retain their command IDs for explicit retry. Reactions cannot reveal hidden pages, reset deadlines, replace pages or cross matches. Counts remain in memory, outside account settlements.

## Validation actually run

- `pnpm test:plan`: inspected scope before selecting regression; worktree included concurrent Catan changes.
- `pnpm test:draw-guess --layer core -t 'exact guess length|page reactions'`: initially 3 failures demonstrating the missing behavior; passed after implementation (5 cases).
- `pnpm test:draw-guess --layer core -t 'offers five nouns'`: failed coverage with the original LCG and with scaled LCG output; passed after adopting the existing public seeded generator. ADR-0014 records the generator change.
- `pnpm validate:draw-guess`: passed all four package type checks, 18 core, 6 protocol, 11 server and 4 web cases at that point, plus 6 import-boundary and 4 browser-API guards.
- After adding the server-length rejection/edit recovery test: `pnpm test:draw-guess --layer web -t 'unlocks a server-rejected'` and `pnpm validate:draw-guess --layer web` passed. Final web total is 5 cases across 3 files.
- `pnpm test:inventory`: passed; new tests are owned once by existing draw-guess folder mappings in `scripts/testing/scopes.mjs`.
- `pnpm test:e2e:draw-guess`: **14 passed**, 3.6 minutes. Fresh isolated HTTP/WebSocket server, in-memory SQLite and isolated Vite server; no development server/database reuse.
- Production builds passed individually with `pnpm --filter @catan/game-core build`, `pnpm --filter @catan/protocol build`, `pnpm --filter @catan/server build` and `pnpm --filter @catan/web build`, matching the build commands shown by the scoped validation plan.
- `git diff --check`: passed.

The six-browser match exercises UI length gating, draft/reload recovery, all-player reveal reactions (12 up / 6 down), continued reveal while the host is absent, continued reactions after finishing, shared counts after reload and a deliberately dropped HTTP response after a text-page vote has been accepted. Retrying that vote leaves its total at 1. The server's fake-clock tests check the exact 2s/4s boundaries and that reactions do not move the deadline; core tests cover hidden/missing/forged targets, no-source guesses and timeout behavior.

## Browser and visual matrix

Engine: Chromium. Desktop gallery: 1280×800; the multiplayer desktop flow uses the installed Desktop Chrome descriptor. Phones use `tests/e2e/viewport-cases.ts`, DPR 3:

| Device | Full canvas CSS px | Browser area CSS px |
| --- | --- | --- |
| iPhone 16 | 393×852 | 393×659 |
| iPhone 16 Pro Max | 440×956 | 440×763 |

The 14 browser cases comprise a six-browser full match, eight four-/six-player phone work/reveal flows and five desktop/phone finished-gallery cases. The phone flows exercise touch drawing, draft recovery, exact-length hints, repeated thumbs controls, long names and overflow. Screenshots were inspected for the six-player reveal at all four primary phone sizes, the iPhone 16 guess counter and the finished phone gallery. Buttons/counts remain readable and contained; narration stays below the pages. No new decorative travel motion was added.

Artifacts are ignored under `output/playwright/draw-guess-*.png` and `test-results/**/finished-gallery.png`. This is Chromium device emulation, not iOS Safari or physical-device certification. Native browser chrome, the software keyboard, notch/home indicator and actual device gestures were not physically tested. No deployment was performed.

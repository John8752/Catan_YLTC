# Platform / Catan / draw-guess boundary refactor

> Historical execution evidence, not a current regression requirement. Use [the scoped testing policy](../testing.md) for new changes. Commands/counts below describe their original runs; some paths have since moved.

Date: 2026-09-09. This is a structural refactor under ADR-0014. Gameplay, private projections, HTTP paths and final-result payloads remain unchanged. Package-root exports and duplicate compatibility types are removed; consumers use explicit game/platform subpaths.

## Ownership

| Concern | Owner |
| --- | --- |
| Accounts, seats, room revision ordering and publication | Platform |
| Catan history merge, gap recovery and command ACK confirmation | `apps/web/src/games/catan/room-sync.ts` |
| Private drawing drafts and simultaneous task submission | `apps/web/src/games/draw-guess` |
| Account history query, game selection and pagination | `apps/web/src/components/AccountHistory.tsx` |
| On-demand account result rendering | Each game's `AccountMatchItem.tsx` |
| Routes, schemas, typed room records, game capacity and projections | Each server game module |
| Catan AI quotas, setup analysis, history, turn timers and settlement | `apps/server/src/games/catan` |
| Shared deterministic shuffle | `packages/game-core/src/primitives/random.ts` |
| Identity and generic settlement envelope DTOs | `packages/protocol/src/platform` |
| Game views, commands and versioned settlement payloads | Each protocol game module |

Game adapters receive only a lookup for their own room type. They cannot enumerate or replace the cross-game directory. Public primitives remain usable by draw-guess; a fixed-seed regression preserves its original prompt order.

## Regression evidence

The architecture suite parses TypeScript/TSX imports and reexports, including dynamic and type-only imports. It checks cross-game ownership throughout all four source trees and follows the account shell's static import graph. Narrow allowlists identify composition points and lazy history rendering.

The existing Catan ACK/history race tests now exercise the game policy with the platform store. Additional platform tests check drawing snapshot ordering, old-seat rejection and derived updates racing newer state. The browser history regression checks that opening drawing history does not request Catan result UI, then switches to Catan and verifies its lazy result panel and keyboard focus restoration.

| Command | Result |
| --- | --- |
| `pnpm validate:full` | Passed: type checking, 341 unit/integration tests, production builds, deterministic Catan replay, dependency boundaries and all browser tests |
| `pnpm test` within the full gate | core 73, protocol 48, server 66, web 154 passed |
| `pnpm test:boundaries` within the full gate | All 6 passed, including cross-layer import and account static-graph checks |
| `pnpm test:replay` within the full gate | Complete legal Catan replay passed; 1 unrelated case skipped by the named-case filter |
| `pnpm test:e2e` within the full gate | 116 passed in 2.8 minutes with 10 workers; includes the two new lazy-history cases and the existing 45 primary-phone cases |

The production build emits separate chunks for each `AccountMatchItem`, `GameResult`, `CatanTable` and `DrawGuessTable`. The browser regression independently verifies the actual module requests when selecting history games. The bundled server contains no unresolved `@catan/game-core` or `@catan/protocol` imports after removal of package-root exports.

After the full run, the final server configuration constant import was pointed directly at its owning game route module and extraction whitespace was cleaned. Server type checking/build and `git diff --check` were rerun for that cleanup.

## Browser matrix

The new account history case covers desktop 1280×800 and the installed iPhone 16 portrait browser-area descriptor, 393×659 CSS px at DPR 3, with six players and long names. Existing full browser regression covers Catan/draw-guess multiplayer, reconnect, privacy and the iPhone 16 / 16 Pro Max full-canvas and browser-area matrix.

Tests use isolated Playwright servers and in-memory SQLite. Chromium emulation is not physical iPhone or iOS Safari validation. No production deployment or database migration is part of this change.

Reviewed four account-history screenshots: both games on desktop and iPhone 16 browser-area. Drawing contribution text and six long player names wrap within the panel; Catan's long-name result remains inside the existing scrollable dialog. The new case also checks panel bounds, horizontal overflow, game switching and Escape/focus restoration. Game-surface styles and geometry were not changed; this refactor does not claim to resolve the previously recorded small Catan port text.

Screenshots and traces remain in ignored `test-results`, outside the committed source tree.

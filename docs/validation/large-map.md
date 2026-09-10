# Catan optional large island — 2026-09-10

## Scope and behavior

Catan core, protocol consumers, server settings and web lobby/board labels.
The host selects six-seat capacity, then `地图大小` → `大地图 · 37 块`.
The standard 30-tile choice remains the default. The custom profile retains
five-to-six-player limits, bank/development supplies, paired turns and the
chosen victory target. Preview, reroll, start and recovery use server state.

Phone default-zoom minimum font/icon thresholds were removed from the adaptive
layout tests at the user's request. `AGENTS.md` and `docs/testing.md` now preserve
zoom/pan, proportional scaling, content correctness and interaction checks
without a phone clarity gate. Desktop typography thresholds remain.

The workspace acquired concurrent draw-guess changes during this task.
`pnpm test:plan` reports both games; the explicit Catan scope below deliberately
does not run or modify that game's gameplay regression.

## Validation

- Red-first: `pnpm --filter @catan/game-core exec vitest run src/map/standard-map.test.ts -t 'large 5'`
  failed because `createLargeMap` was not implemented yet.
- `pnpm --filter @catan/game-core exec vitest run src/map/standard-map.test.ts src/engine/extended-profile.test.ts`
  passed 12 tests: topology/connectivity, ports, deterministic generation,
  nonadjacent hot numbers, five/six-seat setup, paired turns and development purchase.
- `pnpm --filter @catan/server exec vitest run src/games/catan/app.test.ts -t 'five-player'`
  passed both profiles. An initial test expected 409 for insufficient players;
  the existing API uses 400/NOT_ENOUGH_PLAYERS, so the test was corrected and rerun.
- `pnpm --filter @catan/web exec vitest run src/games/catan/components/LobbySetup.test.tsx -t 'large map'`
  passed the host/guest/busy settings test.
- `pnpm validate:catan` passed all four package type checks, 277 Catan unit/integration
  tests across 72 files, and 10 static boundary/browser-API guard cases.
- `pnpm test:e2e:catan large-map.spec.ts` passed the two real-service selection,
  preview synchronization, reroll, six-seat start, placement and recovery cases.
  Five new zoom cases initially failed because the test used an unsupported mouse
  wheel affordance. The test was corrected to use touch pinch on phones and the
  existing zoom button on desktop; production zoom behavior was unchanged.
- `pnpm test:e2e:catan large-map.spec.ts --grep 'large map keeps.*(iPhone 16 portrait full-canvas|1366x768)'`
  passed both focused failure reruns.
- `pnpm test:e2e:catan:mobile` passed 45 tests, including all four large-map phone
  cases and existing four-/six-player layout and interaction coverage.

Browser engine: Chromium. Desktop: 1366×768. Phone emulation: iPhone 16 at
393×852 and 393×659; iPhone 16 Pro Max at 440×956 and 440×763, DPR 3, portrait.
Phone cases use the repository's device descriptors. Services were isolated
Playwright servers with in-memory SQLite, not a live development database.

## Visual inspection and limits

Inspected `output/playwright/adaptive-{4,6}-{width}x{height}.png` for all four
primary phone viewports, and `large-6-{width}x{height}.png` for the same four
viewports plus desktop. Checked map/HUD boundaries and interactions, not phone
font clarity. The existing 108% default zoom can partially crop coastal port
signs at the viewport edge on both standard and large boards; the existing
bounded overflow allowance and pan/zoom behavior are retained.

No physical-device/iOS Safari certification, long-match human balance playtest,
production build or deployment was performed. No dependency, packaging or
deployment behavior changed, so a production build was not required by the
scoped validation policy. This is a custom island, not an official balance claim.

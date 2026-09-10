# Scoped test infrastructure verification

Date: 2026-09-09. Scope: tooling, test ownership and development policy. Current policy is [testing.md](../testing.md); this record is execution evidence, not a recurring gate.

## Changes

- Root and package-local default unit commands select affected modules/layers from Git. Explicit platform, catan, draw-guess and tooling commands support focused iteration. Unknown tests/sources fail ownership checks instead of disappearing or silently selecting everything.
- Server platform contracts were separated from Catan app tests. Catan server/API tests and browser fixtures/specs now live in their game directories. Architecture checks are repository tooling. Existing test cases were preserved.
- Playwright uses positive project allowlists. CI uses the same Git-based planner and scope matrix; browser collection is explicit. Only manual full integration executes every browser project.
- AGENTS, README, development/account/multi-game plans, deployment references and the documentation index now use the scoped policy. Historical validation records are labelled as historical evidence. ADR-0015 records the decision.

## Executed checks

| Command/check | Result and reason |
| --- | --- |
| `pnpm install --offline --frozen-lockfile` | Passed after moving the architecture parser dependency to the root tooling owner. |
| `pnpm check:all` | All four workspace compilation checks passed after moving tests/imports. This broad check verified the test-tree migration. |
| `pnpm test:all` | The 350 existing Vitest cases passed (core 69, protocol 53, server 68, web 154, architecture 6). The then-current 18 selector cases also passed. Run once because this change moved test wiring across every module. |
| `pnpm test:tooling` (final) | 22 selector cases and 6 static architecture cases passed. Later runner fixes were verified here, without repeating all game tests. |
| `pnpm validate:draw-guess --layer web` | Web type check, 3 draw-guess web cases, 6 static architecture cases and 4 browser API guards passed. No Catan gameplay or browser suite executed. |
| `pnpm test:e2e:all --list` | Collected 122 browser cases in 22 files. Collection only, not 122 executed tests. |
| `pnpm test:e2e:draw-guess --grep "finished gallery.*desktop"` | 1 desktop case passed, only the draw-guess project. |
| `pnpm test:e2e --scope "platform,catan" --grep "lobby players\|4 seats fit 1366"` | 2 representative cases passed, verifying the extracted lobby case and moved Catan fixture imports. |
| `pnpm --filter @catan/web run test --files apps/web/src/games/draw-guess/DrawWork.tsx --dry-run` | Package-local entry selected only the two draw-guess web test files. |
| Inventory / source mapping audit | All 116 test files have exactly one owner: 94 unit/tooling files and 22 browser files. Every current source and fixture has a mapping. |
| CI YAML parse / `git diff --check` | Passed locally. GitHub-hosted jobs have not been executed for these uncommitted changes. |

The representative browsers used Chromium desktop contexts: draw-guess 1280×800, platform Desktop Chrome default 1280×720, Catan 1366×768. They launched isolated test servers with in-memory SQLite, not the development server. This tooling-only acceptance did not rerun the phone matrix, full browser gameplay suite or production build. No physical-device or iOS Safari claim is made.

One initial combined-scope invocation was rejected because PowerShell expanded an unquoted comma; quoting `"platform,catan"` corrected it. Package-local forwarded options use `pnpm run test ...`, because pnpm's `test` alias otherwise parses those options itself. These argument failures launched no tests.

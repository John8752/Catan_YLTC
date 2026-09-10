# ADR-0015: Scope regression by ownership and affected layer

Status: accepted

## Context

ADR-0014 isolated game behavior, but the old per-commit full-workspace gate, negative Catan selectors, mixed server/browser tests and global mobile command still coupled unrelated regression. A draw-guess change consequently ran Catan gameplay and mobile checks.

## Decision

- `docs/testing.md` replaces the historical full-regression requirements. Scope by platform, catan, draw-guess or tooling, then by code layer.
- `scripts/testing` owns the positive test inventory, Git change selection and executable plan used by local commands and CI. Unknown current tests fail inventory. Core/protocol changes flow through consumers within their own game; shared infrastructure has explicit consumer rules.
- Default `test`, `check`, `validate` and `test:e2e` are affected commands. Explicit module/layer commands work on clean trees; all/full commands are deliberate integration tools. Builds and browser playtests are selected separately from unit regression.
- Tests sit with their module; shared API lifecycle assertions are separated from Catan rules. Playwright projects use directory allowlists, never negative game tags. Static boundary/browser-API guards are separate from live gameplay tests.
- Browser device coverage follows the changed surface and game. Desktop-only local controls do not trigger the global phone matrix. Replay, boundaries and mobile tests are not executed twice by an overlapping full gate.
- CI plans from actual PR/push bases, validates affected layers in scope jobs and audits browser collection. An explicit manually dispatched job performs full integration. Historical results remain evidence of old runs, not current policy.

## Consequences

New domains/tests require ownership and selector regression tests. Shared TypeScript compilation may follow both games' types; this is disclosed as compilation, not unrelated gameplay regression. Cross-module dependency changes and test-tree migrations can still warrant a deliberate broad check, with an explicit reason.

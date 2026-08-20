# AGENTS.md

## Source of truth

- Read `PRODUCT.md`, then `docs/README.md`, before changing product behavior.
- Treat `packages/game-core` as the only authority for rules and serializable game state.
- Treat `packages/protocol` as the only authority for network messages and player-visible projections.
- The server is authoritative. The browser may preview actions but must never decide whether an action is legal.
- Do not reproduce CATAN artwork, rulebook prose, logos, or proprietary assets in this repository.

## Code map

- `apps/web`: React UI, SVG board renderer, DOM HUD and room controls.
- `apps/server`: HTTP/WebSocket transport, room lifecycle and connection management.
- `packages/game-core`: deterministic board generation, phases, commands, rules and invariants.
- `packages/protocol`: client/server message types and hidden-information redaction.
- `docs/rules`: executable-rule explanations and unresolved rule interpretations.
- `docs/adr`: architecture decisions that should not be silently reversed.

## Architecture rules

- `game-core` must not import React, Fastify, WebSocket, database code, clocks, or ambient randomness.
- Inject or record every random result. Never call `Math.random()` in `game-core`.
- Represent game phases as discriminated unions; reject commands that are illegal in the current phase.
- Never send another player's resource cards or private development cards to a client.
- Prefer small feature modules. Split a file before adding substantial behavior once it approaches 500 lines.
- Shared identifiers, resource names, commands and events must not be duplicated across apps.
- UI copy defaults to Simplified Chinese. Stable protocol values remain English code strings.
- Use SVG for the board and DOM for text-heavy controls, dialogs, logs and accessibility-sensitive UI.

## Rule change workflow

1. Add or update the relevant rule note under `docs/rules`.
2. Add a failing `game-core` test that demonstrates the rule.
3. Implement the smallest deterministic rule change.
4. Update protocol projections if public or private information changed.
5. Add an end-to-end test when the visible multiplayer flow changed.

## Validation

- Run `pnpm check`, `pnpm test`, and `pnpm build` before claiming implementation is complete.
- Run `pnpm validate` for the full local gate.
- A multiplayer bug is not fixed until a deterministic test or replay reproduces it.

## Commit discipline

- Use `<type>(<scope>): <summary>` subjects, for example `feat(core): add setup placement validation`.
- Keep one coherent intent per commit. Do not mix a mechanical refactor with new behavior unless they cannot be separated safely.
- Milestone, cross-layer and bug-fix commits must include `Context`, `Changes` and `Validation` sections in the commit body.
- Validation claims must name the command or playtest that actually ran. Write `Not run` with a reason instead of implying success.
- Commit rule notes, protocol changes, implementation and regression tests together when they describe one behavior change.
- Before committing, inspect `git status --short` and `git diff --cached`; do not include logs, browser artifacts, databases, secrets or unrelated edits.
- Do not rewrite published history or use destructive Git commands unless the user explicitly requests it.
- See `docs/development-workflow.md` for the full lightweight workflow.

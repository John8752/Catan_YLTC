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

## Frontend stack constraints

`apps/web` has one required frontend stack. Future agents must preserve it unless an ADR explicitly replaces it:

- React + TypeScript is the component and application framework.
- Tailwind CSS v4 is the default styling system. Use utility classes in product components and keep shared theme tokens in `src/styles.css`.
- shadcn/ui is the owned component layer under `src/components/ui`; generated components are repository code and may be themed locally.
- Radix UI primitives own modal, focus, keyboard, popover, tabs, tooltip and other non-trivial interaction behavior. Do not hand-roll focus traps, modal semantics or outside-click handling.
- Use `cn` from `src/lib/utils.ts` to compose conditional Tailwind classes.
- Custom global CSS is reserved for theme tokens, base document styles, the SVG board/playfield renderer and behavior Tailwind cannot express clearly. Do not add new page-level business UI as large global selector blocks.
- UI dependencies remain in `apps/web`; `game-core` and `protocol` must never import Tailwind, shadcn, Radix or React.
- New shared controls belong in `src/components/ui`; game-specific compositions belong in `src/components`.
- Reward and state-change motion must consume player-safe projected effects from `GameView.effects`; never infer gameplay events by diffing private hands or replay old effects after reconnect.
- Keep transient game motion in `src/effects`, target semantic `data-*` anchors, and provide a `prefers-reduced-motion` path without decorative travel.

See ADR-0005 before changing the frontend stack or introducing another component library. See ADR-0006 before changing how server events drive client effects.

## Domain modularity

`packages/game-core` is one package for now, but it must contain explicit domain modules rather than one connected rules blob:

- `primitives`: stable IDs, quantities, coordinates and generic result/error values; imports no game domain.
- `map`: faces, vertices, edges, adjacency, board templates and occupancy slots; knows nothing about inventories, prices or trade flow.
- `resources`: resource definitions, amounts, bank supply, player inventories and production transfers; knows nothing about SVG coordinates or room transport.
- `buildables`: buildable definitions, costs, piece limits and placement requirements; references resources and map locations only through stable IDs/value types and public capabilities.
- `trade`: offers, counteroffers, maritime ratios and atomic asset transfers; consumes inventory/port capabilities and does not inspect map internals or UI state.
- `rulesets`: the only layer that composes a map template, resource catalog, buildable catalog and trade policy into a named `RuleProfile`.
- `engine`: validates commands and applies events using the composed ruleset; it orchestrates modules without absorbing their private logic.

Hard constraints:

- Sibling domain modules do not import another module's internal files or mutate another module's state directly.
- Cross-module calls use exported immutable value types, commands, events or narrow capability interfaces.
- A stable domain concept has one canonical definition. Never duplicate resource, terrain, buildable or tradable IDs in server/web code.
- Adding a resource, map template, buildable or tradable asset should primarily add a definition and focused rules, not require editing unrelated modules.
- Rule-profile differences belong in `rulesets`, not scattered `playerCount` or profile conditionals.
- Domain modules must be headlessly testable. Rendering, networking, persistence and browser input remain outer adapters.
- Keep the dependency direction acyclic: `primitives -> sibling domains -> rulesets -> engine -> protocol -> apps`.
- See ADR-0004 before introducing initial placement, production, building or trading behavior.

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

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

## Insecure-context constraint (plain HTTP)

Production is served over plain HTTP on a bare IP (`http://18.117.234.107`) and TLS is **not**
on the table for now. Such an origin is not a *secure context*, so every browser — Safari and
Chrome alike — withholds a whole family of Web APIs and leaves them `undefined`. Local
development on `localhost` *is* a secure context, so none of this reproduces on a dev machine:
it only surfaces on the phones people actually play on. Treat that asymmetry as the default
hazard when adding anything that touches a browser API.

- Never call a secure-context-only API unguarded from `apps/web`. Blocked: `crypto.randomUUID`,
  `crypto.subtle`, `navigator.clipboard`, `navigator.share`, `navigator.geolocation`,
  `navigator.mediaDevices` / `getUserMedia`, `navigator.serviceWorker`, `navigator.credentials`,
  `navigator.wakeLock`, `navigator.storage`, `navigator.bluetooth` / `usb` / `serial` / `hid`,
  `caches`, `Notification`, `PushManager`, `PaymentRequest`, `IdleDetector`.
- `crypto.getRandomValues`, `localStorage`, `sessionStorage`, `fetch` and `WebSocket` carry no such
  restriction. They are the supported building blocks.
- Need a unique id? Call `randomId()` from `src/lib/random-id.ts`. Never call `crypto.randomUUID()`
  directly — that exact mistake shipped a client that could not submit a single game command.
- A genuinely optional affordance (copy-to-clipboard, share sheet) must feature-detect and degrade
  to something that works. It must never throw on an origin without TLS.
- Never set the `Secure` cookie attribute and never emit HSTS; both make the site unusable here.
  The app currently uses no cookies at all — seat tokens live in `localStorage`.
- Derive the socket scheme from `window.location.protocol` (see `connectToRoom` in `src/api.ts`).
  Never hardcode `ws://` or `wss://`, and never hardcode an `https://` origin.
- `apps/web/src/lib/secure-context.test.ts` fails the build when a blocked API appears in
  `apps/web/src`. Add a guarded helper rather than weakening that test.

This constraint is lifted only by an ADR that also moves the deployment to HTTPS; see
`docs/deployment.md` for what that migration involves.

## Account and SQLite constraints

The proposed account milestone is specified by `docs/account-system-plan.md` and ADR-0010. When implementing it:

- Accounts remain optional; preserve the anonymous create/join path and existing room-scoped seat recovery.
- `accountId`, room `playerId` and `seatToken` are separate concepts. Never place account credentials, usernames or database records in `game-core` state or player-visible projections.
- The newest successful login wins globally. Replacing a session must rotate the linked room's `seatToken` before closing old subscriptions, or the previous device can reconnect with its stored room credential.
- Account session secrets belong only in a server-managed HttpOnly cookie and their hashes in SQLite. Never put an account session, password, password hash or reset credential in browser storage, URLs, protocol views or logs.
- Until HTTPS is actually deployed, the account cookie must not use `Secure` or a `__Host-` prefix. Treat this as an explicitly insecure temporary mode, keep the UI warning, and do not claim transport security.
- SQLite stores account identity and sessions only in the first milestone. Rooms and games remain in memory under ADR-0007; do not silently add partial game persistence.
- Keep the database outside the repository and expose it through a server repository interface. Migrations, filesystem permissions, backup/restore and deployment rollback are part of the feature, not follow-up chores.
- Account transport DTOs belong in `packages/protocol`; secret records and authentication logic stay in `apps/server`.

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
- During implementation, prefer the smallest relevant test files or named cases. After fixing a matrix failure, rerun the failed case first, then run the required final suite once; do not run a whole spec immediately before an overlapping full suite without a specific reason.
- A multiplayer bug is not fixed until a deterministic test or replay reproduces it.

## Mobile layout acceptance (required)

- Prioritize **iPhone 16** and **iPhone 16 Pro Max** for mobile UI design, regression tests and review screenshots. A 360px small-phone screenshot alone is not mobile acceptance; keep older 360×640 / 390×844 cases as compatibility coverage, not the primary design target.
- Use cases from `tests/e2e/viewport-cases.ts`, not ad hoc substitute sizes. Portrait logical full-canvas baselines are 393×852 and 440×956 CSS px, respectively, with DPR 3. Never use physical raster resolution as the CSS viewport or increase UI sizes based on DPR. Phone landscape is outside the supported acceptance matrix.
- Cover both portrait full-canvas and portrait browser-area cases from the installed Playwright device descriptors. Safari bars reduce the available browser area. When changing viewport/safe-area behavior, also check resizing with browser bars and safe-area insets; do not assume a full logical display is always the usable web area.
- For game-surface changes that affect the map, HUD, shared typography, safe-area handling, breakpoints, viewport fitting or dock layout, run `pnpm test:e2e:mobile` (also included in `pnpm test:e2e`) and inspect four- and six-player screenshots on both primary models in portrait, including browser-area cases. Check map/port visibility, two-line port content, number-token occlusion, dock bounds, bank/map disclosures, required actions and document overflow.
- For an isolated dialog, drawer, popover or local panel that does not change the game surface or shared breakpoints, use a focused risk matrix instead of the full phone matrix: at minimum the iPhone 16 portrait browser-area case with the longest supported content or maximum player count. Add one desktop case for interaction behavior. Expand to more devices only when the component has device-specific branches, crosses a breakpoint, changes global overflow/safe-area behavior, or the focused checks expose a regression.
- Passing containment/scale tests does not prove text is comfortably readable. Report visually small content as a remaining issue even when automated checks pass; do not declare readability solved solely because ports are inside the viewport.
- Terrain, ports, port text and pieces must scale together. Improve unreadable ports in the original SVG design; do not add inverse-scale compensation, fixed screen-pixel port sizes or independent per-viewport port enlargement. Preserve the regression assertions for port/hex and font/hex proportions during fit and zoom.
- Report the actual test engine and viewport matrix. Chromium device emulation is not iOS Safari or physical-device validation. If real-device checks (browser chrome, notch/home indicator and touch gestures) were not run, say so explicitly rather than claiming iPhone/Safari certification.

## Commit discipline

- Use `<type>(<scope>): <summary>` subjects, for example `feat(core): add setup placement validation`.
- Keep one coherent intent per commit. Do not mix a mechanical refactor with new behavior unless they cannot be separated safely.
- Milestone, cross-layer and bug-fix commits must include `Context`, `Changes` and `Validation` sections in the commit body.
- Validation claims must name the command or playtest that actually ran. Write `Not run` with a reason instead of implying success.
- Commit rule notes, protocol changes, implementation and regression tests together when they describe one behavior change.
- Before committing, inspect `git status --short` and `git diff --cached`; do not include logs, browser artifacts, databases, secrets or unrelated edits.
- Do not rewrite published history or use destructive Git commands unless the user explicitly requests it.
- See `docs/development-workflow.md` for the full lightweight workflow.

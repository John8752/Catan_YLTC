# YLTC 桌游小馆

A server-authoritative tabletop hub for private groups. Choose **卡坦 (`catan`, 2–6 players)** or **传画猜词 (`draw-guess`, 3–6 players)** when creating a room. The room's game cannot change; after finishing, the host can return to the lobby and start a fresh match with the same friends.

Platform: optional accounts, anonymous entry, browser-persistent seats, reconnect, host succession and game-scoped final results. Catan: existing base/extended rules, trading, building, development cards and deterministic replay. Draw-guess: original prompts, simultaneous relay tasks, touch drawing, private drafts, server deadlines, shared reveal and final albums. Voice chat is external. See [ownership and roadmap](docs/multi-game-plan.md).

## Start here

1. Read [PRODUCT.md](./PRODUCT.md).
2. Read [docs/README.md](./docs/README.md).
3. Install dependencies with `pnpm install`.
4. Start web and server apps with `pnpm dev`.
5. Open `http://localhost:5173`.

## Commands

Choose the changed module/layer before running regression. [Testing policy](docs/testing.md) is authoritative; historical full-suite records are not per-change requirements.

```text
pnpm dev                               start local servers
pnpm test:plan                         show affected modules/layers from Git changes
pnpm validate                          validate affected layers, not every game
pnpm validate:draw-guess --layer web   drawing UI checks only
pnpm validate:catan                     Catan module checks
pnpm validate:platform                  account/room/platform checks
pnpm validate:tooling                   test selection and architecture checks
pnpm test:e2e:draw-guess --grep "finished gallery.*desktop"
pnpm test:e2e:catan:mobile             Catan primary-phone cases
pnpm test:e2e:draw-guess:mobile         drawing primary-phone cases
pnpm build                             explicit deployment build
pnpm validate:full                      explicit full integration run
```

Deployment is documented in [docs/deployment.md](./docs/deployment.md); server
templates live in `deploy/`.

The API listens on `http://localhost:8787` by default. Vite proxies `/api` and `/ws` to it during development. Browser tests start isolated servers on 5184/8794, use in-memory SQLite and never reuse development rooms, accounts or `.env` AI credentials. Keep those test ports free.

A seat belongs to the browser, not the tab, so closing a tab or restarting the
browser keeps it. To hold a second seat in one browser — which is mainly useful
when testing locally — open `?seat=2` (`?seat=3`, and so on); on localhost the
room panel offers a button that does it. A seat cannot be released during a live
match: closing a tab preserves it for reconnect. Finished matches allow leaving.

## Workspace

```text
apps/web              shared React shell; games/catan and games/draw-guess screens
apps/server           Fastify HTTP/WebSocket room service
packages/game-core    deterministic rules and state
packages/protocol     message contracts and player-safe views
```

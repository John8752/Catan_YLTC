# Catan YLTC

A server-authoritative browser board game for private groups. The first playable release supports complete 3–4 player base-rule matches; the architecture keeps 2–6 player profiles and future expansions as explicit follow-up work.

First playable status: room creation/join, independent per-tab seats, snake setup, dice production, robber/discard, building, player and maritime trade, development cards, awards, 10-point victory, reconnect and deterministic replay are implemented.

## Start here

1. Read [PRODUCT.md](./PRODUCT.md).
2. Read [docs/README.md](./docs/README.md).
3. Install dependencies with `pnpm install`.
4. Start web and server apps with `pnpm dev`.
5. Open `http://localhost:5173`.

## Commands

```text
pnpm dev       start the web and API development servers
pnpm check     type-check every workspace package
pnpm test      run deterministic and application tests
pnpm build     produce application and package builds
pnpm validate  run the complete local quality gate
pnpm validate:full  run validation plus replay and browser E2E
```

The API listens on `http://localhost:8787` by default. Vite proxies `/api` and `/ws` to it during development.

## Workspace

```text
apps/web              React UI and SVG renderer
apps/server           Fastify HTTP/WebSocket room service
packages/game-core    deterministic rules and state
packages/protocol     message contracts and player-safe views
```

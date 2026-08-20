# Catan YLTC

A server-authoritative browser board game for private 2–6 player groups. The current milestone is the deterministic M0 foundation; the first complete gameplay target is the 3–4 player base-rules profile.

M0 foundation status: runnable. Room creation, three-player start, live room broadcasts, deterministic SVG board rendering and player-safe projections are implemented. Initial piece placement is the next gameplay milestone.

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
```

The API listens on `http://localhost:8787` by default. Vite proxies `/api` and `/ws` to it during development.

## Workspace

```text
apps/web              React UI and SVG renderer
apps/server           Fastify HTTP/WebSocket room service
packages/game-core    deterministic rules and state
packages/protocol     message contracts and player-safe views
```

# Game dispatch and settings isolation audit

Date: 2026-11-25. Base: bd16c37. Scope: four existing games and shared composition points, not a new adapter framework.

## Findings and changes

| Boundary | Finding / resulting ownership |
| --- | --- |
| Server creation, capacity, start, replay, projection | Replaced last-game/default ternaries with explicit cases for all four games; default calls a never-typed unknown-game error. |
| Creation DTO, HTTP schema, registry and browser API | GameType is required. Missing, null and unknown types reject; no omitted-ID Catan fallback remains. DEFAULT_GAME_ID only initializes the visible selector/history filter. Existing test/smoke callers now explicitly request Catan. |
| Capacity / setup | Camel Up previously borrowed drawing capacity. Each non-Catan core now owns one player-limits definition, consumed by its engine, server and start control; Catan keeps its rule-profile definition. |
| Settings | Catan and drawing settings remain per-room objects in their own adapters; Camel Up and Carcassonne do not acquire those settings. Wrong-game settings requests reject. |
| Web table, history and synchronization | All four cases explicit. Unknown results show unsupported state; unknown room snapshots produce a visible error and return-to-selection action. No other game screen or policy is selected. |
| Catalog presentation | Existing catalog rows supply creation/history labels and supported result version, eliminating duplicated branch labels without introducing another registry. |
| Accounts / seats | Shared account recovery stays central. An explicitly different game/room cannot silently return the current seat: ACCOUNT_BUSY requires leaving it first. Same-game/exact-room recovery and global login takeover remain supported. |
| Auth, host succession, credentials, connection/revision ordering, SQLite | Already correctly shared; retained in the existing platform implementations. No second room/account store or generic command engine was added. |
| Core rules, private projections, settings, scoring, deadlines, result payloads, assets/cameras | Remain game-owned. Import/privacy guards scan all four source trees. Numeric coincidences such as a six-player partnership rule are not abstracted into another game's limits. |
| Transport | Catan's optional map/history stream remains explicitly Catan-only; plain snapshots and terminal errors are common envelopes. These paths do not choose a default game. |

Initial negative tests reproduced both capacity borrowing and unknown-game projection; both then passed after the explicit dispatch fix. A separate negative account test reproduced silent redirection to an existing different-game seat before its guard was added.

## Verified commands

- `pnpm test:plan`: shared protocol/server/web consumers selected; three non-Catan core limit definitions select their own core suites. Catan core replay and unrelated full device matrices were not run.
- `pnpm validate --scope "platform,draw-guess,camel-up,carcassonne" --build`: passed; core 53, protocol 13, server 50, web 35 tests, 7 architecture checks, four package checks/builds. No engine limits changed numerically.
- `pnpm validate --scope catan --files "packages/protocol/src/platform/index.ts,apps/server/src/rooms.ts,apps/web/src/App.tsx"`: passed; protocol 46, server 37, web 132, architecture 7 and plain-HTTP API guards 4.
- `pnpm validate:tooling`: 25 selector/inventory tests plus 7 architecture checks passed. New browser tests belong only to platform.
- `E2E_API_PORT=8796 E2E_WEB_PORT=5196 pnpm test:e2e --scope "platform,catan,draw-guess,camel-up,carcassonne" --grep "unknown game reports|account history loads|three isolated seats|guess input keeps|three seats place private|two isolated browsers" --workers=2`: 8 passed in 55.2s. Covers each game's actual entry/sync path, real Catan setup/reconnect, drawing submission, both new games' complete matches/replays, account-result lazy loading and unknown-game recovery.

Unknown-game and result panels use Chromium desktop 1280×800 and the repository iPhone 16 browser-area 393×659 at DPR 3. Other selected multiplayer cases use their existing desktop/phone contexts. This is not physical iOS Safari validation. All browser services use isolated processes and in-memory SQLite.

After the account destination guard:
- `pnpm validate:platform --layer server --build`: 29 platform server/auth tests, 7 architecture checks, type checks and server build passed.
- `E2E_API_PORT=8796 E2E_WEB_PORT=5196 pnpm test:e2e:platform --grep "account registration" --workers=1`: 1 passed in 15.1s, covering registration, incorrect login, phone takeover, profile/logout and guest entry.
- The final change is identity-only, so the four previously passed game browser flows are not repeated. No game UI geometry or responsive layout was redesigned.

Final completion evidence: creation has no optional/default gameId at the DTO/HTTP/registry/browser boundaries; all routing switches reject unsupported IDs; capacities reference each game's own definition; negative cross-game capacity and account-destination tests first failed and then passed; per-room settings and wrong-game rejection pass; shared account/transport/SQLite remain single implementations; existing dependency/privacy/browser-API protections pass. No generic adapter framework was retained.

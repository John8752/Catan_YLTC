# Account system implementation plan

## Outcome

Add optional username/password accounts backed by a server-local SQLite database while preserving the existing guest flow. An account may have exactly one live login session and one active room seat at a time.

When the same account logs in from another browser or device, the newest successful login wins. The server invalidates the previous account session, rotates the active room's seat token, tells the previous room socket why it is being closed, and returns the replacement seat credential to the new browser. The new browser then reconnects to the same player seat without asking for the room code or display name again.

This milestone persists account identity and login sessions only. Rooms and games remain in memory under [ADR-0007](./adr/adr-0007-in-memory-single-instance-runtime.md), so a server restart still ends active matches.

The long-lived decisions are recorded separately in [ADR-0010](./adr/adr-0010-sqlite-single-session-accounts.md).

## Product decisions

- Accounts are optional. A room link, display name and room code remain sufficient for guest play.
- The login identifier and public display name are separate. The first version uses a case-insensitive ASCII username and a Unicode display name.
- An account can occupy at most one live room seat. Attempting to create or join another room returns the existing active seat instead of allocating another player.
- A room member captures the account's display name when joining. Later profile edits do not rename a match already in progress.
- The latest successful login replaces the previous login globally, including the active room connection.
- Logging out from an account with an active seat makes that seat dormant rather than converting it to an unowned guest seat. Logging in again reclaims it while the in-memory room still exists.
- Email, email verification, OAuth, password reset email, roles, matchmaking, rankings and durable match recovery are outside the first account milestone.
- With no email service, password recovery is an administrator-only offline CLI operation in the first version. It stops the service, resets the password and revokes the session; stopping already removes every in-memory room under ADR-0007, so it cannot leave a live seat credential behind.

## Accepted temporary HTTP limitation

Production currently runs on a bare-IP HTTP origin. The first implementation may run there because this is an explicit short-term product decision, but it must not describe the result as secure authentication:

- passwords and session cookies can be read or modified by anyone able to intercept the network path;
- the account cookie cannot use `Secure` or a `__Host-` prefix on the current origin;
- `HttpOnly`, `SameSite`, CSRF checks, password hashing and database protection do not compensate for missing transport encryption;
- the login UI must show a concise warning while `window.isSecureContext` is false;
- deployment documentation and validation must record that account security is provisional until HTTPS is enabled.

The HTTP cookie is named `catan_account_session` and uses `HttpOnly; SameSite=Strict; Path=/`. It is never exposed to JavaScript and is never copied into `localStorage`. After the deployment moves to HTTPS, replace it with `__Host-catan_account_session; Secure; HttpOnly; SameSite=Strict; Path=/`, revoke all old sessions once, and update the insecure-context ADR and deployment documentation.

Room `seatToken` values keep their existing browser storage because they are room-scoped credentials rather than account login sessions. A takeover always rotates the seat token, making the old browser's stored value unusable.

## Identity and credential boundaries

Three identifiers remain deliberately separate:

| Identifier | Lifetime | Authority |
| --- | --- | --- |
| `accountId` | Long-lived | SQLite account record |
| `playerId` | One room/match | In-memory `RoomMember` and `game-core` player identity |
| `seatToken` | One current ownership generation of a seat | In-memory room credential used by game HTTP and WebSocket operations |

`accountId` must not replace `playerId` in `game-core`. Account usernames, password records and account session identifiers must not enter `GameState`, public room projections or event history.

`RoomMember` gains a private nullable `accountId`. It is used only by the server to enforce one seat per account and to locate a seat during login takeover. Public clients continue to receive the existing member ID, display name, color and host flag.

## SQLite scope and schema

Use the Node runtime's `node:sqlite` API behind a repository interface. Raise the supported Node floor to a version that contains the required SQLite and backup APIs before merging the database slice. Do not introduce an ORM for the initial two-table model.

The database lives outside the Git checkout:

```text
production: /var/lib/catan/catan.sqlite
development: <workspace>/.data/catan.sqlite
tests:       :memory: or one temporary database per test
```

Initial schema:

```sql
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  username_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  password_changed_at INTEGER NOT NULL
) STRICT;

CREATE TABLE account_sessions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL UNIQUE,
  token_hash BLOB NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
) STRICT;

CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  checksum TEXT NOT NULL,
  applied_at INTEGER NOT NULL
) STRICT;
```

`UNIQUE(account_id)` encodes the single-session rule in storage rather than relying only on application code. A cookie contains `sessionId.secret`; SQLite stores the session ID and a SHA-256 hash of the random secret. Login replaces the account's session row in one transaction.

Database startup applies:

```text
PRAGMA foreign_keys = ON
PRAGMA journal_mode = WAL
PRAGMA synchronous = NORMAL
PRAGMA busy_timeout = 5000
```

All SQL values use bound parameters. Migrations are ordered SQL files with immutable checksums and run inside transactions. Application startup fails loudly on a missing directory, migration mismatch or newer unknown schema.

## Password and session policy

- Hash passwords with asynchronous `node:crypto` scrypt using a random salt and encoded algorithm parameters. Benchmark the chosen work factor on the production `t3.micro` before freezing it.
- Limit concurrent password hashes with a small server-side semaphore so a login burst cannot consume the machine's memory.
- Registration and login have separate per-IP rate limits. Login also uses a normalized-username bucket without logging the username or request body.
- Unknown usernames run the same dummy scrypt verification path and receive the same public error as a wrong password.
- Generate account IDs, session IDs, session secrets and replacement seat tokens on the server with `node:crypto`.
- Default account session lifetime is configurable. Updating `last_seen_at` is throttled so every API request does not cause a SQLite write.
- Password change and administrator password reset revoke the account session and rotate any active seat credential.
- Do not store raw passwords, raw account session secrets, room seat tokens, reset passwords or authentication request bodies in SQLite or logs.

## Server architecture

Planned structure:

```text
apps/server/src/
  auth/
    account-service.ts
    account-repository.ts
    password.ts
    session-cookie.ts
    auth-context.ts
  database/
    sqlite-database.ts
    migrations/
    backup.ts
  routes/
    auth.ts
  rooms.ts                 account binding and takeover orchestration
  app.ts                   composition and route registration
```

`AccountRepository` owns database operations. `AccountService` owns normalization, password verification, session rotation and public errors. Fastify routes own cookies, request validation, rate limits and CSRF checks. `RoomRegistry` remains the authority for player seats and live subscriptions.

Do not put SQLite, password or cookie code in `game-core`. Network request/response types and the new player-visible WebSocket message belong in `packages/protocol`.

## API contract

First-version endpoints:

```text
POST  /api/auth/register
POST  /api/auth/login
POST  /api/auth/logout
GET   /api/auth/me
PATCH /api/account/profile
POST  /api/account/change-password
```

Registration request:

```json
{
  "username": "wjw_01",
  "displayName": "北岸旅人",
  "password": "..."
}
```

Login and registration responses use the same shape:

```json
{
  "account": {
    "id": "account_...",
    "username": "wjw_01",
    "displayName": "北岸旅人"
  },
  "csrfToken": "...",
  "activeSeat": {
    "roomId": "A1B2C3",
    "playerId": "player_...",
    "seatToken": "replacement-token",
    "room": "player-specific RoomView"
  }
}
```

`activeSeat` is `null` when the account has no live room. The account session secret exists only in the `Set-Cookie` header.

All state-changing requests authenticated by the account cookie require a same-origin check and an `X-CSRF-Token` value obtained from the login or `/api/auth/me` response. Derive that token with an HMAC over a fixed CSRF label using the raw session secret supplied by the HttpOnly cookie; it needs no extra database secret and cannot be used to reconstruct the account session. CORS remains disabled.

Room creation and join continue accepting a display name for guests. When an account cookie is present, the server uses the authenticated account ID, defaults the room name from the account profile and binds the newly allocated member to that account. The server never trusts an `accountId` sent in a request body.

## Last-login-wins takeover sequence

After password verification, the login handler performs the following steps without an asynchronous gap between the SQLite commit and in-memory takeover:

1. Ask `RoomRegistry` for the account's active member, if one exists, and prepare its replacement token without exposing it.
2. Create a new random account session and replace the old session row inside a SQLite transaction.
3. Install the prepared `seatToken` on that member before notifying any client.
4. Send `account_session_replaced` to every old subscription for that player, then close those sockets with an application close code.
5. Project the room for the same `playerId` and include the replacement seat credential in the login response.
6. The new browser writes the returned room credential through the existing `PlayerSessionStore`, installs the returned room snapshot and opens the normal room WebSocket.

The old browser handles `account_session_replaced` like the existing terminal `room_closed` message: stop the reconnect loop first, clear its room credential and account view, then show “该账号已在另一台设备登录”. A bare socket `close` is insufficient because the current client automatically reconnects every second.

The seat-token rotation is mandatory. Revoking only the account cookie would leave the old browser's room token able to call game APIs and open `/ws` again.

SQLite state and room state cannot share a physical transaction. The sequence is nevertheless safe in this single-process runtime: the room mutation is synchronous before the login response is exposed, and a process crash discards the in-memory room under ADR-0007. Tests must lock this ordering down.

## Browser behavior

The welcome page remains usable without an account. Add a secondary account affordance rather than placing the create/join controls behind authentication.

- App bootstrap calls `/api/auth/me` with same-origin credentials.
- A valid response fills the display-name field and exposes an account menu.
- A login response with `activeSeat` bypasses the welcome form and reconnects immediately.
- A login response without a seat stays on the welcome page with the profile name prefilled.
- Auth session state and CSRF state live in React memory; only the server-managed HttpOnly cookie persists the login.
- The existing room `PlayerSessionStore` remains responsible for the current seat token.
- Registration/login/profile forms use existing Radix/shadcn primitives, preserve keyboard focus and use Simplified Chinese copy.
- The HTTP warning is visible in the account form but does not block the explicitly accepted short-term login flow.

## Deployment and operations

The database slice must update `deploy/catan.service` with:

```ini
StateDirectory=catan
UMask=0077
Environment=DATABASE_PATH=/var/lib/catan/catan.sqlite
```

This makes `/var/lib/catan` writable while retaining `ProtectSystem=strict`. The database must never live inside `/opt/catan`, the deployed Git checkout or a temporary directory.

Add commands for migration status, integrity checking, online backup and offline administrator password reset. Backups use SQLite's backup API rather than copying only the main file while WAL mode is active. A systemd timer should write dated backups outside the live database directory and prune by an explicit retention policy. The first reset command requires a deliberate service stop because an external CLI cannot safely mutate the live process's in-memory seat ownership.

`docs/deployment.md` remains unchanged while this document is only a plan because it accurately describes the currently deployed no-database service. The implementation commit that first enables SQLite must update the deployment guide, systemd unit, release validation and rollback instructions together.

## Delivery slices

### A0 — Contract and characterization

- Add protocol DTOs and error codes without changing existing room behavior.
- Characterize guest create/join/reconnect and multi-seat `?seat=` behavior.
- Add architecture tests forbidding server auth/database imports from `game-core` and browser auth-token storage.

Exit: existing guest behavior is unchanged and account types expose no secret fields.

### A1 — SQLite foundation

- Add database path configuration, startup/open/close lifecycle and migrations.
- Add `AccountRepository` with in-memory SQLite tests.
- Add production state-directory and backup commands.
- Amend ADR-0007 only by reference: rooms remain in memory; account identity is the explicit persisted exception defined by ADR-0010.

Exit: schema migration, restart persistence, uniqueness, foreign keys, integrity check and backup/restore tests pass.

### A2 — Registration and authentication

- Implement normalization, scrypt hashing, register/login/logout/me and CSRF checks.
- Enforce one session row per account and last-login-wins at the account API level.
- Add rate limiting, dummy verification and generic credential errors.

Exit: a second login invalidates the first cookie immediately; raw secrets never appear in responses, storage inspection or logs.

### A3 — Account-bound seats and takeover

- Add private `accountId` to room members.
- Enforce one active room seat per account.
- Implement synchronous seat-token rotation and subscription replacement.
- Add the `account_session_replaced` protocol message and terminal client handling.
- Return and install `activeSeat` during login.

Exit: a phone login takes over a computer's live seat, the computer stops reconnecting, its old HTTP and WebSocket credentials fail, and the phone sees the same private hand and current revision.

### A4 — Account UI

- Add optional registration/login entry points and account menu.
- Prefill display names without changing active matches.
- Add logout, profile edit, password change and insecure-HTTP warning flows.
- Keep guest entry as the primary zero-friction path.

Exit: desktop and primary portrait phone tests cover guest play, first login, invalid login, takeover, logout and reconnect focus/error behavior.

### A5 — Operations and release validation

- Add administrator password-reset and database-backup commands.
- Update deployment, environment, backup, restore and rollback documentation.
- Exercise a restart that preserves accounts but deliberately loses the active room.
- Run the full validation gate and a real computer-to-phone takeover playtest.

Exit: the release has a restorable database backup and evidence that exactly one device retains control after takeover.

## Required regression matrix

### Repository and service tests

- username normalization and confusable policy;
- password hash round-trip, wrong password and parameter upgrade;
- account/session uniqueness and migration repeatability;
- expired, revoked, disabled and replaced sessions;
- CSRF and Origin failures;
- no raw secrets in logs or protocol projections;
- guest behavior unchanged;
- one account cannot allocate two live seats;
- register or login while already seated returns the existing seat;
- takeover rotates the seat token before closing old subscriptions;
- old HTTP command and old `/ws` subscription fail after takeover;
- duplicate or racing logins leave exactly one winning session and one usable seat token;
- profile rename does not mutate a running game's player name;
- logout and password reset make the active seat dormant and recoverable only by the next valid login;
- account database survives restart while rooms continue to follow ADR-0007.

### Browser end-to-end tests

Use two isolated browser contexts representing a computer and a phone:

1. Computer logs in, creates a room and receives a private room projection.
2. Phone logs in with the same account.
3. Computer receives the replacement message, stops reconnecting and returns to the entry screen.
4. Phone automatically enters the same room with the same `playerId`, private cards and latest revision.
5. Computer's stored old seat token cannot read the room, submit a command or open a socket.
6. A third guest browser remains connected and sees no account identifier or private data.

Run `pnpm validate`, focused server/auth tests, the takeover E2E, `pnpm test:e2e:mobile`, the remaining E2E suite and a production-shape restart/backup smoke test before release.

## Documentation updates by slice

| File | When | Change |
| --- | --- | --- |
| `PRODUCT.md` | Plan commit | Record optional accounts as a post-M0 milestone without changing the guest principle |
| `docs/README.md` | Plan commit | Link this implementation plan |
| `docs/adr/README.md` | Plan commit | Index proposed ADR-0010 |
| `AGENTS.md` | Plan commit | Add account/session/database boundary rules for future implementation agents |
| `docs/risks-and-open-questions.md` | Plan commit | Record the temporary HTTP credential risk and the accepted single-session policy |
| `docs/deployment.md` | A1/A5, not plan-only | Replace the no-database instructions with real paths, permissions, backup and restore commands when they exist |
| ADR-0007 | A1 | Cross-reference the persisted-account exception; do not rewrite its historical in-memory room decision |
| insecure-context ADR/constraints | HTTPS migration | Remove the temporary HTTP exception only when deployment actually moves to HTTPS |

## First implementation move

After this plan is approved, implement A0 and A1 only. Do not start with the login form. The first failing integration test should prove that an account created in a temporary SQLite database remains readable after closing and reopening the repository, while an existing guest room flow remains byte-for-byte compatible at the protocol boundary.

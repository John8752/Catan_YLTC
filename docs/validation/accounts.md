# Accounts and game-scoped final settlements

Validated locally on 2026-09-05, Windows, Node 22.22.3, pnpm 9.15.4. This is implementation validation, not a production deployment or physical-device certification.

## Delivered behavior

- Optional registration/login, profile name changes, password changes, logout and account match history; guest entry and room-scoped seat recovery remain available.
- Newest login replaces the previous account session and all linked room credentials before old subscriptions close. The new browser adopts the same player seat. Logged-out/expired seats remain recoverable while the room exists. Finished rooms release the active-seat allowance.
- Global account identity with final results partitioned by game type (`gameId=catan`), independent UUID `matchId`, and versioned game-specific JSON payload. Catan v1 retains public participants, winner, rule settings and the complete canonical final score/resource/dice/activity summary.
- Atomic, immutable result/participant writes before publishing victory; failed writes leave the command retryable. No partial archive for disbanded, evicted or restarted unfinished games.
- SQLite migration checksums, account/session uniqueness, database permissions, online backup, retention timer, restore/revocation instructions and offline password-reset CLI. Runtime/offline maintenance are mutually exclusive using an OS-backed SQLite lock.

## Commands and results

| Command | Result |
| --- | --- |
| `pnpm validate` (final run) | Passed: check, 260 tests across 72 files, production build |
| `pnpm test:e2e:mobile` | Passed: 25 Chromium primary-phone cases |
| `pnpm exec playwright test --grep-invert '@primary-phone'` | Passed: 49 remaining Chromium cases, including the original three account cases |
| `pnpm exec playwright test tests/e2e/accounts.spec.ts` (final run) | Passed: 4 account cases, including the added expired-menu regression and simulated HTTP warning |
| `node scripts/account-runtime-smoke.mjs` (final build) | Passed: production bundle startup, restart, online backup, active-runtime reset rejection, offline reset, restored identity and session revocation |
| `bash -n deploy/release.sh` (Git Bash) | Passed syntax check; release script was not deployed/executed |
| `git diff --check` | Passed |

Focused backend regressions additionally cover cross-game payload variation, account isolation, duplicate archive writes, FK rollback, immutable participants, migration tampering, password round-trip, replacement/expiry/password revocation, Origin/CSRF rejection, concurrent logins, guest-seat claiming, token invalidation before subscription closure, unchanged in-game names, and credentials excluded from core state and settlement data.

The production smoke test uses a temporary database outside the repository and removes it after the run. Repository tests independently preserve final settlements across database close/reopen and backup/restore. Running games deliberately disappear on server restart.

## Browser and visual matrix

Actual engine: Playwright Chromium, using installed iPhone descriptors with DPR 3. CSS viewport sizes:

| Model | Portrait full canvas | Portrait browser area |
| --- | --- | --- |
| iPhone 16 | 393 × 852 | 393 × 659 |
| iPhone 16 Pro Max | 440 × 956 | 440 × 763 |

Inspected four- and six-player screenshots for all eight model/area/player-count combinations. Checked account-control placement, map/port content, number tokens, dock, bank/map disclosures, required-action visibility and document containment. The remaining suite also exercises browser-bar resizing and simulated safe-area changes. Older 360/390-wide and desktop cases remain compatibility coverage.

Account history was separately inspected at desktop 1280 × 800 and iPhone 16 browser area with six players and long names. The dialog wraps text without horizontal overflow, scrolls vertically, and restores trigger focus on Escape. HTTP warning rendering is tested by overriding the context flag in a fixture; that is not a physical HTTP-origin security test. Real register/login/invalid-login/takeover/rename/logout/refresh behavior was tested using isolated desktop, phone-emulated and guest contexts.

Game screenshots are generated under `output/playwright/adaptive-{4|6}-{width}x{height}.png`; account screenshots are under the corresponding ignored `test-results/accounts-*` directories. These generated artifacts are not repository source.

## Remaining release checks and observations

- Physical iPhone/Safari checks were not run. Real Safari chrome, notch/home indicator, keyboard and touch behavior still need a device playtest.
- The six-player map in the shorter browser areas still has visually small port content; edge ports approach or partially meet the viewport clipping boundary. Passing the existing bounded-overflow/proportion assertions does not establish comfortable readability. No SVG scale compensation was added.
- Linux systemd permissions, timer execution, production t3.micro scrypt latency/peak memory and an off-machine backup copy have not been exercised on production. Follow the deployment manual before release. The Windows process-stop smoke does not certify Linux SIGTERM behavior.
- Plain HTTP remains an accepted temporary exposure. No `Secure` cookie or HSTS was introduced; the account form displays the warning on an insecure context.
- Node 22 emits an experimental SQLite warning. Vite reports the main JavaScript chunk at approximately 506 KB before gzip (158 KB gzip); the build passes but its size warning remains.

## Issues caught during validation

The browser test caught Vite's shorthand proxy rewriting Host and causing valid login requests to fail Origin checks. The development proxy now preserves Host. The production smoke caught tsup removing the `node:` prefix from SQLite imports; the build now preserves prefix-only builtins. A stale account menu now returns the user to login when its session is rejected. All affected checks were rerun successfully.

## Shared settlement panel and credential lengths (2026-09-05)

Account history now renders the existing Catan victory panel directly, with its five statistics tabs and no disclosure dropdown. Live and archived rendering share one component consuming the existing v1 durable payload. A regression compares every tab after JSON serialization, and the settlement transaction test checks winner, player name/color snapshots, rule profile, target and the full summary against the live projection. Existing v1 records require no migration.

Usernames, account display names and passwords have no product character-count range; nonempty validation remains. Registration, login, profile edit, password change and offline password reset follow this policy. Room name validation also accepts long account display names. API coverage exercises single-character and long credentials (including a 600-character replacement password), profile editing and room creation. The browser flow registers and logs in with a username over 32 characters and a one-character password. Ordinary request-size limits remain in place.

Validation for this change: `pnpm validate` passed (268 tests, type checking and builds); `pnpm exec playwright test tests/e2e/accounts.spec.ts` passed all four tests. Visually inspected six-player long-name history screenshots in Chromium at desktop 1280 × 800 and iPhone 16 portrait browser area 393 × 659, DPR 3. Verified all five tabs, scrolling, dialog containment, Escape and trigger focus restoration. This was an isolated account dialog/result panel change; no map, HUD, viewport or shared breakpoint changes were made. No physical iPhone or Safari validation was performed.

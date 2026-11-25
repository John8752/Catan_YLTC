# ADR-0018: Explicit game dispatch without game fallbacks

- Status: accepted
- Date: 2026-11-25

## Decision

Every game-selection switch names Catan, drawing telephone, Camel Up and Carcassonne explicitly. Its default rejects an unregistered game; it never invokes another game. This applies to server creation, capacity, start, replay and projection, and web tables, account results and synchronization policies. A `never` argument makes a new registered game require new cases at compile time. Keep the existing small explicit dispatch; no universal adapter framework or rules abstraction is introduced.

Each non-Catan game defines its player limits once in its own game-core module. That game's core setup validation, server adapter and web start control consume its definition. Catan retains its named rule-profile limits. Lobby settings, commands, scoring, deadlines, renderer geometry and settlement payloads remain game-owned.

The common room/account/seat directory, safe transport envelope, lifecycle checks, credential recovery and SQLite repository remain shared. Existing catalog presentation labels are reused by the entry and account shell. Game-specific defaults/settings objects are instantiated separately per room. Do not extract unrelated game rules just because they currently have equal numbers.

Account recovery must respect an explicitly requested destination: creating another game or joining a different room reports ACCOUNT_BUSY; recovery of the same game's current seat or the exact requested room stays supported. Authentication takeover remains a separate explicit active-seat recovery flow.

Unknown wire snapshots become an explicit UNKNOWN_GAME error. The web displays the error and a return-to-lobby choice; unknown HTTP snapshots likewise fail before selecting any synchronization policy. Unsupported historical results show an unsupported-version message. These paths never display another game's table. Room creation requires an explicit GameType at the protocol, HTTP and registry boundaries. Missing and unknown IDs are rejected; browser room creation passes the selected type. DEFAULT_GAME_ID remains only an initial selector/history-filter value, never a server fallback.

## Verification

Deterministic tests first reproduced capacity borrowing and unknown-ID projection. Boundary tests perturb drawing capacity, verify the other games remain independent, verify settings isolation, and check explicit switch coverage/default errors. Existing import/privacy/plain-HTTP guards remain active. Record the audit and actual scoped validation in docs/validation/game-capability-isolation.md.

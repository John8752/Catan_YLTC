/** Released migrations are immutable; new changes append a new version. */
export const migrations = [
  `CREATE TABLE accounts (
    id TEXT PRIMARY KEY, username_key TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('active','disabled')),
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, password_changed_at INTEGER NOT NULL
  ) STRICT;
  CREATE TABLE account_sessions (
    id TEXT PRIMARY KEY, account_id TEXT NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  ) STRICT;`,
  `CREATE TABLE match_results (
    game_id TEXT NOT NULL, match_id TEXT NOT NULL, data_version INTEGER NOT NULL CHECK(data_version > 0),
    started_at INTEGER NOT NULL, finished_at INTEGER NOT NULL CHECK(finished_at >= started_at),
    data_json TEXT NOT NULL CHECK(json_valid(data_json)), PRIMARY KEY(game_id, match_id)
  ) STRICT;
  CREATE TABLE account_matches (
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    game_id TEXT NOT NULL, match_id TEXT NOT NULL, player_id TEXT NOT NULL,
    PRIMARY KEY(account_id, game_id, match_id),
    FOREIGN KEY(game_id, match_id) REFERENCES match_results(game_id, match_id) ON DELETE CASCADE
  ) STRICT;
  CREATE INDEX account_matches_history ON account_matches(account_id, game_id);
  CREATE INDEX match_results_history ON match_results(game_id, finished_at DESC, match_id DESC);`,
] as const;

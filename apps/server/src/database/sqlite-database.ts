import { createHash } from "node:crypto";
import { chmodSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { backup, DatabaseSync } from "node:sqlite";
import { migrations } from "./migrations.js";

export class SqliteDatabase {
  readonly db: DatabaseSync;
  constructor(readonly path: string) {
    if (path !== ":memory:" && !isAbsolute(path)) throw new Error("DATABASE_PATH must be absolute");
    // Never silently create a misspelled parent directory.
    if (path !== ":memory:") realpathSync(dirname(path));
    this.db = new DatabaseSync(path);
    try {
      if (path !== ":memory:" && process.platform !== "win32") chmodSync(path, 0o600);
      this.db.exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA busy_timeout=5000;");
      this.db.exec("CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, checksum TEXT NOT NULL, applied_at INTEGER NOT NULL) STRICT");
      this.transaction(() => {
        const rows = this.db.prepare("SELECT version, checksum FROM schema_migrations ORDER BY version").all();
        if (rows.length > migrations.length) throw new Error("Unknown newer database schema");
        for (const [index, sql] of migrations.entries()) {
          const version = index + 1;
          const checksum = createHash("sha256").update(sql).digest("hex");
          const row = rows[index];
          if (row !== undefined) {
            if (row.version !== version || row.checksum !== checksum) throw new Error("Migration checksum/version mismatch");
          } else {
            this.db.exec(sql);
            this.db.prepare("INSERT INTO schema_migrations VALUES(?,?,?)").run(version, checksum, Date.now());
          }
        }
      });
    } catch (error) { this.db.close(); throw error; }
  }
  transaction<T>(action: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try { const result = action(); this.db.exec("COMMIT"); return result; }
    catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  integrity(): boolean {
    return this.db.prepare("PRAGMA integrity_check").get()?.integrity_check === "ok"
      && this.db.prepare("PRAGMA foreign_key_check").all().length === 0;
  }
  async backup(destination: string): Promise<void> {
    await backup(this.db, destination);
    if (process.platform !== "win32") chmodSync(destination, 0o600);
  }
  close(): void { this.db.close(); }
}

export function assertExternalDatabase(path: string, checkout: string): void {
  const canonical = resolve(realpathSync(dirname(path)), path.split(/[\\/]/).at(-1)!);
  const inside = relative(realpathSync(checkout), canonical);
  if (!isAbsolute(path) || inside === "" || (!inside.startsWith("..") && !isAbsolute(inside))) {
    throw new Error("DATABASE_PATH must be outside the repository");
  }
}

import { chmodSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

/** OS-backed exclusive lock, automatically released on process crash.
 * The separate empty file contains no account data and does not lock the live WAL database.
 */
export function acquireRuntimeLock(databasePath: string): () => void {
  const path = `${databasePath}.runtime-lock`;
  const lock = new DatabaseSync(path);
  try {
    if (process.platform !== "win32") chmodSync(path, 0o600);
    lock.exec("PRAGMA busy_timeout=0; BEGIN EXCLUSIVE");
  } catch {
    lock.close();
    throw new Error("Database runtime is active; stop the service before offline maintenance");
  }
  return () => { try { lock.exec("ROLLBACK"); } finally { lock.close(); } };
}

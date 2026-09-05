import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, expect, it } from "vitest";
import { SqliteDatabase, assertExternalDatabase } from "./sqlite-database.js";
import { SqliteAccountRepository } from "./sqlite-account-repository.js";
import { SqliteMatchRepository } from "./match-repository.js";
import { acquireRuntimeLock } from "./runtime-lock.js";

const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true }); });
const account = { id: "a", username: "alice", displayName: "北岸", passwordHash: "encoded", status: "active" as const };
function path() { const directory = mkdtempSync(join(tmpdir(), "catan-db-")); directories.push(directory); return join(directory, "test.sqlite"); }

it("excludes another runtime or offline reset until the first lock closes", () => {
  const file = path(); const unlock = acquireRuntimeLock(file);
  expect(() => acquireRuntimeLock(file)).toThrow("active");
  unlock();
  acquireRuntimeLock(file)();
});

it("persists identity and final results after restart, backup and restore, isolates accounts and game IDs", async () => {
  const file = path(); const backup = path();
  let database = new SqliteDatabase(file);
  const accounts = new SqliteAccountRepository(database);
  accounts.insert(account, 1);
  accounts.insert({ ...account, id: "b", username: "bob" }, 1);
  const matches = new SqliteMatchRepository(database);
  const record = { gameId: "catan", matchId: "same-id", dataVersion: 1, startedAt: 1, finishedAt: 2, data: { points: 10 } };
  matches.save(record, [{ accountId: "a", playerId: "p1" }]);
  matches.save({ ...record, data: { points: 99 } }, [{ accountId: "b", playerId: "p2" }]);
  matches.save({ ...record, gameId: "chess", dataVersion: 3, data: { outcome: "draw" } }, [{ accountId: "a", playerId: "white" }]);
  expect(() => matches.save({ ...record, matchId: "invalid" }, [{ accountId: "missing", playerId: "p1" }])).toThrow();
  expect(database.db.prepare("SELECT count(*) n FROM match_results").get()?.n).toBe(2);
  expect(database.integrity()).toBe(true);
  await database.backup(backup);
  database.close();
  database = new SqliteDatabase(file);
  expect(new SqliteAccountRepository(database).findUsername("alice")).toEqual(account);
  const history = new SqliteMatchRepository(database);
  expect(history.history("a", "catan", 0, 20).matches[0]?.data).toEqual({ points: 10 });
  expect(history.history("b", "catan", 0, 20).matches).toEqual([]);
  expect(history.history("a", "chess", 0, 20).matches[0]).toMatchObject({ dataVersion: 3, data: { outcome: "draw" } });
  database.close();
  const restored = new SqliteDatabase(backup);
  expect(restored.integrity()).toBe(true);
  expect(new SqliteMatchRepository(restored).history("a", "catan", 0, 20).matches).toHaveLength(1);
  restored.close();
});

it("enforces uniqueness and keeps one session per account", () => {
  const database = new SqliteDatabase(":memory:"); const repository = new SqliteAccountRepository(database);
  repository.insert(account, 1);
  expect(() => repository.insert({ ...account, id: "b" }, 1)).toThrow();
  const session = { id: "s1", accountId: "a", tokenHash: "hash1", createdAt: 1, lastSeenAt: 1, expiresAt: 99 };
  repository.replaceSession(session); repository.replaceSession({ ...session, id: "s2", tokenHash: "hash2" });
  expect(repository.findSession("s1")).toBeNull(); expect(repository.findSession("s2")).not.toBeNull();
  repository.updatePassword("a", "newHash", 5); expect(repository.findSession("s2")).toBeNull();
  database.close();
});

it("rejects changed or unknown migrations and database paths inside the checkout", () => {
  const file = path(); const database = new SqliteDatabase(file); database.close();
  const raw = new DatabaseSync(file);
  raw.exec("UPDATE schema_migrations SET checksum='tampered' WHERE version=1"); raw.close();
  expect(() => new SqliteDatabase(file)).toThrow("mismatch");
  expect(() => assertExternalDatabase(join(process.cwd(), "account.sqlite"), process.cwd())).toThrow("outside");
  expect(() => new SqliteDatabase(join(file, "missing", "db.sqlite"))).toThrow();
});

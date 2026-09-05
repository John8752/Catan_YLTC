import { mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { SqliteDatabase } from "./sqlite-database.js";
import { SqliteAccountRepository } from "./sqlite-account-repository.js";
import { acquireRuntimeLock } from "./runtime-lock.js";
import { hashPassword } from "../auth/password.js";

const [command, argument, retentionArg] = process.argv.slice(2);
const databasePath = process.env.DATABASE_PATH;
if (!databasePath) throw new Error("Set an absolute DATABASE_PATH outside the checkout");
let unlock: (() => void) | undefined;
if (command === "reset-password" || command === "revoke-sessions") unlock = acquireRuntimeLock(databasePath);
let database: SqliteDatabase | undefined;
try {
  database = new SqliteDatabase(databasePath);
  if (command === "status") {
    console.log(JSON.stringify(database.db.prepare("SELECT version, checksum, applied_at FROM schema_migrations ORDER BY version").all()));
  } else if (command === "integrity") {
    if (!database.integrity()) throw new Error("Database integrity check failed");
    console.log("Integrity OK");
  } else if (command === "backup") {
    if (!argument) throw new Error("backup requires a destination directory and optional retention days (default 14)");
    const days = Number(retentionArg ?? "14");
    if (!Number.isInteger(days) || days < 1 || days > 3650) throw new Error("Invalid retention days");
    const directory = resolve(argument);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const destination = resolve(directory, `catan-backup-${Date.now()}-${randomUUID()}.sqlite`);
    await database.backup(destination);
    const check = new SqliteDatabase(destination);
    try { if (!check.integrity()) throw new Error("Backup integrity failed"); } finally { check.close(); }
    for (const name of readdirSync(directory)) {
      const match = /^catan-backup-(\d+)-[0-9a-f-]+\.sqlite$/.exec(name);
      if (match && Number(match[1]) < Date.now() - days * 86400_000) unlinkSync(resolve(directory, name));
    }
    console.log(destination);
  } else if (command === "reset-password") {
    if (!argument || !/^[A-Za-z0-9_]+$/.test(argument)) throw new Error("reset-password requires a username");
    if (process.stdin.isTTY) throw new Error("Provide the new password on stdin, never as a command-line argument");
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(Buffer.from(chunk));
    }
    const password = Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "");
    if (!password) throw new Error("Password is required");
    const repository = new SqliteAccountRepository(database);
    const account = repository.findUsername(argument.toLowerCase());
    if (!account) throw new Error("Account not found");
    repository.updatePassword(account.id, await hashPassword(password), Date.now());
    console.log("Password reset; account session revoked");
  } else if (command === "revoke-sessions") {
    database.db.exec("DELETE FROM account_sessions");
    console.log("All sessions revoked");
  } else throw new Error("Usage: status | integrity | backup <directory> [retention-days] | reset-password <username> | revoke-sessions");
} finally { database?.close(); unlock?.(); }

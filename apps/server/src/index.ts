import { acquireRuntimeLock } from "./database/runtime-lock.js";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SqliteDatabase, assertExternalDatabase } from "./database/sqlite-database.js";
import {
  buildApp,
  DEFAULT_AI_REQUESTS_PER_MINUTE,
  DEFAULT_IDLE_ROOM_TTL_MS,
  DEFAULT_ROOM_CREATIONS_PER_MINUTE,
} from "./app.js";
import { DeepSeekCommentator } from "./ai-commentary.js";

const port = Number.parseInt(process.env.PORT ?? "8787", 10);
const host = process.env.HOST ?? "0.0.0.0";
const logLevel = process.env.LOG_LEVEL ?? "info";
const deepSeekApiKey = process.env.DEEPSEEK_API_KEY?.trim();
const defaultDataDir = resolve(homedir(), ".catan-yltc");
if (!process.env.DATABASE_PATH && process.env.NODE_ENV === "production") throw new Error("DATABASE_PATH is required in production");
if (!process.env.DATABASE_PATH) mkdirSync(defaultDataDir, { recursive: true, mode: 0o700 });
const databasePath = process.env.DATABASE_PATH ?? resolve(defaultDataDir, "catan.sqlite");
assertExternalDatabase(databasePath, fileURLToPath(new URL("../../..", import.meta.url)));
const unlock = acquireRuntimeLock(databasePath);
const database = new SqliteDatabase(databasePath);
const app = await buildApp(undefined, {
  database,
  sessionLifetimeMs: readPositiveInt("ACCOUNT_SESSION_DAYS", 30) * 86400_000,
  logger: { level: logLevel },
  // Caddy is the only thing that can reach this process, so its X-Forwarded-For
  // is the real client address. Widen only if another hop is added in front.
  trustProxy: process.env.TRUST_PROXY ?? "127.0.0.1",
  idleRoomTtlMs: readPositiveInt("ROOM_IDLE_TTL_MINUTES", DEFAULT_IDLE_ROOM_TTL_MS / 60_000) * 60_000,
  roomCreationsPerMinute: readPositiveInt(
    "ROOM_CREATIONS_PER_MINUTE",
    DEFAULT_ROOM_CREATIONS_PER_MINUTE,
  ),
  aiRequestsPerMinute: readPositiveInt("AI_REQUESTS_PER_MINUTE", DEFAULT_AI_REQUESTS_PER_MINUTE),
  aiCommentator: deepSeekApiKey === undefined || deepSeekApiKey.length === 0
    ? null
    : new DeepSeekCommentator({
        apiKey: deepSeekApiKey,
        ...(process.env.DEEPSEEK_MODEL === undefined ? {} : { model: process.env.DEEPSEEK_MODEL }),
        ...(process.env.DEEPSEEK_BASE_URL === undefined ? {} : { baseUrl: process.env.DEEPSEEK_BASE_URL }),
      }),
});

app.addHook("onClose", async () => { database.close(); unlock(); });

// systemd sends SIGTERM on restart/stop: close listeners and in-flight sockets
// before exiting so players get a clean disconnect instead of a severed socket.
let shuttingDown = false;
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info({ signal }, "shutting down");
    app.close().then(
      () => process.exit(0),
      (error) => {
        app.log.error(error, "shutdown failed");
        process.exit(1);
      },
    );
  });
}

try {
  await app.listen({ port, host });
  app.log.info({ port, host, node: process.version, logLevel }, "Catan server listening");
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}

function readPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;

  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer, received ${raw}`);
  }
  return value;
}

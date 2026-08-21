import {
  buildApp,
  DEFAULT_IDLE_ROOM_TTL_MS,
  DEFAULT_ROOM_CREATIONS_PER_MINUTE,
} from "./app.js";

const port = Number.parseInt(process.env.PORT ?? "8787", 10);
const host = process.env.HOST ?? "0.0.0.0";
const logLevel = process.env.LOG_LEVEL ?? "info";
const app = await buildApp(undefined, {
  logger: { level: logLevel },
  // Caddy is the only thing that can reach this process, so its X-Forwarded-For
  // is the real client address. Widen only if another hop is added in front.
  trustProxy: process.env.TRUST_PROXY ?? "127.0.0.1",
  idleRoomTtlMs: readPositiveInt("ROOM_IDLE_TTL_MINUTES", DEFAULT_IDLE_ROOM_TTL_MS / 60_000) * 60_000,
  roomCreationsPerMinute: readPositiveInt(
    "ROOM_CREATIONS_PER_MINUTE",
    DEFAULT_ROOM_CREATIONS_PER_MINUTE,
  ),
});

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

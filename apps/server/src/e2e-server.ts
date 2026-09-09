// Isolated browser-test server: no user database, .env secrets or external AI calls.
import { buildApp } from "./app.js";
const app = await buildApp(undefined, { roomCreationsPerMinute: 10_000, logger: false });
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => { void app.close().then(() => process.exit(0)); });
await app.listen({ port: Number(process.env.E2E_API_PORT ?? 8794), host: "127.0.0.1" });

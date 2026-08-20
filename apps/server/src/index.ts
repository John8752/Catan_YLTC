import { buildApp } from "./app.js";

const port = Number.parseInt(process.env.PORT ?? "8787", 10);
const host = process.env.HOST ?? "0.0.0.0";
const app = await buildApp();

try {
  await app.listen({ port, host });
  app.log.info(`Catan server listening on http://${host}:${port}`);
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}

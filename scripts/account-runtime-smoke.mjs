// Run after pnpm build. Uses a temporary database outside the checkout.
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readdirSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { createServer } from "node:net";
import { once } from "node:events";
import assert from "node:assert/strict";

const directory = mkdtempSync(join(tmpdir(), "catan-runtime-"));
const databasePath = join(directory, "live.sqlite");
const serverFile = resolve("apps/server/dist/index.js");
const cliFile = resolve("apps/server/dist/database/cli.js");
const reservation = createServer(); reservation.listen(0, "127.0.0.1"); await once(reservation, "listening");
const port = reservation.address().port; await new Promise((done) => reservation.close(done));
const origin = `http://127.0.0.1:${port}`;
const environment = { ...process.env, NODE_ENV: "production", HOST: "127.0.0.1", PORT: String(port), DATABASE_PATH: databasePath, LOG_LEVEL: "error" };
let processHandle;
async function start() {
  let startupError = "";
  processHandle = spawn(process.execPath, [serverFile], { env: environment, stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
  processHandle.stderr.on("data", (chunk) => { startupError += String(chunk); });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (processHandle.exitCode !== null) throw new Error(`Production server exited during startup: ${startupError}`);
    try { if ((await fetch(`${origin}/health`)).ok) return; } catch {}
    await new Promise((done) => setTimeout(done, 50));
  }
  throw new Error("Production server did not become healthy");
}
async function stop() {
  if (!processHandle || processHandle.exitCode !== null) return;
  const exited = once(processHandle, "exit"); processHandle.kill(); await exited;
}
async function api(path, body, cookie, csrfToken) {
  const response = await fetch(`${origin}${path}`, { method: body ? "POST" : "GET", headers: {
    origin, "content-type": "application/json", ...(cookie ? { cookie } : {}), ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
  }, ...(body ? { body: JSON.stringify(body) } : {}) });
  assert(response.ok, `Request failed: ${path} (${response.status})`);
  return { data: await response.json(), cookie: response.headers.get("set-cookie")?.split(";")[0] };
}
function cli(args, input) { return execFileSync(process.execPath, [cliFile, ...args], { env: environment, encoding: "utf8", input, stdio: ["pipe", "pipe", "pipe"], windowsHide: true }); }
try {
  await start();
  const registered = await api("/api/auth/register", { username: "runtime_smoke", displayName: "重启验收", password: "runtime-smoke-password" });
  await api("/api/rooms", { playerName: "ignored" }, registered.cookie, registered.data.csrfToken);
  assert.equal((await api("/api/auth/me", undefined, registered.cookie)).data.activeSeat.room.members.length, 1);
  cli(["backup", join(directory, "backups"), "14"]);
  assert.throws(() => cli(["reset-password", "runtime_smoke"], "new-smoke-password"));
  await stop(); await start();
  const recovered = (await api("/api/auth/me", undefined, registered.cookie)).data;
  assert.equal(recovered.account.id, registered.data.account.id); assert.equal(recovered.activeSeat, null);
  cli(["integrity"]);
  await stop();
  cli(["reset-password", "runtime_smoke"], "new-smoke-password");
  await start();
  assert.equal((await api("/api/auth/me", undefined, registered.cookie)).data, null);
  const resetLogin = await api("/api/auth/login", { username: "runtime_smoke", password: "new-smoke-password" });
  assert.equal(resetLogin.data.account.id, registered.data.account.id);
  await stop();
  const backup = readdirSync(join(directory, "backups")).find((name) => name.endsWith(".sqlite"));
  assert(backup);
  const restored = join(directory, "restored.sqlite"); copyFileSync(join(directory, "backups", backup), restored);
  environment.DATABASE_PATH = restored;
  cli(["integrity"]); cli(["revoke-sessions"]);
  await start();
  assert.equal((await api("/api/auth/me", undefined, registered.cookie)).data, null);
  const restoredLogin = await api("/api/auth/login", { username: "runtime_smoke", password: "runtime-smoke-password" });
  assert.equal(restoredLogin.data.account.id, registered.data.account.id); assert.equal(restoredLogin.data.activeSeat, null);
  console.log("PASS: production bundle, restart, online backup, offline reset guard, password reset, restore and session revocation");
} finally { await stop(); rmSync(directory, { recursive: true, force: true }); }

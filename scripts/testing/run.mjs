import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { changedFiles } from "./git-changes.mjs";
import { inventory } from "./inventory.mjs";
import { makePlan } from "./plan.mjs";
import { packages } from "./scopes.mjs";
import { dependencyOverrides } from "./dependencies.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
export function parseArgs(args) {
  const [action = "plan", ...rest] = args;
  if (!["plan", "inventory", "unit", "check", "validate", "e2e"].includes(action)) throw Error(`Unknown action: ${action}`);
  const options = {}, extra = [];
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === "--") { extra.push(...rest.slice(i + 1)); break; }
    if (["--scope", "--layer", "--base", "--head", "--files"].includes(arg)) {
      const value = rest[++i];
      if (!value || value.startsWith("--")) throw Error(`Missing value for ${arg}`);
      options[arg.slice(2)] = value;
    } else if (["--json", "--dry-run", "--build", "--browser"].includes(arg)) options[arg.slice(2)] = true;
    else extra.push(arg);
  }
  if (["plan", "inventory", "check", "validate"].includes(action) && extra.length) throw Error(`Unexpected arguments: ${extra.join(" ")}`);
  if (extra.some((arg) => arg === "--project" || arg.startsWith("--project=") || arg === "--config" || arg === "-c" || arg.startsWith("--config="))) throw Error("Use --scope to select tests; runner/config overrides can bypass ownership.");
  if (action === "unit") {
    const values = new Set(["-t", "--testNamePattern", "--reporter", "--maxWorkers", "--pool"]);
    const switches = new Set(["--silent", "--no-file-parallelism"]);
    for (let i = 0; i < extra.length; i++) {
      if (values.has(extra[i]) && extra[i + 1]) { i++; continue; }
      if (switches.has(extra[i])) continue;
      throw Error(`Unsupported unit filter ${extra[i]}; use --layer / --files or -t to narrow the owned tests.`);
    }
  }
  if (options.head && !options.base) throw Error("--head requires --base");
  if (options.files && options.base) throw Error("Use either --files or --base, not both");
  return { action, options, extra };
}

export function commandsFor(plan, { action, options = {}, extra = [] }) {
  const commands = [];
  const add = (label, cwd, args, node = false) => commands.push({ label, cwd, args, node });
  if (["check", "validate"].includes(action)) for (const name of plan.checks) add(`Type check ${name} (compiler may follow shared imports)`, ".", ["--filter", name, "check"]);
  if (["unit", "validate"].includes(action)) {
    for (const [layer, pkg] of Object.entries(packages)) {
      const files = plan.unit.filter((test) => test.layer === layer).map((test) => test.file.slice(pkg.cwd.length + 1));
      if (files.length) add(`Unit/integration: ${layer}`, pkg.cwd, ["exec", "vitest", "run", ...files, ...extra]);
    }
    const tooling = plan.unit.filter((test) => test.layer === "tooling");
    const node = tooling.filter((test) => test.file.endsWith(".mjs")).map((test) => test.file);
    const vitest = tooling.filter((test) => !test.file.endsWith(".mjs")).map((test) => test.file);
    if (node.length) add("Regression selection tests", ".", ["--test", ...node], true);
    if (vitest.length) add("Static architecture boundaries", ".", ["exec", "vitest", "run", ...vitest, ...extra]);
  }
  if (action === "validate") for (const file of plan.guards) {
    const pkg = Object.values(packages).find((pkg) => file.startsWith(`${pkg.cwd}/`));
    add("Static safety guard (no gameplay regression)", pkg?.cwd ?? ".", ["exec", "vitest", "run", pkg ? file.slice(pkg.cwd.length + 1) : file]);
  }
  if (action === "validate" && plan.build) for (const name of plan.checks) add(`Build ${name}`, ".", ["--filter", name, "build"]);
  if (action === "e2e" || (action === "validate" && options.browser)) {
    if (plan.browserScopes.length) add("Browser regression", ".", ["exec", "playwright", "test", ...plan.browserScopes.map((scope) => `--project=${scope}`), ...extra]);
  }
  return commands;
}

function execute(command) {
  const cwd = resolve(root, command.cwd);
  // pnpm runs this script with the real CLI path. No shell interpolation, also on Windows.
  const pnpm = process.env.npm_execpath;
  if (!command.node && (!pnpm || !existsSync(pnpm))) throw Error("Run executable checks through pnpm (for example pnpm validate:draw-guess).");
  const result = spawnSync(process.execPath, command.node ? command.args : [pnpm, ...command.args], { cwd, stdio: "inherit", env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

export function main(args) {
  const parsed = parseArgs(args), { action, options } = parsed;
  const tests = inventory(root); // Fail closed for new/moved/unassigned tests, even in scoped runs.
  if (action === "inventory") {
    console.log(JSON.stringify(tests, null, options.json ? 0 : 2)); return;
  }
  const affected = Boolean(options.base || options.files || !options.scope);
  const files = options.files ? options.files.split(",") : affected ? changedFiles(root, options) : [];
  const removedFiles = files.filter((file) => !existsSync(resolve(root, file)));
  const overrides = dependencyOverrides(root, files, options);
  const plan = makePlan(files, { ...options, affected, removedFiles, overrides }, tests);
  const commands = commandsFor(plan, parsed);
  const output = { ...plan, commands };
  if (options.json) console.log(JSON.stringify(output));
  else {
    console.log(`Regression scopes: ${plan.scopes.join(", ") || "none (documentation/clean worktree)"}`);
    for (const [scope, layers] of Object.entries(plan.layers)) console.log(`  ${scope}: ${layers.join(", ")}`);
    for (const reason of plan.reasons) console.log(`  ${reason.file} -> ${reason.scopes.join(", ") || "documentation"}${reason.removed ? " (removed legacy test)" : ""}`);
    console.log(`${plan.unit.length} unit/integration test files; ${plan.guards.length} static guards; browser projects: ${plan.browserScopes.join(", ") || "none"}`);
    for (const command of commands) console.log(`[${command.cwd}] ${command.node ? "node" : "pnpm"} ${command.args.join(" ")}`);
    if (action === "validate" && plan.browserScopes.length && !options.browser) console.log("Visible multiplayer/UI changes: select the relevant game/browser cases separately; see docs/testing.md. Browser suites are not implicitly run.");
    if (!commands.length && action !== "plan") console.log("No executable checks selected; no full-suite fallback.");
  }
  if (action === "plan" || options["dry-run"]) return;
  for (const command of commands) execute(command);
}

if (process.argv[1] && relative(root, resolve(process.argv[1])).replaceAll("\\", "/") === "scripts/testing/run.mjs") {
  try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}

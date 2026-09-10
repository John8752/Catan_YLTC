import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { inventory, filesUnder } from "./inventory.mjs";
import { makePlan } from "./plan.mjs";
import { commandsFor, parseArgs } from "./run.mjs";
import { changedFiles } from "./git-changes.mjs";
import { impact, scopes } from "./scopes.mjs";
import { manifestImpact, lockImpact, dependencyOverrides } from "./dependencies.mjs";
const root = fileURLToPath(new URL("../../", import.meta.url));
const allTests = inventory(root);
const plan = (files, options = {}) => makePlan(files, options, allTests);

test("drawing UI changes select only web checks and drawing tests, with no Catan or platform gameplay", () => {
  const selected = plan(["apps/web/src/games/draw-guess/DrawWork.tsx"]);
  assert.deepEqual(selected.scopes, ["draw-guess"]);
  assert.deepEqual(selected.checks, ["@catan/web"]);
  assert.ok(selected.unit.length > 0);
  assert.ok(selected.unit.every((item) => item.scope === "draw-guess" && item.layer === "web"));
  const commands = commandsFor(selected, { action: "validate" });
  assert.equal(commands.length, 4);
  assert.ok(!JSON.stringify(commands).includes("playwright"));
  assert.ok(!JSON.stringify(commands).includes("build"));
});
test("drawing rules expand to their consumers without selecting Catan", () => {
  const selected = plan(["packages/game-core/src/draw-guess/engine.ts"]);
  assert.deepEqual(selected.layers, { "draw-guess": ["core", "protocol", "server", "web"] });
  assert.ok(selected.unit.every((item) => item.scope === "draw-guess"));
});
test("Catan effects are Catan, while shared controls impact both games", () => {
  assert.deepEqual(plan(["apps/web/src/effects/ResourceEffectLayer.tsx"]).scopes, ["catan"]);
  assert.deepEqual(plan(["apps/web/src/components/ui/button.tsx"]).scopes, ["platform", "catan", "draw-guess"]);
});
test("accounts do not select board gameplay and core primitives include all consumers", () => {
  assert.deepEqual(plan(["apps/server/src/auth/account-service.ts"]).scopes, ["platform"]);
  assert.deepEqual(plan(["packages/game-core/src/primitives/random.ts"]).scopes, ["platform", "catan", "draw-guess"]);
});
test("mixed changes take a union of scopes without broadening each layer", () => {
  const selected = plan(["apps/server/src/games/draw-guess/routes.ts", "apps/web/src/games/catan/GameResult.tsx"]);
  assert.deepEqual(selected.layers, { "draw-guess": ["server"], catan: ["web"] });
});
test("docs and a clean checkout do not silently execute any regression", () => {
  for (const files of [[], ["AGENTS.md", "README.md", "docs/testing.md"]]) {
    const selected = plan(files);
    assert.deepEqual(selected.scopes, []);
    assert.deepEqual(commandsFor(selected, { action: "validate" }), []);
  }
});
test("test-only changes stay in their layer; browser changes do not trigger unit suites", () => {
  assert.deepEqual(plan(["packages/game-core/src/draw-guess/engine.test.ts"]).layers, { "draw-guess": ["core"] });
  const selected = plan(["tests/e2e/draw-guess/gallery.spec.ts"]);
  assert.deepEqual(selected.unit, []);
  assert.deepEqual(selected.checks, []);
  assert.deepEqual(selected.browserScopes, ["draw-guess"]);
});
test("a cross-game move retains old and new owners", () => {
  assert.deepEqual(plan(["apps/web/src/games/catan/Old.test.tsx", "apps/web/src/games/draw-guess/New.test.tsx"]).scopes, ["catan", "draw-guess"]);
});
test("explicit scope and layer run on clean trees; CI intersects the affected set", () => {
  const selected = plan([], { scope: "draw-guess", layer: "web" });
  assert.ok(selected.unit.length > 0);
  assert.ok(selected.unit.every((item) => item.layer === "web" && item.scope === "draw-guess"));
  assert.deepEqual(plan(["apps/web/src/games/draw-guess/DrawWork.tsx"], { scope: "catan", affected: true }).scopes, []);
  assert.equal(plan(["deploy/Caddyfile", "apps/web/src/games/draw-guess/DrawWork.tsx"], { scope: "draw-guess", affected: true }).build, false);
});
test("full validation runs each unit file once and does not repeat replay or boundaries", () => {
  const selected = plan([], { scope: "all", build: true });
  assert.equal(selected.unit.length, new Set(selected.unit.map((item) => item.file)).size);
  assert.equal(selected.unit.filter((item) => item.file.endsWith("engine/replay.test.ts")).length, 1);
  assert.equal(selected.unit.filter((item) => item.file.endsWith("boundaries.test.ts")).length, 1);
  assert.deepEqual(selected.scopes, scopes);
});
test("each game browser command uses a positive project allowlist", () => {
  for (const scope of ["platform", "catan", "draw-guess"]) {
    const commands = commandsFor(plan([], { scope }), { action: "e2e", extra: ["--grep", "@primary-phone"] });
    assert.deepEqual(commands[0].args, ["exec", "playwright", "test", `--project=${scope}`, "--grep", "@primary-phone"]);
  }
});
test("tooling changes validate the selector and architecture, not live game flows", () => {
  const selected = plan(["scripts/testing/run.mjs", "playwright.config.ts", ".github/workflows/ci.yml"]);
  assert.deepEqual(selected.scopes, ["tooling"]);
  assert.deepEqual(selected.browserScopes, []);
  assert.ok(selected.unit.some((item) => item.file.endsWith("selection.test.mjs")));
  assert.ok(selected.unit.some((item) => item.file.endsWith("boundaries.test.ts")));
});
test("unknown sources, misspelled scopes and runner overrides fail instead of selecting all", () => {
  assert.throws(() => impact("packages/game-core/src/mystery/rules.ts"), /ownership/);
  assert.throws(() => plan([], { scope: "drawguess" }), /Unknown scope/);
  assert.throws(() => plan([], { scope: "draw-guess", layer: "mobile" }), /Unknown layer/);
  assert.throws(() => parseArgs(["e2e", "--scope", "draw-guess", "--project=catan"]), /ownership/);
  assert.throws(() => parseArgs(["validate", "--scope"]), /Missing value/);
  assert.throws(() => parseArgs(["unit", "--scope", "catan", "--head", "HEAD"]), /requires --base/);
  assert.throws(() => parseArgs(["plan", "--files", "README.md", "--base", "HEAD"]), /either/);
});
test("all existing tests have exactly one owner and platform includes the previously omitted browser guards", () => {
  assert.equal(allTests.length, new Set(allTests.map((item) => item.file)).size);
  for (const suffix of ["auth-boundary.test.ts", "lib/random-id.test.ts", "lib/player-palette.test.ts"]) assert.equal(allTests.find((item) => item.file.endsWith(suffix))?.scope, "platform");
  assert.equal(allTests.find((item) => item.file === "apps/web/src/games/catan/api.test.ts")?.scope, "catan");
  assert.ok(allTests.filter((item) => item.layer === "browser").every((item) => item.file.startsWith(`tests/e2e/${item.scope}/`)));
});
test("an unassigned new test fails inventory", () => {
  const directory = mkdtempSync(join(tmpdir(), "yltc-test-scope-"));
  try {
    mkdirSync(join(directory, "tests/e2e"), { recursive: true });
    writeFileSync(join(directory, "tests/e2e/forgotten.spec.ts"), "");
    assert.throws(() => inventory(directory), /0 owners/);
    rmSync(join(directory, "tests/e2e/forgotten.spec.ts"));
    mkdirSync(join(directory, "apps/web/src"), { recursive: true });
    writeFileSync(join(directory, "apps/web/src/forgotten.spec.ts"), "");
    assert.throws(() => inventory(directory), /0 owners/);
  } finally { assert.equal(dirname(resolve(directory)), resolve(tmpdir())); rmSync(directory, { recursive: true }); }
});
test("Git selection includes staged, unstaged, untracked and removed paths and honors an explicit base", () => {
  const directory = mkdtempSync(join(tmpdir(), "yltc-test-git-"));
  const git = (...args) => execFileSync("git", args, { cwd: directory, encoding: "utf8" }).trim();
  try {
    git("init", "--quiet");
    writeFileSync(join(directory, "before.ts"), "one");
    writeFileSync(join(directory, "unstaged.ts"), "one");
    git("add", ".");
    git("-c", "user.name=Scope Test", "-c", "user.email=scope@example.invalid", "commit", "--quiet", "-m", "fixture");
    const base = git("rev-parse", "HEAD");
    git("mv", "before.ts", "after.ts");
    writeFileSync(join(directory, "unstaged.ts"), "two");
    writeFileSync(join(directory, "new file.ts"), "new");
    assert.deepEqual(changedFiles(directory), ["after.ts", "before.ts", "new file.ts", "unstaged.ts"]);
    assert.deepEqual(changedFiles(directory, { base, head: "HEAD" }), []);
    assert.deepEqual(changedFiles(directory, { base: "EMPTY", head: base }), ["before.ts", "unstaged.ts"]);
    assert.throws(() => changedFiles(directory, { base: "does-not-exist" }));
  } finally { assert.equal(dirname(resolve(directory)), resolve(tmpdir())); rmSync(directory, { recursive: true }); }
});
test("the executable dry run agrees with the plan and never launches a browser for a unit change", () => {
  const output = execFileSync(process.execPath, ["scripts/testing/run.mjs", "validate", "--files", "apps/web/src/games/draw-guess/DrawWork.tsx", "--dry-run", "--json"], { cwd: root, encoding: "utf8" });
  const result = JSON.parse(output);
  assert.deepEqual(result.scopes, ["draw-guess"]);
  assert.equal(result.commands.length, 4);
});
test("the root default scripts do not point at an unconditional recursive gate", () => {
  const { scripts } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  for (const name of ["test", "check", "validate", "test:e2e"]) assert.match(scripts[name], /scripts\/testing\/run.mjs/);
  assert.equal(scripts["test:e2e:mobile"], undefined);
  assert.match(scripts["validate:full"], /--scope all --build --browser/);
});
test("test-script/dependency relocation is tooling; compiler or resolved dependency changes require integration", () => {
  const before = JSON.stringify({ scripts: { test: "old" }, devDependencies: { typescript: "7", "@babel/parser": "7" } });
  const moved = JSON.stringify({ scripts: { test: "new" }, devDependencies: { typescript: "7" } });
  assert.deepEqual(manifestImpact(before, moved).scopes, ["tooling"]);
  assert.equal(manifestImpact(before, moved.replace('"7"', '"8"')).build, true);
  assert.equal(manifestImpact('{"scripts":{"build":"old"}}', '{"scripts":{"build":"new"}}').build, true);
  const lock = "importers:\n  .:\n    devDependencies:\n      '@babel/parser':\n        specifier: 7\n        version: 7\npackages:\n  parser@7: {}\n";
  const relocated = "importers:\n  .:\n    devDependencies:\npackages:\n  parser@7: {}\n";
  assert.deepEqual(lockImpact(lock, relocated).scopes, ["tooling"]);
  assert.equal(lockImpact(lock, relocated.replace('parser@7', 'parser@8')).build, true);
  assert.throws(() => parseArgs(["unit", "--scope", "draw-guess", "src/games/catan"]), /narrow/);
});

test("every current source and fixture has an explicit impact mapping", () => {
  for (const file of filesUnder(root).filter((file) => file.includes("/src/") || file.startsWith("scripts/") || file.startsWith("tests/"))) assert.doesNotThrow(() => impact(file), file);
});

test("workspace unit entry points also respect the selected layer and Git changes", () => {
  for (const [directory, layer] of [["packages/game-core", "core"], ["packages/protocol", "protocol"], ["apps/server", "server"], ["apps/web", "web"]]) {
    const { scripts } = JSON.parse(readFileSync(join(root, directory, "package.json"), "utf8"));
    assert.equal(scripts.test, `node ../../scripts/testing/run.mjs unit --layer ${layer}`);
    assert.match(scripts["test:all"], new RegExp(`--scope all --layer ${layer}$`));
  }
});

test("CLI manifest comparisons classify only test wiring as tooling", () => {
  const directory = mkdtempSync(join(tmpdir(), "yltc-test-deps-"));
  const git = (...args) => execFileSync("git", args, { cwd: directory, encoding: "utf8" }).trim();
  try {
    git("init", "--quiet");
    writeFileSync(join(directory, "package.json"), '{"scripts":{"test":"old","build":"build"}}');
    git("add", ".");
    git("-c", "user.name=Scope Test", "-c", "user.email=scope@example.invalid", "commit", "--quiet", "-m", "fixture");
    writeFileSync(join(directory, "package.json"), '{"scripts":{"test":"new","build":"build"}}');
    assert.deepEqual(dependencyOverrides(directory, ["package.json"])["package.json"].scopes, ["tooling"]);
    assert.equal(dependencyOverrides(directory, ["package.json"], { base: "EMPTY", head: "HEAD" })["package.json"].build, true);
  } finally { assert.equal(dirname(resolve(directory)), resolve(tmpdir())); rmSync(directory, { recursive: true }); }
});

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { packages, scopes } from "./scopes.mjs";

const testTools = ["@babel/parser", "@playwright/test", "vitest", "@testing-library/react", "@testing-library/user-event", "jsdom"];
function withoutTesting(manifest) {
  const { scripts = {}, ...rest } = manifest;
  const runtimeScripts = Object.fromEntries(Object.entries(scripts).filter(([name]) => !/^(test|check|validate)(:|$)/.test(name)));
  const devDependencies = { ...rest.devDependencies };
  for (const tool of testTools) delete devDependencies[tool];
  return { ...rest, scripts: runtimeScripts, devDependencies };
}
export function manifestImpact(before, after, layer = "all") {
  if (before && after && JSON.stringify(withoutTesting(JSON.parse(before))) === JSON.stringify(withoutTesting(JSON.parse(after)))) return { scopes: ["tooling"], layer: "tooling" };
  return { scopes, layer, build: true };
}
function withoutTestImporters(text) {
  // Only remove test-tool entries from importers. Package resolution/snapshot changes
  // remain byte-visible and therefore retain integration coverage.
  let skipping = false;
  return text.replaceAll("\r\n", "\n").split("\n").filter((line) => {
    const match = /^ {6}'?([^':]+)'?:$/.exec(line);
    if (match) { skipping = testTools.includes(match[1]); return !skipping; }
    if (skipping && /^ {8}/.test(line)) return false;
    skipping = false; return true;
  }).join("\n");
}
export function lockImpact(before, after) {
  return before && after && withoutTestImporters(before) === withoutTestImporters(after)
    ? { scopes: ["tooling"], layer: "tooling" } : { scopes, layer: "all", build: true };
}
export function dependencyOverrides(root, files, { base, head } = {}) {
  function content(file, ref) {
    try { return ref ? execFileSync("git", ["show", `${ref}:${file}`], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) : readFileSync(join(root, file), "utf8"); }
    catch { return null; }
  }
  const overrides = {};
  for (const file of files) {
    if (file !== "pnpm-lock.yaml" && file !== "package.json" && !Object.values(packages).some((pkg) => file === `${pkg.cwd}/package.json`)) continue;
    const before = content(file, base ?? "HEAD"), after = content(file, base ? head ?? "HEAD" : null);
    const layer = Object.entries(packages).find(([, pkg]) => file === `${pkg.cwd}/package.json`)?.[0] ?? "all";
    overrides[file] = file === "pnpm-lock.yaml" ? lockImpact(before, after) : manifestImpact(before, after, layer);
  }
  return overrides;
}

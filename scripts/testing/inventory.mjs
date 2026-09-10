import { readdirSync } from "node:fs";
import { join } from "node:path";
import { isBrowser, isUnit, testOwner } from "./scopes.mjs";

export function filesUnder(root, prefix = "") {
  return readdirSync(join(root, prefix), { withFileTypes: true }).flatMap((entry) => {
    if (["node_modules", "dist", ".git", "output", "test-results", "playwright-report", "coverage", ".vite"].includes(entry.name)) return [];
    const file = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory() ? filesUnder(root, file) : [file];
  });
}
export function inventory(root) {
  const files = filesUnder(root).filter((file) => isUnit(file) || isBrowser(file));
  return files.map((file) => {
    const owners = testOwner(file);
    if (owners.length !== 1) throw Error(`Test has ${owners.length} owners (expected 1): ${file}`);
    return { file, scope: owners[0].scope, layer: owners[0].layer };
  });
}

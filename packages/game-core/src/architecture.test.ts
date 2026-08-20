import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceRoot = dirname(fileURLToPath(import.meta.url));

describe("game-core module boundaries", () => {
  it("uses explicit domain directories instead of legacy root modules", () => {
    for (const directory of ["primitives", "map", "resources", "rulesets", "engine"]) {
      expect(existsSync(join(sourceRoot, directory)), `${directory}/ should exist`).toBe(true);
    }

    for (const legacyFile of ["model.ts", "board.ts", "game.ts", "random.ts"]) {
      expect(existsSync(join(sourceRoot, legacyFile)), `${legacyFile} should be migrated`).toBe(false);
    }
  });

  it("does not import another domain through a private file", () => {
    const violations: string[] = [];

    for (const file of sourceFiles(sourceRoot)) {
      const moduleName = relative(sourceRoot, file).split(/[\\/]/)[0];
      const contents = readFileSync(file, "utf8");

      for (const match of contents.matchAll(/from\s+["']\.\.\/([^/"']+)\/([^"']+)["']/g)) {
        const importedModule = match[1];
        const importedPath = match[2];

        if (
          importedModule !== undefined &&
          importedModule !== moduleName &&
          importedPath !== "index.js"
        ) {
          violations.push(`${relative(sourceRoot, file)} -> ${match[0]}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});

function sourceFiles(directory: string): string[] {
  return readdirSync(directory)
    .map((entry) => resolve(directory, entry))
    .flatMap((entry) => (statSync(entry).isDirectory() ? sourceFiles(entry) : [entry]))
    .filter((entry) => entry.endsWith(".ts") && !entry.endsWith(".test.ts"));
}

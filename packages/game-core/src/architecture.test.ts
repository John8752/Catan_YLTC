import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "@babel/parser";

const sourceRoot = dirname(fileURLToPath(import.meta.url));

describe("game-core module boundaries", () => {
  it("keeps drawing telephone independent of Catan domains and ambient nondeterminism", () => {
    for (const file of sourceFiles(join(sourceRoot, "draw-guess"))) {
      expect(readFileSync(file, "utf8"), relative(sourceRoot, file)).not.toMatch(/Math\.random|Date\.|setTimeout|document|window|fetch/);
      for (const edge of imports(file)) {
        const target = resolveImport(file, edge.specifier);
        expect(target && (target.startsWith(join(sourceRoot, "draw-guess")) || target === join(sourceRoot, "primitives", "index.ts")), `${file} -> ${edge.specifier}`).toBe(true);
      }
    }
  });
  it("keeps authentication, persistence and transport outside the rules engine", () => {
    for (const file of sourceFiles(sourceRoot)) {
      expect(readFileSync(file, "utf8"), relative(sourceRoot, file))
        .not.toMatch(/node:sqlite|node:crypto|apps\/server|accountId|seatToken|passwordHash|@catan\/protocol/);
    }
  });
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
    .filter((entry) => /\.tsx?$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry));
}

const repositoryRoot = resolve(sourceRoot, "../../..");
const roots = ["packages/game-core/src", "packages/protocol/src", "apps/server/src", "apps/web/src"];
type Edge = { specifier: string; typeOnly: boolean; dynamic: boolean };

/** Parse imports, reexports and dynamic imports; type-only edges still obey game ownership. */
function imports(file: string): Edge[] {
  const source = parse(readFileSync(file, "utf8"), { sourceType: "module", plugins: ["typescript", "jsx"] });
  const edges: Edge[] = [];
  type Node = { type?: string; value?: unknown; name?: string; importKind?: string; exportKind?: string;
    source?: Node; callee?: Node; argument?: Node; arguments?: Node[]; specifiers?: Node[]; [key: string]: unknown };
  function visit(value: unknown) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    const node = value as Node;
    if (["ImportDeclaration", "ExportNamedDeclaration", "ExportAllDeclaration"].includes(node.type ?? "") && typeof node.source?.value === "string") {
      const typeOnly = node.importKind === "type" || node.exportKind === "type" ||
        Boolean(node.specifiers?.length && node.specifiers.every((item) => item.importKind === "type" || item.exportKind === "type"));
      edges.push({ specifier: node.source.value, typeOnly, dynamic: false });
    } else if (node.type === "CallExpression" && (node.callee?.type === "Import" || node.callee?.name === "require")) {
      const argument = node.arguments?.[0];
      if (typeof argument?.value === "string") edges.push({ specifier: argument.value, typeOnly: false, dynamic: node.callee.type === "Import" });
    } else if (node.type === "ImportExpression" && typeof node.source?.value === "string") {
      edges.push({ specifier: node.source.value, typeOnly: false, dynamic: true });
    } else if (node.type === "TSImportType" && typeof node.argument?.value === "string") {
      edges.push({ specifier: node.argument.value, typeOnly: true, dynamic: false });
    }
    Object.values(node).forEach(visit);
  }
  visit(source);
  return edges;
}

function resolveImport(file: string, specifier: string): string | null {
  let path: string;
  if (specifier.startsWith("@catan/")) {
    const [, name, ...subpath] = specifier.split("/");
    const directory = join(repositoryRoot, "packages", name!);
    const manifest = JSON.parse(readFileSync(join(directory, "package.json"), "utf8")) as { exports: Record<string, string> };
    const entry = manifest.exports[subpath.length ? `./${subpath.join("/")}` : "."];
    return entry ? resolve(directory, entry) : null;
  }
  if (specifier.startsWith("@/")) path = join(repositoryRoot, "apps/web/src", specifier.slice(2));
  else if (specifier.startsWith(".")) path = resolve(dirname(file), specifier);
  else return null;
  return [path.replace(/\.js$/, ".ts"), path.replace(/\.js$/, ".tsx"), `${path}.ts`, `${path}.tsx`].find(existsSync) ?? null;
}

function owner(file: string): "catan" | "draw-guess" | "primitives" | "platform" | "dispatch" {
  const path = relative(repositoryRoot, file).replaceAll("\\", "/");
  if (path.startsWith("packages/game-core/src/primitives/")) return "primitives";
  if (path.includes("/draw-guess/")) return "draw-guess";
  if (path.startsWith("packages/game-core/") || path.includes("/catan/") || path.startsWith("apps/web/src/effects/")) return "catan";
  if (["apps/web/src/App.tsx", "apps/web/src/games/room-sync.ts", "apps/server/src/app.ts", "apps/server/src/rooms.ts", "apps/server/src/room-types.ts", "apps/server/src/index.ts", "apps/server/src/e2e-server.ts", "packages/protocol/src/platform-stream.ts"].includes(path)) return "dispatch";
  return "platform";
}

describe("platform and game dependency boundaries", () => {
  const files = roots.flatMap((root) => sourceFiles(join(repositoryRoot, root)));
  it("rejects cross-game imports and keeps platform services free of game implementations", () => {
    const violations: string[] = [];
    for (const file of files) for (const edge of imports(file)) {
      const source = owner(file), target = resolveImport(file, edge.specifier);
      const label = `${relative(repositoryRoot, file)} -> ${edge.specifier}`;
      if (edge.specifier.startsWith("@catan/") && !target) { violations.push(label); continue; }
      if (!target) continue;
      const destination = owner(target);
      if ((source === "catan" && destination === "draw-guess") || (source === "draw-guess" && destination === "catan") || (source === "primitives" && destination !== "primitives")) violations.push(label);
      if (source === "platform" && (destination === "catan" || destination === "draw-guess")) {
        // The discriminated view union names games; account history lazily renders their results.
        const union = file === join(repositoryRoot, "packages/protocol/src/platform/index.ts") && edge.typeOnly;
        const history = file === join(repositoryRoot, "apps/web/src/components/AccountHistory.tsx") && edge.dynamic;
        if (!union && !history) violations.push(label);
      }
    }
    expect(violations).toEqual([]);
  });
  it("keeps Catan rendering out of the account shell's static dependency graph", () => {
    const seen = new Set<string>();
    function walk(file: string) {
      if (seen.has(file)) return;
      seen.add(file);
      for (const edge of imports(file)) {
        if (edge.typeOnly || edge.dynamic) continue;
        const target = resolveImport(file, edge.specifier);
        if (target) walk(target);
      }
    }
    walk(join(repositoryRoot, "apps/web/src/components/AccountControl.tsx"));
    expect([...seen].filter((file) => owner(file) === "catan")).toEqual([]);
  });
});

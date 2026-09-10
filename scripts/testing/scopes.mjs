// Canonical ownership for local regression, inventory checks and CI.
export const scopes = ["platform", "catan", "draw-guess", "tooling"];
export const layers = ["core", "protocol", "server", "web", "browser", "tooling"];
export const packages = {
  core: { cwd: "packages/game-core", name: "@catan/game-core" },
  protocol: { cwd: "packages/protocol", name: "@catan/protocol" },
  server: { cwd: "apps/server", name: "@catan/server" },
  web: { cwd: "apps/web", name: "@catan/web" },
};
const group = (scope, layer, paths) => ({ scope, layer, paths });
export const unitGroups = [
  group("platform", "core", ["packages/game-core/src/primitives/"]),
  group("catan", "core", ["awards", "buildables", "development", "engine", "map", "resources", "rulesets", "trade"].map((name) => `packages/game-core/src/${name}/`).concat("packages/game-core/src/game.test.ts")),
  group("draw-guess", "core", ["packages/game-core/src/draw-guess/"]),
  ...["platform", "catan", "draw-guess"].map((scope) => group(scope, "protocol", [`packages/protocol/src/${scope}/`])),
  group("platform", "server", ["apps/server/src/platform/", "apps/server/src/auth/", "apps/server/src/database/"]),
  ...["catan", "draw-guess"].map((scope) => group(scope, "server", [`apps/server/src/games/${scope}/`])),
  group("platform", "web", ["apps/web/src/components/", "apps/web/src/lib/", "apps/web/src/hooks/", ...["auth-boundary", "player-session", "room-updates"].map((name) => `apps/web/src/${name}.test.ts`)]),
  group("catan", "web", ["apps/web/src/games/catan/", "apps/web/src/effects/"]),
  group("draw-guess", "web", ["apps/web/src/games/draw-guess/"]),
  group("tooling", "tooling", ["tests/architecture/", "scripts/testing/"]),
];
export const matchesPath = (file, path) => path.endsWith("/") ? file.startsWith(path) : file === path;
export const isUnit = (file) => /\.(?:test|spec)\.(?:[cm]?[jt]sx?)$/.test(file) && !isBrowser(file);
export const isBrowser = (file) => file.startsWith("tests/e2e/") && file.endsWith(".spec.ts");
export function testOwner(file) {
  if (isBrowser(file)) {
    const scope = file.split("/")[2];
    return scopes.slice(0, 3).includes(scope) ? [{ scope, layer: "browser" }] : [];
  }
  return isUnit(file) ? unitGroups.filter((g) => g.paths.some((path) => matchesPath(file, path))) : [];
}

const sharedWeb = ["App.tsx", "main.tsx", "styles.css", "http.ts", "api.ts", "auth-headers.ts", "room-session.ts", "room-updates.ts", "player-session.ts", "components/DisbandRoomControl.tsx", "games/room-sync.ts", "hooks/use-room-connection.ts", "hooks/use-media-query.ts"];
const allGames = ["platform", "catan", "draw-guess"];
/** No catch-all Catan bucket: an unmapped source/test must be assigned explicitly. */
export function impact(file) {
  const owners = testOwner(file);
  if (isUnit(file) || isBrowser(file)) {
    if (owners.length !== 1) throw Error(`Test must have exactly one owner: ${file}`);
    return { scopes: [owners[0].scope], layer: owners[0].layer, testOnly: true };
  }
  if (file.startsWith("scripts/testing/") || file.startsWith("tests/architecture/") || file.startsWith(".github/") || file === "playwright.config.ts") return { scopes: ["tooling"], layer: "tooling" };
  if (file === "tests/e2e/viewport-cases.ts") return { scopes: allGames, layer: "browser" };
  // Historical fixture paths remain explicit while Git reports their deletion.
  if (file === "tests/e2e/game-tools.ts") return { scopes: ["catan"], layer: "browser" };
  if (file === "tests/e2e/layout-fixture.ts") return { scopes: ["platform", "catan"], layer: "browser" };
  if (file === "tests/e2e/catan/fixtures.ts") return { scopes: ["platform", "catan"], layer: "browser" }; // Account history consumes this result fixture too.
  if (file.startsWith("tests/e2e/")) {
    const scope = file.split("/")[2];
    if (allGames.includes(scope)) return { scopes: [scope], layer: "browser" };
    throw Error(`Assign browser fixture ownership: ${file}`);
  }
  if (file.endsWith(".md") || [".gitignore", ".gitattributes", ".editorconfig"].includes(file)) return { scopes: [], layer: null };
  // Root scripts/tool versions are test infrastructure. Dependency/lock and app build
  // configuration changes have an explicit integration impact, never an implicit fallback.
  if (file === "package.json") return { scopes, layer: "all", build: true }; // Narrowed by a verified manifest diff in the CLI.
  if (["pnpm-lock.yaml", "pnpm-workspace.yaml", "tsconfig.base.json"].includes(file)) return { scopes: [...scopes], layer: "all", build: true };
  for (const [layer, pkg] of Object.entries(packages)) {
    if (!file.startsWith(`${pkg.cwd}/`)) continue;
    const path = file.slice(pkg.cwd.length + 1);
    if (!path.startsWith("src/")) return { scopes: allGames, layer, build: true };
    const source = path.slice(4);
    if (layer === "core") {
      if (source.startsWith("draw-guess/")) return { scopes: ["draw-guess"], layer };
      if (source.startsWith("primitives/")) return { scopes: allGames, layer };
      if (source === "catan.ts" || unitGroups.find((g) => g.scope === "catan" && g.layer === "core").paths.some((p) => matchesPath(file, p))) return { scopes: ["catan"], layer };
      throw Error(`Assign game-core domain ownership: ${file}`);
    }
    if (layer === "protocol") {
      if (source === "platform/accounts.ts") return { scopes: ["platform"], layer };
      if (source === "platform-stream.ts" || source.startsWith("platform/")) return { scopes: allGames, layer };
      for (const scope of ["catan", "draw-guess"]) if (source.startsWith(`${scope}/`)) return { scopes: [scope], layer };
      throw Error(`Assign protocol ownership: ${file}`);
    }
    for (const scope of ["catan", "draw-guess"]) if (source.startsWith(`games/${scope}/`)) return { scopes: [scope], layer };
    if (source.startsWith("games/") && source !== "games/room-sync.ts") throw Error(`Assign game ownership: ${file}`);
    if (layer === "web") {
      if (source.startsWith("effects/")) return { scopes: ["catan"], layer };
      if (sharedWeb.includes(source) || source.startsWith("components/ui/") || source.startsWith("lib/")) return { scopes: allGames, layer };
      return { scopes: ["platform"], layer };
    }
    if (source.startsWith("auth/") || source.startsWith("database/") || source.startsWith("platform/")) return { scopes: ["platform"], layer };
    return { scopes: allGames, layer }; // Shared server transport, directory and dispatch.
  }
  if (file.startsWith("deploy/") || file === "scripts/account-runtime-smoke.mjs") return { scopes: ["platform"], layer: "server", build: true };
  throw Error(`Unmapped changed file; update scripts/testing/scopes.mjs: ${file}`);
}

export function affectedLayers(change) {
  if (change.layer === "all") return layers;
  if (change.testOnly || ["browser", "tooling"].includes(change.layer)) return [change.layer];
  return { core: ["core", "protocol", "server", "web"], protocol: ["protocol", "server", "web"], server: ["server"], web: ["web"] }[change.layer] ?? [];
}

import { affectedLayers, impact, layers, packages, scopes } from "./scopes.mjs";

export function makePlan(files, options = {}, tests = []) {
  const selected = new Map();
  const reasons = files.map((file) => {
    try { return { file, ...(options.overrides?.[file] ?? impact(file)) }; }
    catch (error) {
      // Historical layouts can disappear during a migration. Keep their impact visible;
      // current unowned tests still fail inventory before planning any run.
      if (!options.removedFiles?.includes(file) || !/\.(test|spec)\.(tsx?|mjs)$/.test(file)) throw error;
      const layer = Object.entries(packages).find(([, pkg]) => file.startsWith(`${pkg.cwd}/`))?.[0] ?? "browser";
      return { file, scopes, layer, testOnly: true, removed: true };
    }
  });
  for (const reason of reasons) for (const scope of reason.scopes) {
    if (!selected.has(scope)) selected.set(scope, new Set());
    for (const layer of affectedLayers(reason)) selected.get(scope).add(layer);
  }
  if (options.scope) {
    const explicit = options.scope === "all" ? scopes : options.scope.split(",");
    for (const scope of explicit) if (!scopes.includes(scope)) throw Error(`Unknown scope: ${scope}`);
    if (!options.affected) { selected.clear(); for (const scope of explicit) selected.set(scope, new Set(scope === "tooling" ? ["tooling"] : layers.slice(0, 5))); }
    else for (const scope of selected.keys()) if (!explicit.includes(scope)) selected.delete(scope);
  }
  if (options.layer) {
    if (!layers.includes(options.layer)) throw Error(`Unknown layer: ${options.layer}`);
    for (const [scope, values] of selected) {
      if (values.has(options.layer)) selected.set(scope, new Set([options.layer])); else selected.delete(scope);
    }
  }
  const chosen = tests.filter((test) => selected.get(test.scope)?.has(test.layer));
  const packageLayers = Object.keys(packages).filter((layer) => [...selected.values()].some((values) => values.has(layer)));
  return {
    scopes: scopes.filter((scope) => selected.has(scope)),
    layers: Object.fromEntries([...selected].map(([scope, values]) => [scope, [...values]])),
    reasons,
    checks: packageLayers.map((layer) => packages[layer].name),
    unit: chosen.filter((test) => test.layer !== "browser"),
    guards: [
      ...(packageLayers.length ? ["tests/architecture/boundaries.test.ts"] : []),
      ...(packageLayers.includes("web") ? ["apps/web/src/lib/secure-context.test.ts"] : []),
    ].filter((file) => !chosen.some((test) => test.file === file)),
    browserScopes: scopes.slice(0, 3).filter((scope) => selected.has(scope)),
    browser: tests.filter((test) => test.layer === "browser" && selected.has(test.scope)),
    build: Boolean(options.build || reasons.some((reason) => reason.build && reason.scopes.some((scope) => affectedLayers(reason).some((layer) => selected.get(scope)?.has(layer))))),
  };
}

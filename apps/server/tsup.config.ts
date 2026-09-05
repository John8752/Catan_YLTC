import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts", "database/cli": "src/database/cli.ts" },
  format: ["esm"],
  platform: "node",
  // SQLite is a prefix-only builtin; stripping node: makes production import an npm package.
  removeNodeProtocol: false,
  target: "node22",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  splitting: false,
  noExternal: ["@catan/game-core", "@catan/protocol"],
});

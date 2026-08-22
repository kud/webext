import { defineConfig } from "tsup"

import pkg from "./package.json" with { type: "json" }

export default defineConfig({
  // The bundle is vendored into extension repos as a committed file, so copies
  // drift silently and there is nothing at runtime to interrogate. Stamping the
  // version into the banner makes staleness one `grep` across the fleet — the
  // same answer @kud/webext-ui already ships.
  banner: {
    js: `// @kud/webext@${pkg.version} — vendored build, do not edit by hand.`,
  },
  entry: ["src/index.ts"],
  format: ["esm", "iife"],
  globalName: "webext",
  dts: true,
  clean: true,
  target: "es2022",
  treeshake: true,
  minify: false,
  // No sourcemap on purpose. The bundle ships unminified and gets *vendored* into
  // extension repos as a single file, so a `sourceMappingURL` would point at a .map
  // that was never copied alongside it — a failed fetch in every consumer's devtools.
  // Unminified output is its own sourcemap here.
  sourcemap: false,
})

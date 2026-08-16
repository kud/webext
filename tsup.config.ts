import { defineConfig } from "tsup"

export default defineConfig({
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

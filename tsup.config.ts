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
  sourcemap: true,
})

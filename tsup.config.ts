import { defineConfig } from "tsup";

// One entry per public subpath. `format` and `parse` are separately importable so a
// format-only consumer can tree-shake the parser (and vice versa). Unlike the base
// package there is NO heavy runtime dependency here — temporal-format-parse ships zero
// runtime deps, so these entries are genuinely small and tree-shakeable.
export default defineConfig({
  entry: ["src/index.ts", "src/format.ts", "src/parse.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  treeshake: true,
  sourcemap: true,
  target: "es2022",
});

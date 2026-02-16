import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/ipc/index.ts", "src/supervisor/index.ts", "src/registry/index.ts"],
  format: "esm",
  dts: true,
  clean: true,
  outDir: "dist",
});

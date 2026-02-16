import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/messages.ts", "src/manifest.ts", "src/capabilities.ts"],
  format: "esm",
  dts: true,
  clean: true,
  outDir: "dist",
});

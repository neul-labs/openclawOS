import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/client.ts",
    "src/app.ts",
    "src/skill.ts",
    "src/agent.ts",
    "src/extension.ts",
    "src/testing.ts",
  ],
  format: "esm",
  dts: true,
  clean: true,
  outDir: "dist",
});
